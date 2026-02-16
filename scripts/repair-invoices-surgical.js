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
    console.log('🔧 Starting Surgical Invoices Repair...');

    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    // 1. Delete problematic fields any relations
    console.log('🗑️ Deleting existing fields and relations...');
    const fieldsToDelete = ['services', 'total_amount', 'date_to', 'date_from', 'status', 'invoice_id', 'customer_id', 'project_id'];
    for (const f of fieldsToDelete) {
        await api('DELETE', `/fields/invoices/${f}`, null, token);
    }

    // Also clean up relations
    const rels = (await api('GET', '/relations', null, token)).data.data;
    const invRels = rels.filter(r => r.collection === 'invoices' || r.related_collection === 'invoices' || r.collection === 'invoices_services');
    for (const r of invRels) {
        // relations don't have a simple ID-based delete in API always, usually by collection/field
        await api('DELETE', `/relations/${r.collection}/${r.field}`, null, token);
    }

    // 2. Ensure Primary Key is correct
    console.log('🆔 Configuring Primary Key...');
    await api('PATCH', '/fields/invoices/id', {
        schema: { is_primary_key: true, has_auto_increment: true }
    }, token);

    // 3. Re-add fields correctly
    console.log('📝 Re-adding fields...');
    const fieldsToAdd = [
        { field: 'invoice_id', type: 'string', schema: {}, meta: { interface: 'input', required: true, width: 'half' } },
        { field: 'status', type: 'string', schema: {}, meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Draft', value: 'Draft' }, { text: 'Sent', value: 'Sent' }, { text: 'Paid', value: 'Paid' }] } } },
        { field: 'date_from', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half' } },
        { field: 'date_to', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half' } },
        { field: 'total_amount', type: 'decimal', schema: {}, meta: { interface: 'numeric', options: { precision: 2 }, width: 'half' } },
        { field: 'customer_id', type: 'integer', schema: {}, meta: { interface: 'select-dropdown-m2o', width: 'half' } },
        { field: 'project_id', type: 'integer', schema: {}, meta: { interface: 'select-dropdown-m2o', width: 'half' } }
    ];

    for (const f of fieldsToAdd) {
        const res = await api('POST', '/fields/invoices', f, token);
        if (res.status !== 200) console.log(`⚠️ Warning: Failed to add ${f.field}:`, res.data);
    }

    // 4. M2M Services
    console.log('🔗 Re-establishing M2M Services...');
    // Ensure junction exists
    await api('POST', '/collections', { collection: 'invoices_services', meta: { hidden: true }, schema: {} }, token);
    await api('POST', '/fields/invoices_services', { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }, token);
    await api('POST', '/fields/invoices_services', { field: 'invoices_id', type: 'integer', schema: {} }, token);
    await api('POST', '/fields/invoices_services', { field: 'services_id', type: 'integer', schema: {} }, token);

    await api('POST', '/relations', { collection: 'invoices_services', field: 'invoices_id', related_collection: 'invoices', meta: { one_field: 'services' }, schema: { on_delete: 'CASCADE' } }, token);
    await api('POST', '/relations', { collection: 'invoices_services', field: 'services_id', related_collection: 'services', schema: { on_delete: 'CASCADE' } }, token);

    await api('POST', '/fields/invoices', { field: 'services', type: 'alias', meta: { interface: 'list-m2m', special: ['m2m'] } }, token);

    // 5. Relations
    await api('POST', '/relations', { collection: 'invoices', field: 'customer_id', related_collection: 'customers', schema: { on_delete: 'SET NULL' } }, token);
    await api('POST', '/relations', { collection: 'invoices', field: 'project_id', related_collection: 'projects', schema: { on_delete: 'SET NULL' } }, token);

    console.log('✅ Surgical repair finished!');
}

main();
