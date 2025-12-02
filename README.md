# Cloud Drive - Authentication Service

User authentication with JWT and DynamoDB.

## Local Development
```bash
cd backend
npm install
node scripts/create-tables.js  # First time only
node src/index.js
```

Server runs on: http://localhost:3000

## API Endpoints

**Register:** `POST /api/auth/register`
```json
{"email": "user@example.com", "password": "pass123", "name": "Name"}
```

**Login:** `POST /api/auth/login`
```json
{"email": "user@example.com", "password": "pass123"}
```

**Profile:** `GET /api/auth/profile`
```
Header: Authorization: Bearer <token>
```

## Testing Locally

Register a user:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Get profile (use token from login):
```bash
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## For Team Integration

JWT Secret: `super-secret-cloud-drive-key-xyz123`

To verify tokens in your service:
```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'super-secret-cloud-drive-key-xyz123';

jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    // user.userId = authenticated user's ID
    // user.email = user's email
});
```

## AWS Resources

DynamoDB Tables (already created):
- cloud-drive-users
- cloud-drive-data

AWS Console Login: https://577885025398.signin.aws.amazon.com/console

Region: us-east-1

## Deploy to AWS (Optional)
```bash
cd infrastructure
cdk deploy
```

Note: CDK deployment configured but currently in testing. Local service fully functional.

## Project Structure
```
backend/
├── src/
│   ├── index.js          # Auth service code
│   └── lambda.js         # Lambda handler
├── scripts/
│   └── create-tables.js  # DynamoDB setup
├── package.json
└── README.md

infrastructure/
├── lib/
│   └── infrastructure-stack.js  # CDK stack definition
└── bin/
    └── infrastructure.js        # CDK app entry
```

## Notes

- Tokens expire in 7 days
- Storage quota: 5GB per user
- Passwords hashed with bcrypt
- Don't commit `.env` to git