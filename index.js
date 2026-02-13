// Directus launcher for Ploi.io / VPS deployment
// Sets environment variables and starts Directus in-process

process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '8055';

console.log(`[Directus] Starting on ${process.env.HOST}:${process.env.PORT}...`);
console.log(`[Directus] Node.js ${process.version}`);
console.log(`[Directus] DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`[Directus] PUBLIC_URL: ${process.env.PUBLIC_URL || 'NOT SET'}`);

// Set argv so Directus CLI receives the "start" command
process.argv = [process.execPath, 'directus', 'start'];

// Import Directus CLI directly (runs in THIS process)
import('./node_modules/directus/cli.js').catch((err) => {
    console.error('[Directus] Failed to start:', err);
    process.exit(1);
});
