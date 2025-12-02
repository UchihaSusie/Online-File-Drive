const app = require('./index');

exports.handler = async (event) => {
    const path = event.path || event.rawPath;
    const method = event.httpMethod || event.requestContext?.http?.method;
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = event.headers || {};
    
    let response;
    
    try {
        if (method === 'POST' && path.includes('/register')) {
            const result = await registerUser(body);
            response = { statusCode: result.statusCode, body: JSON.stringify(result.body) };
        } else if (method === 'POST' && path.includes('/login')) {
            const result = await loginUser(body);
            response = { statusCode: result.statusCode, body: JSON.stringify(result.body) };
        } else if (method === 'GET' && path.includes('/profile')) {
            const token = headers.authorization?.split(' ')[1];
            const result = await getProfile(token);
            response = { statusCode: result.statusCode, body: JSON.stringify(result.body) };
        } else {
            response = { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
        }
    } catch (error) {
        response = { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
    }
    
    return response;
};