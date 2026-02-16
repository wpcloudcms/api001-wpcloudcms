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
    console.log('🚀 Setting up Support Tickets <-> Tasks M2M Relationship...');

    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    // 1. Create Junction Collection
    console.log('📂 Creating junction collection...');
    await api('POST', '/collections', {
        collection: 'support_tickets_tasks',
        meta: { hidden: true },
        schema: {}
    }, token);

    // 2. Add Junction Fields
    console.log('📝 Adding junction fields...');
    await api('POST', '/fields/support_tickets_tasks', { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }, token);
    await api('POST', '/fields/support_tickets_tasks', { field: 'support_tickets_id', type: 'integer', schema: {} }, token);
    await api('POST', '/fields/support_tickets_tasks', { field: 'tasks_id', type: 'integer', schema: {} }, token);

    // 3. Create Relations
    console.log('🔗 Creating relations...');
    // Left side: Support Tickets
    await api('POST', '/relations', {
        collection: 'support_tickets_tasks',
        field: 'support_tickets_id',
        related_collection: 'support_tickets',
        meta: { one_field: 'tasks', sort_field: null },
        schema: { on_delete: 'CASCADE' }
    }, token);

    // Right side: Tasks
    await api('POST', '/relations', {
        collection: 'support_tickets_tasks',
        field: 'tasks_id',
        related_collection: 'tasks',
        meta: { one_field: 'support_tickets', sort_field: null },
        schema: { on_delete: 'CASCADE' }
    }, token);

    // 4. Add Alias Fields for UI
    console.log('🖼️ Adding UI alias fields...');
    await api('POST', '/fields/support_tickets', {
        field: 'tasks',
        type: 'alias',
        meta: {
            interface: 'list-m2m',
            special: ['m2m'],
            options: {
                template: '{{tasks_id.name}}'
            }
        }
    }, token);

    await api('POST', '/fields/tasks', {
        field: 'support_tickets',
        type: 'alias',
        meta: {
            interface: 'list-m2m',
            special: ['m2m'],
            options: {
                template: '{{support_tickets_id.title}}'
            }
        }
    }, token);

    console.log('✨ M2M Relationship established successfully!');
}

main().catch(console.error);
