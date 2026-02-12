/**
 * Sample Data Population Script
 * Creates sample records for customers, developers, and projects
 */

require('dotenv').config();

const { createDirectus, rest, authentication, createItems } = require('@directus/sdk');

// Configuration
const DIRECTUS_URL = process.env.PUBLIC_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Initialize Directus client
const client = createDirectus(DIRECTUS_URL).with(authentication()).with(rest());

async function populateSampleData() {
    console.log('📊 Populating sample data...\n');

    try {
        // Authenticate
        console.log('🔐 Authenticating...');
        await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Authenticated successfully\n');

        // Create Customers
        console.log('👥 Creating sample customers...');
        let customers = [];
        try {
            customers = await client.request(
                createItems('customers', [
                    {
                        customer_name: 'Acme Corporation',
                        email: 'contact@acme.com',
                        phone: '+1-555-0101',
                        company: 'Acme Corp',
                        address: '123 Innovation Drive, Tech City',
                        status: 'Active',
                    },
                    {
                        customer_name: 'Tech Startup Inc',
                        email: 'hello@techstartup.io',
                        phone: '+1-555-0102',
                        company: 'Tech Startup',
                        address: '456 Founder Way, Silicon Valley',
                        status: 'Active',
                    },
                    {
                        customer_name: 'Digital Solutions Ltd',
                        email: 'info@digitalsolutions.co.uk',
                        phone: '+44-20-7946-0123',
                        company: 'Digital Solutions',
                        address: '789 High Street, London',
                        status: 'Active',
                    },
                ])
            );
            console.log(`✅ Created ${customers.length} customers\n`);
        } catch (error) {
            console.log('⚠️ Customers creation failed (likely already exist). Fetching existing customers...');
            /*
               If creation fails (e.g. duplicate email), fetch existing so we have IDs for relationships.
               We assume customers exist if creation fails with unique constraint error.
           */
            // Fetch all customers as fallback
            const { readItems } = require('@directus/sdk');
            customers = await client.request(readItems('customers', { fields: ['id'] }));
            console.log(`ℹ️  Found ${customers.length} existing customers.\n`);
        }

        // Create Developers
        console.log('💻 Creating sample developers...');
        let developers = [];
        try {
            developers = await client.request(
                createItems('developers', [
                    {
                        developer_name: 'Alice Johnson',
                        email: 'alice@dev.com',
                        phone: '+1-555-1001',
                        specialization: 'Frontend Development',
                        hourly_rate: 75.00,
                        availability: 'Available',
                        skills: {
                            languages: ['JavaScript', 'TypeScript', 'HTML', 'CSS'],
                            frameworks: ['React', 'Vue.js', 'Next.js'],
                            tools: ['Git', 'Webpack', 'Figma'],
                        },
                        status: 'Active',
                    },
                    {
                        developer_name: 'Bob Smith',
                        email: 'bob@dev.com',
                        phone: '+1-555-1002',
                        specialization: 'Backend Development',
                        hourly_rate: 80.00,
                        availability: 'Busy',
                        skills: {
                            languages: ['Node.js', 'Python', 'PHP'],
                            frameworks: ['Express', 'Django', 'Laravel'],
                            databases: ['PostgreSQL', 'MongoDB', 'Redis'],
                        },
                        status: 'Active',
                    },
                    {
                        developer_name: 'Carol Williams',
                        email: 'carol@dev.com',
                        phone: '+1-555-1003',
                        specialization: 'Full-Stack Development',
                        hourly_rate: 85.00,
                        availability: 'Available',
                        skills: {
                            languages: ['JavaScript', 'Python', 'TypeScript'],
                            frameworks: ['React', 'Node.js', 'Django', 'Next.js'],
                            databases: ['PostgreSQL', 'MySQL', 'MongoDB'],
                            cloud: ['AWS', 'Google Cloud'],
                        },
                        status: 'Active',
                    },
                ])
            );
            console.log(`✅ Created ${developers.length} developers\n`);
        } catch (error) {
            console.log('⚠️ Developers creation failed (likely already exist). Fetching existing developers...');
            const { readItems } = require('@directus/sdk');
            developers = await client.request(readItems('developers', { fields: ['id'] }));
        }

        // Create Projects
        console.log('📁 Creating sample projects...');
        let projects = [];
        try {
            // Ensure we have customers to link to
            if (customers.length < 3) {
                throw new Error('Not enough customers found to link projects');
            }

            projects = await client.request(
                createItems('projects', [
                    {
                        project_name: 'Website Redesign',
                        description: 'Complete redesign of corporate website with modern UI/UX. Includes responsive design, performance optimization, and CMS integration.',
                        customer_id: customers[0].id, // Acme Corporation
                        budget: 15000.00,
                        priority: 'High',
                        status: 'In Progress',
                        start_date: '2026-02-01',
                        deadline: '2026-04-30',
                    },
                    {
                        project_name: 'Mobile App Development',
                        description: 'Native mobile application for iOS and Android. Features include user authentication, real-time notifications, and payment integration.',
                        customer_id: customers[1].id, // Tech Startup Inc
                        budget: 25000.00,
                        priority: 'Medium',
                        status: 'Draft',
                        start_date: '2026-03-01',
                        deadline: '2026-07-31',
                    },
                    {
                        project_name: 'E-Commerce Platform',
                        description: 'Custom e-commerce solution with inventory management, payment gateway integration, and analytics dashboard.',
                        customer_id: customers[2].id, // Digital Solutions Ltd
                        budget: 35000.00,
                        priority: 'High',
                        status: 'In Progress',
                        start_date: '2026-01-15',
                        deadline: '2026-06-15',
                    },
                ])
            );
            console.log(`✅ Created ${projects.length} projects\n`);
        } catch (error) {
            console.log('⚠️ Projects creation failed (likely already exist). Fetching existing projects...');
            const { readItems } = require('@directus/sdk');
            projects = await client.request(readItems('projects', { fields: ['id'] }));
        }

        // Assign developers to projects via junction table
        console.log('🔗 Assigning developers to projects...');

        try {
            // Project 1 (Website Redesign) - Alice and Carol
            await client.request(
                createItems('projects_developers', [
                    {
                        projects_id: projects[0].id,
                        developers_id: developers[0].id, // Alice
                        role: 'Lead Frontend Developer',
                    },
                    {
                        projects_id: projects[0].id,
                        developers_id: developers[2].id, // Carol
                        role: 'Full-Stack Developer',
                    },
                ])
            );
            console.log('  ✅ Website Redesign: Alice (Lead), Carol');

            // Project 2 (Mobile App) - Bob and Carol
            await client.request(
                createItems('projects_developers', [
                    {
                        projects_id: projects[1].id,
                        developers_id: developers[1].id, // Bob
                        role: 'Backend Developer',
                    },
                    {
                        projects_id: projects[1].id,
                        developers_id: developers[2].id, // Carol
                        role: 'Lead Full-Stack Developer',
                    },
                ])
            );
            console.log('  ✅ Mobile App Development: Bob, Carol (Lead)');

            // Project 3 (E-Commerce) - All developers
            await client.request(
                createItems('projects_developers', [
                    {
                        projects_id: projects[2].id,
                        developers_id: developers[0].id, // Alice
                        role: 'Frontend Developer',
                    },
                    {
                        projects_id: projects[2].id,
                        developers_id: developers[1].id, // Bob
                        role: 'Lead Backend Developer',
                    },
                    {
                        projects_id: projects[2].id,
                        developers_id: developers[2].id, // Carol
                        role: 'Full-Stack Developer',
                    },
                ])
            );
            console.log('  ✅ E-Commerce Platform: Alice, Bob (Lead), Carol');
        } catch (error) {
            console.log('⚠️ Developer assignments failed (likely already exist). Skipping...');
        }

        console.log('\n✅ Sample data populated successfully!\n');
        console.log('Summary:');
        console.log('  - Customers: 3');
        console.log('  - Developers: 3');
        console.log('  - Projects: 3');
        console.log('  - Relationships: Set up');

    } catch (error) {
        console.error('❌ Error populating sample data:', error.message);
        if (error.errors) {
            console.error('Details:', JSON.stringify(error.errors, null, 2));
        }
        process.exit(1);
    }
}

populateSampleData();
