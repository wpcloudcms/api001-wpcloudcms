// DIAGNOSTIC: Minimal Express server to test if Hostinger can run ANY Node.js app
// If this works (shows "Hello from Directus API"), then the issue is Directus startup
// If this fails (still 503), then the issue is Hostinger configuration

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Hello from Directus API server!',
        port: PORT,
        host: HOST,
        env: {
            DB_HOST: process.env.DB_HOST || 'NOT SET',
            DB_DATABASE: process.env.DB_DATABASE || 'NOT SET',
            PUBLIC_URL: process.env.PUBLIC_URL || 'NOT SET',
            KEY: process.env.KEY ? 'SET' : 'NOT SET',
            SECRET: process.env.SECRET ? 'SET' : 'NOT SET',
            NODE_ENV: process.env.NODE_ENV || 'NOT SET'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

app.listen(PORT, HOST, () => {
    console.log(`Test server running on http://${HOST}:${PORT}`);
});
