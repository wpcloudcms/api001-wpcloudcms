// Minimal Node.js server for Phusion Passenger (Hostinger Shared Hosting)
// Uses ONLY built-in Node.js modules — zero external dependencies
const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'OK',
        message: 'Hello from Hostinger Node.js!',
        url: req.url,
        port: PORT,
        nodeVersion: process.version,
        env: {
            DB_HOST: process.env.DB_HOST || 'NOT SET',
            KEY: process.env.KEY ? 'SET' : 'NOT SET',
            PUBLIC_URL: process.env.PUBLIC_URL || 'NOT SET'
        }
    }));
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
