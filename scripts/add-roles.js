/**
 * Add Roles Script
 * Programmatically adds Customer, Designer, Developer, Sales, Marketing, and Site Admin roles
 */

require('dotenv').config();
const { createDirectus, rest, authentication, readRoles, createRole } = require('@directus/sdk');

// Configuration
const DIRECTUS_URL = process.env.PUBLIC_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Initialize Directus client
const client = createDirectus(DIRECTUS_URL).with(authentication()).with(rest());

async function addRoles() {
    console.log('🚀 Starting role configuration...\n');

    try {
        // Authenticate
        console.log('🔐 Authenticating...');
        await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Authenticated successfully\n');

        // Roles to add
        const rolesToAdd = [
            { name: 'Customer', icon: 'person', description: 'Client access role' },
            { name: 'Designer', icon: 'palette', description: 'Design team role' },
            { name: 'Developer', icon: 'code', description: 'Development team role' },
            { name: 'Sales', icon: 'payments', description: 'Sales team role' },
            { name: 'Marketing', icon: 'campaign', description: 'Marketing team role' },
            { name: 'Site Admin', icon: 'settings', description: 'Site administration role (non-root)' }
        ];

        // Get existing roles to avoid duplicates
        console.log('🔍 Checking existing roles...');
        const existingRoles = await client.request(readRoles());
        const existingRoleNames = existingRoles.map(r => r.name);
        console.log(`  Found ${existingRoleNames.length} existing roles.\n`);

        // Create new roles
        for (const roleData of rolesToAdd) {
            if (existingRoleNames.includes(roleData.name)) {
                console.log(`  ℹ️  Role "${roleData.name}" already exists. Skipping.`);
                continue;
            }

            try {
                await client.request(createRole(roleData));
                console.log(`  ✅ Role "${roleData.name}" created.`);
            } catch (error) {
                console.error(`  ❌ Failed to create role "${roleData.name}":`, error.message);
            }
        }

        console.log('\n✅ Role configuration completed!');

    } catch (error) {
        console.error('❌ Error during role configuration:', error.message);
        process.exit(1);
    }
}

addRoles();
