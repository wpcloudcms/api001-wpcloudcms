/**
 * Permissions Setup Script
 * Configures role-based access control for Public and Administrator roles
 */

require('dotenv').config();

const { createDirectus, rest, authentication, readRoles, createPermission } = require('@directus/sdk');

// Configuration
const DIRECTUS_URL = process.env.PUBLIC_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Initialize Directus client
const client = createDirectus(DIRECTUS_URL).with(authentication()).with(rest());

async function setupPermissions() {
    console.log('🚀 Starting permissions setup...\n');

    try {
        // Authenticate
        console.log('🔐 Authenticating...');
        await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Authenticated successfully\n');

        // Get Public Role - actually, Public role ID is always null in Directus permissions
        const publicRoleId = null;

        // Define permissions for Public role
        const permissions = [
            {
                role: publicRoleId,
                collection: 'projects',
                action: 'create',
                permissions: {}, // specific field permissions can be added here
                validation: {},
                fields: ['*'], // Allow all fields for now
            },
            {
                role: publicRoleId,
                collection: 'customers',
                action: 'read',
                permissions: {},
                validation: {},
                fields: ['*'],
            },
            {
                role: publicRoleId,
                collection: 'developers',
                action: 'read',
                permissions: {},
                validation: {},
                fields: ['*'],
            },
        ];

        // Apply permissions
        console.log('🛡️  Applying permissions for Public role...');
        for (const permission of permissions) {
            try {
                await client.request(createPermission(permission));
                console.log(`  ✅ ${permission.collection}: ${permission.action.toUpperCase()}`);
            } catch (error) {
                const errorMessage = error.message || JSON.stringify(error);
                if (errorMessage.includes('already exists')) {
                    console.log(`  ℹ️  ${permission.collection}: ${permission.action.toUpperCase()} (already exists)`);
                } else if (error.errors && error.errors[0]?.extensions?.code === 'RECORD_NOT_UNIQUE') {
                    console.log(`  ℹ️  ${permission.collection}: ${permission.action.toUpperCase()} (already exists - code check)`);
                } else {
                    console.error(`  ❌ Failed to create permission for ${permission.collection}:`, errorMessage);
                    // Don't throw, just log and continue to try other permissions
                }
            }
        }

        console.log('\n✅ Permissions setup completed successfully!');
        console.log('Summary:');
        console.log('  - Administrator: Full CRUD (default)');
        console.log('  - Public Role:');
        console.log('    - projects: CREATE');
        console.log('    - customers: READ');
        console.log('    - developers: READ');

    } catch (error) {
        console.error('❌ Error during permissions setup:', error.message);
        process.exit(1);
    }
}

setupPermissions();
