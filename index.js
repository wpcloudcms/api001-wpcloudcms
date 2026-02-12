const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 8055;
const HOST = '0.0.0.0';

console.log(`[Index] Starting Directus on ${HOST}:${PORT}...`);

// Set environment variables for Directus
process.env.PORT = PORT;
process.env.HOST = HOST;
process.env.PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

// Use directus/cli.js directly to avoid permission issues with .bin/directus
const directusScript = path.join(__dirname, 'node_modules', 'directus', 'cli.js');

console.log(`[Index] Using Directus CLI script at: ${directusScript}`);

// Spawn 'node' with the script as argument
const directus = spawn(process.execPath, [directusScript, 'start'], {
    stdio: 'inherit',
    shell: false,
    env: process.env
});

directus.on('error', (err) => {
    console.error('[Index] Failed to start Directus:', err);
});

directus.on('close', (code) => {
    console.log(`[Index] Directus process exited with code ${code}`);
    if (code !== 0) {
        process.exit(code);
    }
});
