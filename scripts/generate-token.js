/**
 * Generate API Token Script
 * Updates the Admin user with a static token for API access
 */

require('dotenv').config();

const { createDirectus, rest, authentication, readMe, updateUser } = require('@directus/sdk');

// Configuration
const DIRECTUS_URL = process.env.PUBLIC_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Initialize Directus client
const client = createDirectus(DIRECTUS_URL).with(authentication()).with(rest());

async function generateToken() {
    console.log('🔑 Generating API token...\n');

    try {
        // Authenticate
        await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);

        // Get current user (Admin)
        const user = await client.request(readMe());

        // Generate a random token or use a fixed one for testing
        // For local dev, a fixed one is easier to document, but random is better security.
        // Let's generate a strong random token.
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // Update user
        await client.request(updateUser(user.id, {
            token: token,
        }));

        console.log('✅ API Token generated successfully!');
        console.log(`\n👉 Token: ${token}`);
        console.log('\nCopy this token to your WordPress plugin settings or .env file.');

    } catch (error) {
        console.error('❌ Error generating token:', error.message);
        process.exit(1);
    }
}

generateToken();
