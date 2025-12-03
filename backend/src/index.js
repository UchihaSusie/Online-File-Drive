const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

console.log('Starting auth service...');

const app = express();
app.use(express.json());
app.use(cors());

console.log('Express initialized');

const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(client);

console.log('DynamoDB client created');

const USERS_TABLE = 'cloud-drive-users';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const TOKEN_EXPIRY = '7d';

(async () => {
    try {
        await docClient.send(new GetCommand({
            TableName: USERS_TABLE,
            Key: { userId: 'test' }
        }));
        console.log(' DynamoDB connected successfully!');
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            console.log(' DynamoDB connected successfully!');
        } else {
            console.error(' DynamoDB connection failed:', error.message);
        }
    }
})();

const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Email, password, and name are required' 
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        const queryParams = {
            TableName: USERS_TABLE,
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        };

        const existingUser = await docClient.send(new QueryCommand(queryParams));

        if (existingUser.Items && existingUser.Items.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const userId = generateId();
        const user = {
            userId,
            email,
            passwordHash,
            name,
            storageQuota: 5368709120,
            storageUsed: 0,
            createdAt: new Date().toISOString()
        };

        await docClient.send(new PutCommand({
            TableName: USERS_TABLE,
            Item: user
        }));

        const token = jwt.sign(
            { userId, email },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: userId,
                email: user.email,
                name: user.name,
                storageQuota: user.storageQuota,
                storageUsed: user.storageUsed
            }
        });

    } catch (error) {
        console.error(' Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }

        const queryParams = {
            TableName: USERS_TABLE,
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        };

        const result = await docClient.send(new QueryCommand(queryParams));

        if (!result.Items || result.Items.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.Items[0];

        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.userId, email: user.email },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.userId,
                email: user.email,
                name: user.name,
                storageQuota: user.storageQuota,
                storageUsed: user.storageUsed
            }
        });

    } catch (error) {
        console.error(' Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/auth/profile', authenticateToken, async (req, res) => {
    try {
        const result = await docClient.send(new GetCommand({
            TableName: USERS_TABLE,
            Key: {
                userId: req.user.userId
            }
        }));

        if (!result.Item) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.Item;

        res.json({
            user: {
                id: user.userId,
                email: user.email,
                name: user.name,
                storageQuota: user.storageQuota,
                storageUsed: user.storageUsed,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error(' Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'auth',
        database: 'DynamoDB',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
    Auth Service is running!
    Server: http://localhost:${PORT}
    Database: DynamoDB (cloud-drive-users)
    Endpoints:
       - POST /api/auth/register
       - POST /api/auth/login
       - GET  /api/auth/profile
    `);
});

module.exports = app;