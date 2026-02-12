const { execSync } = require('child_process');

console.log('Starting Directus...');
try {
    execSync('npx directus start', { stdio: 'inherit' });
} catch (error) {
    console.error('Failed to start Directus:', error);
    process.exit(1);
}
