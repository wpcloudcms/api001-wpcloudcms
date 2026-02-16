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
    console.log('🔧 Starting Invoices Repair...');

    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    // 1. Delete existing (if any)
    console.log('🗑️ Cleaning up existing Invoices metadata...');
    await api('DELETE', '/collections/invoices', null, token);
    await api('DELETE', '/collections/invoices_services', null, token);

    // 2. Create Invoices Collection
    console.log('📄 Creating Invoices collection...');
    const createR = await api('POST', '/collections', {
        collection: 'invoices',
        meta: { icon: 'receipt_long', display_template: '{{invoice_id}}' },
        schema: {} // This creates the table with standard fields if any, or just empty
    }, token);

    if (createR.status !== 200) {
        console.log('❌ Failed to create collection:', createR.data);
    }

    // 3. Add Fields with EXPLICIT schema
    console.log('📝 Adding fields...');
    const fields = [
        { field: 'invoice_id', type: 'string', schema: {}, meta: { interface: 'input', required: true, width: 'half' } },
        { field: 'status', type: 'string', schema: {}, meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Draft', value: 'Draft' }, { text: 'Sent', value: 'Sent' }, { text: 'Paid', value: 'Paid' }] } } },
        { field: 'date_from', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half' } },
        { field: 'date_to', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half' } },
        { field: 'total_amount', type: 'decimal', schema: {}, meta: { interface: 'numeric', options: { precision: 2 }, width: 'half' } },
        { field: 'customer_id', type: 'integer', schema: {}, meta: { interface: 'select-dropdown-m2o', width: 'half' } },
        { field: 'project_id', type: 'integer', schema: {}, meta: { interface: 'select-dropdown-m2o', width: 'half' } }
    ];

    for (const f of fields) {
        await api('POST', '/fields/invoices', f, token);
    }

    // 4. Create Junction & M2M
    console.log('🔗 Setting up M2M Services...');
    await api('POST', '/collections', { collection: 'invoices_services', meta: { hidden: true }, schema: {} }, token);
    await api('POST', '/fields/invoices_services', { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }, token);
    await api('POST', '/fields/invoices_services', { field: 'invoices_id', type: 'integer', schema: {} }, token);
    await api('POST', '/fields/invoices_services', { field: 'services_id', type: 'integer', schema: {} }, token);

    await api('POST', '/relations', { collection: 'invoices_services', field: 'invoices_id', related_collection: 'invoices', meta: { one_field: 'services' }, schema: { on_delete: 'CASCADE' } }, token);
    await api('POST', '/relations', { collection: 'invoices_services', field: 'services_id', related_collection: 'services', schema: { on_delete: 'CASCADE' } }, token);

    await api('POST', '/fields/invoices', { field: 'services', type: 'alias', meta: { interface: 'list-m2m', special: ['m2m'] } }, token);

    // 5. Normal Relations
    await api('POST', '/relations', { collection: 'invoices', field: 'customer_id', related_collection: 'customers', schema: { on_delete: 'SET NULL' } }, token);
    await api('POST', '/relations', { collection: 'invoices', field: 'project_id', related_collection: 'projects', schema: { on_delete: 'SET NULL' } }, token);

    console.log('✅ Re-seeding Invoices...');
    // Fetch some basic data to link
    const projs = (await api('GET', '/items/projects?limit=3', null, token)).data.data;
    const srvs = (await api('GET', '/items/services?limit=1', null, token)).data.data;

    for (let i = 0; i < projs.length; i++) {
        const p = projs[i];
        const inv = await api('POST', '/items/invoices', {
            invoice_id: 'INV-100' + (i + 1),
            status: 'Draft',
            date_from: '2026-02-01',
            date_to: '2026-02-28',
            total_amount: 1200.50,
            customer_id: p.customer_id,
            project_id: p.id
        }, token);

        if (inv.data?.data?.id && srvs.length) {
            await api('POST', '/items/invoices_services', {
                invoices_id: inv.data.data.id,
                services_id: srvs[0].id
            }, token);
        }
    }

    console.log('✨ Invoices system repaired and seeded!');
}

main();
