const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 8055;
const HOST = '0.0.0.0'; // Important for Docker/PaaS

console.log(`[Server] Starting Directus on ${HOST}:${PORT}...`);
console.log(`[Server] Environment: NODE_ENV=${process.env.NODE_ENV}`);
console.log(`[Server] Database Host: ${process.env.DB_HOST}`);

// Set environment variables for Directus
process.env.PORT = PORT;
process.env.HOST = HOST;
process.env.PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const directus = spawn('npx', ['directus', 'start'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
});

directus.on('error', (err) => {
    console.error('[Server] Failed to start Directus:', err);
});

directus.on('close', (code) => {
    console.log(`[Server] Directus process exited with code ${code}`);
    if (code !== 0) {
        process.exit(code);
    }
});
