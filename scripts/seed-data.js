/**
 * Seed sample data + create Directus Insights dashboard
 * Populates: customers, developers, projects, projects_developers, time_logs, support_tickets
 * Creates: Insights dashboard with metric panels
 */

require('dotenv').config();
const http = require('http');
const https = require('https');

const BASE = process.env.PUBLIC_URL || 'http://localhost:8055';
let TOKEN = '';

function api(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const lib = url.protocol === 'https:' ? https : http;
        const opts = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
        const bs = body ? JSON.stringify(body) : null;
        if (bs) opts.headers['Content-Length'] = Buffer.byteLength(bs);

        const req = lib.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });
        req.on('error', reject);
        if (bs) req.write(bs);
        req.end();
    });
}

async function createItems(collection, items) {
    const results = [];
    for (const item of items) {
        const r = await api('POST', `/items/${collection}`, item);
        if (r.status === 200 || r.status === 204) {
            results.push(r.data?.data || r.data);
            console.log(`  ✅ ${collection}: ${item.customer_name || item.developer_name || item.project_name || item.title || item.role || item.minutes + 'm' || 'created'}`);
        } else {
            console.log(`  ⚠️  ${collection}: ${r.data?.errors?.[0]?.message || r.status}`);
        }
    }
    return results;
}

async function main() {
    console.log('🔐 Authenticating...');
    const auth = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    });
    if (auth.status !== 200) throw new Error('Auth failed');
    TOKEN = auth.data.data.access_token;
    console.log('✅ Authenticated\n');

    // ========== 1. CUSTOMERS ==========
    console.log('👥 Seeding customers...');
    const customers = await createItems('customers', [
        { customer_name: 'Aarya ITS', email: 'info@aaryaits.com', phone: '+91-9876543210', company: 'Aarya IT Solutions', status: 'Active', notes: 'Primary client - web development projects' },
        { customer_name: 'TechVista Corp', email: 'contact@techvista.com', phone: '+91-8765432109', company: 'TechVista Corporation', status: 'Active', notes: 'E-commerce platform projects' },
        { customer_name: 'GreenLeaf Digital', email: 'hello@greenleaf.io', phone: '+91-7654321098', company: 'GreenLeaf Digital Agency', status: 'Active', notes: 'Marketing website projects' },
        { customer_name: 'StartupHub', email: 'admin@startuphub.in', phone: '+91-6543210987', company: 'StartupHub Incubator', status: 'Inactive', notes: 'MVP development - on hold' },
    ]);

    // ========== 2. DEVELOPERS ==========
    console.log('\n💻 Seeding developers...');
    const developers = await createItems('developers', [
        { developer_name: 'Ramki R', email: 'ramki.r@aaryaits.com', phone: '+91-9000000001', specialization: 'Full Stack', hourly_rate: 75.00, availability: 'Available', status: 'Active', skills: ['Vue.js', 'Nuxt', 'Node.js', 'WordPress', 'Directus'] },
        { developer_name: 'Priya S', email: 'priya.s@aaryaits.com', phone: '+91-9000000002', specialization: 'Frontend', hourly_rate: 55.00, availability: 'Busy', status: 'Active', skills: ['React', 'Vue.js', 'Tailwind', 'Figma'] },
        { developer_name: 'Arjun K', email: 'arjun.k@aaryaits.com', phone: '+91-9000000003', specialization: 'Backend', hourly_rate: 65.00, availability: 'Available', status: 'Active', skills: ['Node.js', 'Python', 'MySQL', 'Docker'] },
        { developer_name: 'Meena V', email: 'meena.v@aaryaits.com', phone: '+91-9000000004', specialization: 'DevOps', hourly_rate: 70.00, availability: 'Available', status: 'Active', skills: ['AWS', 'Docker', 'CI/CD', 'Linux'] },
    ]);

    // ========== 3. PROJECTS ==========
    console.log('\n📁 Seeding projects...');
    const projects = await createItems('projects', [
        { project_name: 'AITS Dashboard', description: 'Internal project management dashboard with Nuxt.js + Directus', status: 'In Progress', priority: 'High', budget: 15000.00, customer_id: customers[0]?.id, start_date: '2025-01-15', deadline: '2025-04-30' },
        { project_name: 'TechVista E-Commerce', description: 'Full e-commerce platform with payment gateway integration', status: 'In Progress', priority: 'High', budget: 35000.00, customer_id: customers[1]?.id, start_date: '2025-02-01', deadline: '2025-06-30' },
        { project_name: 'GreenLeaf Marketing Site', description: 'Corporate marketing website with CMS', status: 'Draft', priority: 'Medium', budget: 8000.00, customer_id: customers[2]?.id, start_date: '2025-03-01', deadline: '2025-05-15' },
        { project_name: 'StartupHub MVP', description: 'Minimum viable product for startup incubator platform', status: 'Cancelled', priority: 'Low', budget: 12000.00, customer_id: customers[3]?.id, start_date: '2025-01-01', end_date: '2025-02-15' },
        { project_name: 'API Gateway Microservice', description: 'Centralized API gateway for all client services', status: 'Completed', priority: 'High', budget: 10000.00, customer_id: customers[0]?.id, start_date: '2024-10-01', end_date: '2024-12-20' },
    ]);

    // ========== 4. PROJECTS_DEVELOPERS (junction) ==========
    console.log('\n🔗 Assigning developers to projects...');
    if (projects[0]?.id && developers[0]?.id) {
        await createItems('projects_developers', [
            { projects_id: projects[0].id, developers_id: developers[0].id, role: 'Lead' },
            { projects_id: projects[0].id, developers_id: developers[1].id, role: 'Contributor' },
            { projects_id: projects[1].id, developers_id: developers[0].id, role: 'Contributor' },
            { projects_id: projects[1].id, developers_id: developers[2].id, role: 'Lead' },
            { projects_id: projects[1].id, developers_id: developers[3].id, role: 'Contributor' },
            { projects_id: projects[2].id, developers_id: developers[1].id, role: 'Lead' },
            { projects_id: projects[4].id, developers_id: developers[2].id, role: 'Lead' },
            { projects_id: projects[4].id, developers_id: developers[3].id, role: 'Contributor' },
        ]);
    }

    // ========== 5. TIME_LOGS ==========
    console.log('\n⏱️  Seeding time logs...');
    if (projects[0]?.id && developers[0]?.id) {
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }

        await createItems('time_logs', [
            // Ramki on AITS Dashboard
            { project_id: projects[0].id, developer_id: developers[0].id, minutes: 120, log_date: dates[0], notes: 'Dashboard layout and component structure' },
            { project_id: projects[0].id, developer_id: developers[0].id, minutes: 180, log_date: dates[1], notes: 'Directus API integration' },
            { project_id: projects[0].id, developer_id: developers[0].id, minutes: 90, log_date: dates[2], notes: 'Authentication flow' },
            { project_id: projects[0].id, developer_id: developers[0].id, minutes: 240, log_date: dates[5], notes: 'Time tracking module' },
            // Priya on AITS Dashboard
            { project_id: projects[0].id, developer_id: developers[1].id, minutes: 150, log_date: dates[1], notes: 'UI component design' },
            { project_id: projects[0].id, developer_id: developers[1].id, minutes: 60, log_date: dates[3], notes: 'Responsive layout fixes' },
            // Ramki on TechVista
            { project_id: projects[1].id, developer_id: developers[0].id, minutes: 60, log_date: dates[4], notes: 'Payment gateway research' },
            // Arjun on TechVista
            { project_id: projects[1].id, developer_id: developers[2].id, minutes: 300, log_date: dates[0], notes: 'Product catalog API' },
            { project_id: projects[1].id, developer_id: developers[2].id, minutes: 240, log_date: dates[2], notes: 'Cart and checkout backend' },
            { project_id: projects[1].id, developer_id: developers[2].id, minutes: 180, log_date: dates[6], notes: 'Order management system' },
            // Meena on TechVista
            { project_id: projects[1].id, developer_id: developers[3].id, minutes: 120, log_date: dates[1], notes: 'Docker setup and CI/CD pipeline' },
            { project_id: projects[1].id, developer_id: developers[3].id, minutes: 90, log_date: dates[7], notes: 'AWS deployment config' },
            // Priya on GreenLeaf
            { project_id: projects[2].id, developer_id: developers[1].id, minutes: 180, log_date: dates[3], notes: 'Homepage design implementation' },
            // Arjun on API Gateway (completed project)
            { project_id: projects[4].id, developer_id: developers[2].id, minutes: 360, log_date: dates[10], notes: 'API Gateway core implementation' },
            { project_id: projects[4].id, developer_id: developers[3].id, minutes: 240, log_date: dates[11], notes: 'Load balancer and rate limiting' },
        ]);
    }

    // ========== 6. SUPPORT_TICKETS ==========
    console.log('\n🎫 Seeding support tickets...');
    if (projects[0]?.id && customers[0]?.id && developers[0]?.id) {
        await createItems('support_tickets', [
            { title: 'Dashboard not loading on mobile', description: 'The dashboard page crashes on iOS Safari', status: 'Open', priority: 'High', customer_id: customers[0].id, project_id: projects[0].id, assigned_developer_id: developers[1].id },
            { title: 'Login timeout too short', description: 'Users are being logged out after 5 minutes of inactivity', status: 'In Progress', priority: 'Medium', customer_id: customers[0].id, project_id: projects[0].id, assigned_developer_id: developers[0].id },
            { title: 'Payment gateway 500 error', description: 'Stripe checkout returns 500 intermittently', status: 'Open', priority: 'Urgent', customer_id: customers[1].id, project_id: projects[1].id, assigned_developer_id: developers[2].id },
            { title: 'Product images not displaying', description: 'Thumbnails show broken image icons in catalog', status: 'Resolved', priority: 'Medium', customer_id: customers[1].id, project_id: projects[1].id, assigned_developer_id: developers[2].id },
            { title: 'SEO meta tags missing', description: 'Pages missing Open Graph and meta description tags', status: 'Open', priority: 'Low', customer_id: customers[2].id, project_id: projects[2].id, assigned_developer_id: developers[1].id },
            { title: 'SSL certificate renewal', description: 'SSL cert expiring in 7 days, needs renewal', status: 'Closed', priority: 'High', customer_id: customers[0].id, project_id: projects[4].id, assigned_developer_id: developers[3].id },
            { title: 'API rate limiting not working', description: 'Rate limiter allows unlimited requests', status: 'In Progress', priority: 'High', customer_id: customers[0].id, project_id: projects[4].id, assigned_developer_id: developers[2].id },
        ]);
    }

    // ========== 7. INSIGHTS DASHBOARD ==========
    console.log('\n📊 Creating Insights dashboard...');

    // Create the dashboard
    const dash = await api('POST', '/dashboards', {
        name: 'Project & Billing Metrics',
        icon: 'dashboard',
        note: 'Overview of projects, time tracking, tickets, and billing',
        color: '#6644FF',
    });

    if (dash.status !== 200) {
        console.log('  ⚠️  Dashboard:', dash.data?.errors?.[0]?.message || dash.status);
    } else {
        const dashId = dash.data.data.id;
        console.log('  ✅ Dashboard created:', dashId);

        // Create panels
        const panels = [
            // Row 1: Overview metrics
            { dashboard: dashId, name: 'Total Projects', icon: 'work', color: '#2ECDA7', type: 'metric', position_x: 1, position_y: 1, width: 6, height: 5, options: { collection: 'projects', function: 'count' } },
            { dashboard: dashId, name: 'Total Customers', icon: 'people', color: '#FF6B6B', type: 'metric', position_x: 7, position_y: 1, width: 6, height: 5, options: { collection: 'customers', function: 'count' } },
            { dashboard: dashId, name: 'Active Developers', icon: 'code', color: '#4ECDC4', type: 'metric', position_x: 13, position_y: 1, width: 6, height: 5, options: { collection: 'developers', function: 'count', filter: { status: { _eq: 'Active' } } } },
            { dashboard: dashId, name: 'Total Time Logged (min)', icon: 'schedule', color: '#FFD93D', type: 'metric', position_x: 19, position_y: 1, width: 6, height: 5, options: { collection: 'time_logs', function: 'sum', field: 'minutes' } },

            // Row 2: Tickets & status
            { dashboard: dashId, name: 'Open Tickets', icon: 'bug_report', color: '#FF4444', type: 'metric', position_x: 1, position_y: 6, width: 6, height: 5, options: { collection: 'support_tickets', function: 'count', filter: { status: { _eq: 'Open' } } } },
            { dashboard: dashId, name: 'In Progress Tickets', icon: 'pending', color: '#FFA726', type: 'metric', position_x: 7, position_y: 6, width: 6, height: 5, options: { collection: 'support_tickets', function: 'count', filter: { status: { _eq: 'In Progress' } } } },
            { dashboard: dashId, name: 'Resolved Tickets', icon: 'check_circle', color: '#66BB6A', type: 'metric', position_x: 13, position_y: 6, width: 6, height: 5, options: { collection: 'support_tickets', function: 'count', filter: { status: { _eq: 'Resolved' } } } },
            { dashboard: dashId, name: 'All Tickets', icon: 'confirmation_number', color: '#AB47BC', type: 'metric', position_x: 19, position_y: 6, width: 6, height: 5, options: { collection: 'support_tickets', function: 'count' } },

            // Row 3: Lists
            { dashboard: dashId, name: 'Active Projects', icon: 'folder_open', color: '#26A69A', type: 'list', position_x: 1, position_y: 11, width: 12, height: 10, options: { collection: 'projects', limit: 10, sort: '-date_created', fields: ['project_name', 'status', 'priority', 'budget'], filter: { status: { _in: ['Draft', 'In Progress'] } } } },
            { dashboard: dashId, name: 'Recent Time Logs', icon: 'timer', color: '#5C6BC0', type: 'list', position_x: 13, position_y: 11, width: 12, height: 10, options: { collection: 'time_logs', limit: 10, sort: '-log_date', fields: ['minutes', 'log_date', 'notes'] } },

            // Row 4: More lists
            { dashboard: dashId, name: 'Urgent & High Priority Tickets', icon: 'priority_high', color: '#E53935', type: 'list', position_x: 1, position_y: 21, width: 24, height: 8, options: { collection: 'support_tickets', limit: 10, sort: '-date_created', fields: ['title', 'status', 'priority'], filter: { priority: { _in: ['High', 'Urgent'] } } } },
        ];

        for (const p of panels) {
            const pr = await api('POST', '/panels', p);
            console.log(`  ${pr.status === 200 ? '✅' : '⚠️'} ${p.name}: ${pr.status === 200 ? 'OK' : pr.data?.errors?.[0]?.message || pr.status}`);
        }
    }

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(50));
    console.log('📊 SAMPLE DATA SUMMARY');
    console.log('='.repeat(50));

    for (const col of ['customers', 'developers', 'projects', 'projects_developers', 'time_logs', 'support_tickets']) {
        const r = await api('GET', `/items/${col}?aggregate[count]=*`);
        const count = r.data?.data?.[0]?.count || '?';
        console.log(`  ${col}: ${count} items`);
    }

    console.log('\n🎉 Sample data seeded and Insights dashboard created!');
    console.log('📈 Open http://localhost:8055 → Insights to see the dashboard');
}

main().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
