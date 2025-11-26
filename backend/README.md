# Cloud Drive - Auth Service

User authentication with JWT and DynamoDB.

## Setup
```bash
npm install
node scripts/create-tables.js
node src/index.js
```

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

## For Your Service

To verify tokens:
```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'super-secret-cloud-drive-key-xyz123';

jwt.verify(token, JWT_SECRET, (err, user) => {
    // user.userId has the user ID
});
```

## AWS Access

Login: `https://577885025398.signin.aws.amazon.com/console`

Region: **us-east-1**

Tables already created: `cloud-drive-users`, `cloud-drive-data`

## Notes

- Tokens expire in 7 days
- Storage quota: 5GB per user
- Don't commit `.env`