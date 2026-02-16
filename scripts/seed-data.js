require('dotenv').config();
const http = require('http');
const BASE = process.env.PUBLIC_URL || 'http://127.0.0.1:8055';

async function api(method, path, body, token) {
    return new Promise((resolve) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + (url.search || ''),
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data }); }
            });
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('🚀 Seeding Clean Sample Data...');

    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    const collectionsToClear = ['payrolls', 'invoices', 'invoices_services', 'tasks', 'services'];

    for (const c of collectionsToClear) {
        console.log(`🧹 Clearing ${c}...`);
        const items = (await api('GET', `/items/${c}?limit=-1&fields=id`, null, token)).data.data;
        if (items && items.length) {
            const ids = items.map(i => i.id);
            await api('DELETE', `/items/${c}`, ids, token);
        }
    }

    // 1. Create Services
    console.log('🏷️ Seeding Services...');
    const services = [
        { name: 'SEO Optimization', price: 500, discount_type: 'Percentage', discount_value: 10, description: 'Monthly SEO and keywords ranking services' },
        { name: 'Security Audit', price: 1200, discount_type: 'Fixed', discount_value: 200, description: 'Full server and application security penetration test' },
        { name: 'Cloud Migration', price: 2500, discount_type: 'None', description: 'Assisting with AWS/GCP infrastructure migration' },
        { name: 'Maintenance Package', price: 300, discount_type: 'Fixed', discount_value: 50, description: 'General monthly maintenance and updates' }
    ];
    for (const s of services) {
        await api('POST', '/items/services', s, token);
    }

    // Get fresh IDs
    const ems = (await api('GET', '/items/employees?limit=-1', null, token)).data.data;
    const projs = (await api('GET', '/items/projects?limit=-1', null, token)).data.data;
    const srvs = (await api('GET', '/items/services?limit=-1', null, token)).data.data;

    // 3. Create Tasks
    console.log('📋 Seeding Tasks...');
    const taskNames = ['Implementation for Auth', 'API Gateway Design', 'Fix Bug in Login', 'Database Optimization', 'UI Performance Review'];
    for (const p of projs) {
        for (let i = 0; i < 3; i++) {
            await api('POST', '/items/tasks', {
                name: taskNames[Math.floor(Math.random() * taskNames.length)],
                project_id: p.id,
                employee_id: ems[Math.floor(Math.random() * ems.length)].id,
                status: ['To Do', 'In Progress', 'Done'][Math.floor(Math.random() * 3)],
                priority: ['Low', 'Normal', 'High'][Math.floor(Math.random() * 3)],
                deadline: '2026-03-31'
            }, token);
        }
    }

    // 4. Create Invoices
    console.log('📄 Seeding Invoices...');
    for (const p of projs) {
        const inv = await api('POST', '/items/invoices', {
            invoice_id: 'INV-' + Math.floor(1000 + Math.random() * 9000),
            customer_id: p.customer_id,
            project_id: p.id,
            total_amount: 1500 + Math.random() * 2000,
            status: 'Draft',
            date_from: '2026-01-01',
            date_to: '2026-01-31'
        }, token);

        if (inv.data?.data?.id) {
            await api('POST', '/items/invoices_services', {
                invoices_id: inv.data.data.id,
                services_id: srvs[Math.floor(Math.random() * srvs.length)].id
            }, token);
        }
    }

    // 5. Create Payrolls
    console.log('💸 Seeding Payrolls...');
    for (const e of ems) {
        await api('POST', '/items/payrolls', {
            employee_id: e.id,
            month: 1,
            year: 2026,
            total_minutes: 9600,
            hourly_rate: e.hourly_rate || 25,
            total_amount: (9600 / 60) * (e.hourly_rate || 25),
            status: 'Draft'
        }, token);
    }

    console.log('✅ Seeding Completed!');
}

main();
