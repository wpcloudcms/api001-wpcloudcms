/**
 * Schema Setup Script for AITS Directus Project
 * Creates all collections and relationships as per the schema guide
 */

require('dotenv').config();

const { createDirectus, rest, authentication, createCollection, createField, createRelation } = require('@directus/sdk');

// Configuration
const DIRECTUS_URL = process.env.PUBLIC_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Initialize Directus client
const client = createDirectus(DIRECTUS_URL).with(authentication()).with(rest());

async function setupSchema() {
    console.log('🚀 Starting schema setup...\n');

    try {
        // Authenticate
        console.log('🔐 Authenticating...');
        await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Authenticated successfully\n');

        // Create customers collection
        console.log('📦 Creating "customers" collection...');
        await client.request(
            createCollection({
                collection: 'customers',
                meta: {
                    icon: 'people',
                    note: 'Customer information and contact details',
                },
                schema: {
                    name: 'customers',
                },
                fields: [
                    {
                        field: 'id',
                        type: 'uuid',
                        meta: {
                            hidden: true,
                            readonly: true,
                            interface: 'input',
                            special: ['uuid'],
                        },
                        schema: {
                            is_primary_key: true,
                            has_auto_increment: false,
                        },
                    },
                ],
            })
        );

        // Add fields to customers
        const customerFields = [
            { field: 'status', type: 'string', schema: { default_value: 'Active' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }] }, width: 'half' } },
            { field: 'date_created', type: 'timestamp', schema: { default_value: 'now()' }, meta: { special: ['date-created'], interface: 'datetime', readonly: true, width: 'half' } },
            { field: 'date_updated', type: 'timestamp', schema: { default_value: 'now()' }, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, width: 'half' } },
            { field: 'customer_name', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, width: 'half' } },
            { field: 'email', type: 'string', schema: { is_nullable: false, is_unique: true }, meta: { interface: 'input', required: true, validation: { _and: [{ email: { _regex: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$' } }] }, width: 'half' } },
            { field: 'phone', type: 'string', meta: { interface: 'input', width: 'half' } },
            { field: 'company', type: 'string', meta: { interface: 'input', width: 'half' } },
            { field: 'address', type: 'text', meta: { interface: 'input-multiline' } },
            { field: 'notes', type: 'text', meta: { interface: 'input-rich-text-md' } },
        ];

        for (const fieldConfig of customerFields) {
            await client.request(createField('customers', fieldConfig));
        }
        console.log('✅ "customers" collection created\n');

        // Create developers collection
        console.log('📦 Creating "developers" collection...');
        await client.request(
            createCollection({
                collection: 'developers',
                meta: {
                    icon: 'code',
                    note: 'Developer profiles with skills and availability',
                },
                schema: {
                    name: 'developers',
                },
                fields: [
                    {
                        field: 'id',
                        type: 'uuid',
                        meta: {
                            hidden: true,
                            readonly: true,
                            interface: 'input',
                            special: ['uuid'],
                        },
                        schema: {
                            is_primary_key: true,
                            has_auto_increment: false,
                        },
                    },
                ],
            })
        );

        // Add fields to developers
        const developerFields = [
            { field: 'status', type: 'string', schema: { default_value: 'Active' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }] }, width: 'half' } },
            { field: 'date_created', type: 'timestamp', schema: { default_value: 'now()' }, meta: { special: ['date-created'], interface: 'datetime', readonly: true, width: 'half' } },
            { field: 'date_updated', type: 'timestamp', schema: { default_value: 'now()' }, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, width: 'half' } },
            { field: 'developer_name', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, width: 'half' } },
            { field: 'email', type: 'string', schema: { is_nullable: false, is_unique: true }, meta: { interface: 'input', required: true, validation: { _and: [{ email: { _regex: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$' } }] }, width: 'half' } },
            { field: 'phone', type: 'string', meta: { interface: 'input', width: 'half' } },
            { field: 'specialization', type: 'string', meta: { interface: 'input', width: 'half' } },
            { field: 'hourly_rate', type: 'decimal', meta: { interface: 'input', width: 'half' } },
            { field: 'availability', type: 'string', schema: { default_value: 'Available' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Available', value: 'Available' }, { text: 'Busy', value: 'Busy' }, { text: 'Unavailable', value: 'Unavailable' }] }, width: 'half' } },
            { field: 'skills', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
        ];

        for (const fieldConfig of developerFields) {
            await client.request(createField('developers', fieldConfig));
        }
        console.log('✅ "developers" collection created\n');

        // Create projects collection
        console.log('📦 Creating "projects" collection...');
        await client.request(
            createCollection({
                collection: 'projects',
                meta: {
                    icon: 'work',
                    note: 'Project management with budgets and deadlines',
                },
                schema: {
                    name: 'projects',
                },
                fields: [
                    {
                        field: 'id',
                        type: 'uuid',
                        meta: {
                            hidden: true,
                            readonly: true,
                            interface: 'input',
                            special: ['uuid'],
                        },
                        schema: {
                            is_primary_key: true,
                            has_auto_increment: false,
                        },
                    },
                ],
            })
        );

        // Add fields to projects
        const projectFields = [
            { field: 'status', type: 'string', schema: { default_value: 'Draft' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Draft', value: 'Draft' }, { text: 'In Progress', value: 'In Progress' }, { text: 'Completed', value: 'Completed' }, { text: 'Cancelled', value: 'Cancelled' }] }, width: 'half' } },
            { field: 'date_created', type: 'timestamp', schema: { default_value: 'now()' }, meta: { special: ['date-created'], interface: 'datetime', readonly: true, width: 'half' } },
            { field: 'date_updated', type: 'timestamp', schema: { default_value: 'now()' }, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, width: 'half' } },
            { field: 'project_name', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true } },
            { field: 'description', type: 'text', meta: { interface: 'input-rich-text-md' } },
            { field: 'budget', type: 'decimal', meta: { interface: 'input', width: 'half' } },
            { field: 'deadline', type: 'date', meta: { interface: 'datetime', width: 'half' } },
            { field: 'start_date', type: 'date', meta: { interface: 'datetime', width: 'half' } },
            { field: 'end_date', type: 'date', meta: { interface: 'datetime', width: 'half' } },
            { field: 'priority', type: 'string', schema: { default_value: 'Medium' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Low', value: 'Low' }, { text: 'Medium', value: 'Medium' }, { text: 'High', value: 'High' }] }, width: 'half' } },
        ];

        for (const fieldConfig of projectFields) {
            await client.request(createField('projects', fieldConfig));
        }
        console.log('✅ "projects" collection created\n');

        // Create projects_developers junction collection
        console.log('📦 Creating "projects_developers" junction collection...');
        await client.request(
            createCollection({
                collection: 'projects_developers',
                meta: {
                    icon: 'link',
                    hidden: true,
                    note: 'Junction table for project-developer relationships',
                },
                schema: {
                    name: 'projects_developers',
                },
                fields: [
                    {
                        field: 'id',
                        type: 'integer',
                        meta: {
                            hidden: true,
                            interface: 'input',
                        },
                        schema: {
                            is_primary_key: true,
                            has_auto_increment: true,
                        },
                    },
                ],
            })
        );

        // Add fields to junction
        const junctionFields = [
            { field: 'role', type: 'string', meta: { interface: 'input', note: 'e.g., Lead, Contributor' } },
            { field: 'assigned_date', type: 'timestamp', schema: { default_value: 'now()' }, meta: { interface: 'datetime', readonly: true } },
        ];

        for (const fieldConfig of junctionFields) {
            await client.request(createField('projects_developers', fieldConfig));
        }
        console.log('✅ "projects_developers" junction collection created\n');

        // Create relationships
        console.log('🔗 Creating relationships...');

        // Many-to-One: projects → customers
        await client.request(
            createField('projects', {
                field: 'customer_id',
                type: 'uuid',
                meta: {
                    interface: 'select-dropdown-m2o',
                    display: 'related-values',
                    display_options: {
                        template: '{{customer_name}}',
                    },
                },
                schema: {
                    foreign_key_table: 'customers',
                    foreign_key_column: 'id',
                },
            })
        );
        console.log('  ✅ projects → customers (Many-to-One)');

        // Many-to-One: projects_developers → projects
        await client.request(
            createField('projects_developers', {
                field: 'projects_id',
                type: 'uuid',
                meta: {
                    interface: 'select-dropdown-m2o',
                    hidden: true,
                },
                schema: {
                    foreign_key_table: 'projects',
                    foreign_key_column: 'id',
                    is_nullable: false,
                },
            })
        );
        console.log('  ✅ projects_developers → projects (Many-to-One)');

        // Many-to-One: projects_developers → developers
        await client.request(
            createField('projects_developers', {
                field: 'developers_id',
                type: 'uuid',
                meta: {
                    interface: 'select-dropdown-m2o',
                    hidden: true,
                },
                schema: {
                    foreign_key_table: 'developers',
                    foreign_key_column: 'id',
                    is_nullable: false,
                },
            })
        );
        console.log('  ✅ projects_developers → developers (Many-to-One)');

        // Many-to-Many alias field in projects
        await client.request(
            createField('projects', {
                field: 'developers',
                type: 'alias',
                meta: {
                    interface: 'list-m2m',
                    special: ['m2m'],
                    options: {
                        template: '{{developers_id.developer_name}}',
                    },
                },
                schema: {},
            })
        );
        console.log('  ✅ projects ↔ developers (Many-to-Many alias)\n');

        console.log('✅ Schema setup completed successfully!\n');
        console.log('Collections created:');
        console.log('  - customers');
        console.log('  - developers');
        console.log('  - projects');
        console.log('  - projects_developers (junction)');
        console.log('\nRelationships established:');
        console.log('  - projects → customers (Many-to-One)');
        console.log('  - projects ↔ developers (Many-to-Many)');

    } catch (error) {
        console.error('❌ Error during schema setup:', error.message);
        if (error.errors) {
            console.error('Details:', error.errors);
        }
        process.exit(1);
    }
}

// Run setup
setupSchema();
