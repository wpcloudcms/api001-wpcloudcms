// Set environment variables BEFORE importing Directus
process.env.PORT = process.env.PORT || '3000';
process.env.HOST = process.env.HOST || '0.0.0.0';

console.log(`[Directus] Starting on ${process.env.HOST}:${process.env.PORT}...`);
console.log(`[Directus] DB_HOST: ${process.env.DB_HOST}`);
console.log(`[Directus] PUBLIC_URL: ${process.env.PUBLIC_URL}`);

// Set process.argv so Directus CLI receives the "start" command
process.argv = [process.execPath, 'directus', 'start'];

// Import Directus CLI directly (runs in THIS process, opens port here)
import('./node_modules/directus/cli.js').catch((err) => {
    console.error('[Directus] Failed to start:', err);
    process.exit(1);
});
