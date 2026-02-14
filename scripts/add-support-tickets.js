/**
 * Add support_tickets collection to Directus
 * M2O: support_tickets → customers, projects, developers
 * O2M reverse: projects.support_tickets
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

async function main() {
    console.log('🔐 Authenticating...');
    const auth = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    });
    if (auth.status !== 200) throw new Error('Auth failed');
    TOKEN = auth.data.data.access_token;
    console.log('✅ Authenticated\n');

    // Check existing
    const cols = await api('GET', '/collections');
    const existing = (cols.data?.data || cols.data || []).filter(c => !c.collection.startsWith('directus_')).map(c => c.collection);
    console.log('Existing:', existing.join(', '));

    if (existing.includes('support_tickets')) {
        console.log('\n⚠️  support_tickets exists, deleting...');
        const del = await api('DELETE', '/collections/support_tickets');
        console.log('   Delete:', del.status);
    }

    // 1. Create collection
    console.log('\n📦 Creating support_tickets...');
    const cr = await api('POST', '/collections', {
        collection: 'support_tickets',
        meta: {
            icon: 'confirmation_number',
            note: 'Customer support tickets linked to projects and developers',
            display_template: '{{title}} ({{status}})',
        },
        schema: {},
    });
    console.log(cr.status === 200 ? '✅ Created' : '❌ ' + JSON.stringify(cr.data?.errors?.[0]?.message));
    if (cr.status !== 200) return;

    // 2. Fields
    console.log('\n📝 Adding fields...');
    const fields = [
        { field: 'status', type: 'string', schema: { default_value: 'Open', is_nullable: false }, meta: { interface: 'select-dropdown', required: true, options: { choices: [{ text: 'Open', value: 'Open' }, { text: 'In Progress', value: 'In Progress' }, { text: 'Resolved', value: 'Resolved' }, { text: 'Closed', value: 'Closed' }] }, width: 'half', sort: 2 } },
        { field: 'priority', type: 'string', schema: { default_value: 'Medium', is_nullable: false }, meta: { interface: 'select-dropdown', required: true, options: { choices: [{ text: 'Low', value: 'Low' }, { text: 'Medium', value: 'Medium' }, { text: 'High', value: 'High' }, { text: 'Urgent', value: 'Urgent' }] }, width: 'half', sort: 3 } },
        { field: 'date_created', type: 'timestamp', schema: {}, meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, sort: 4 } },
        { field: 'date_updated', type: 'timestamp', schema: {}, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, sort: 5 } },
        { field: 'title', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, sort: 6 } },
        { field: 'description', type: 'text', schema: {}, meta: { interface: 'input-rich-text-md', sort: 7 } },
    ];

    for (const f of fields) {
        const r = await api('POST', '/fields/support_tickets', f);
        console.log(`  ${r.status === 200 ? '✅' : '⚠️'} ${f.field}: ${r.status === 200 ? 'OK' : r.data?.errors?.[0]?.message || r.status}`);
    }

    // 3. M2O: customer_id → customers
    console.log('\n🔗 Relationships...');

    const cf = await api('POST', '/fields/support_tickets', {
        field: 'customer_id', type: 'uuid', schema: { is_nullable: true },
        meta: { interface: 'select-dropdown-m2o', display: 'related-values', display_options: { template: '{{customer_name}}' }, width: 'half', sort: 8 },
    });
    console.log(`  ${cf.status === 200 ? '✅' : '⚠️'} customer_id field: ${cf.status}`);

    const cr1 = await api('POST', '/relations', {
        collection: 'support_tickets', field: 'customer_id', related_collection: 'customers',
        schema: null, meta: { one_field: null, one_deselect_action: 'nullify' },
    });
    console.log(`  ${cr1.status === 200 ? '✅' : '⚠️'} customer_id → customers: ${cr1.status}`);

    // 4. M2O: project_id → projects + O2M reverse
    const pf = await api('POST', '/fields/support_tickets', {
        field: 'project_id', type: 'uuid', schema: { is_nullable: true },
        meta: { interface: 'select-dropdown-m2o', display: 'related-values', display_options: { template: '{{project_name}}' }, width: 'half', sort: 9 },
    });
    console.log(`  ${pf.status === 200 ? '✅' : '⚠️'} project_id field: ${pf.status}`);

    const pr1 = await api('POST', '/relations', {
        collection: 'support_tickets', field: 'project_id', related_collection: 'projects',
        schema: null, meta: { one_field: 'support_tickets', one_deselect_action: 'nullify' },
    });
    console.log(`  ${pr1.status === 200 ? '✅' : '⚠️'} project_id → projects: ${pr1.status}`);

    // O2M alias on projects
    const pstf = await api('POST', '/fields/projects', {
        field: 'support_tickets', type: 'alias',
        meta: { interface: 'list-o2m', special: ['o2m'], display: 'related-values', display_options: { template: '{{title}} ({{status}})' }, sort: 15 },
    });
    console.log(`  ${pstf.status === 200 ? '✅' : '⚠️'} projects.support_tickets (O2M): ${pstf.status}`);

    // 5. M2O: assigned_developer_id → developers
    const df = await api('POST', '/fields/support_tickets', {
        field: 'assigned_developer_id', type: 'uuid', schema: { is_nullable: true },
        meta: { interface: 'select-dropdown-m2o', display: 'related-values', display_options: { template: '{{developer_name}}' }, width: 'half', sort: 10 },
    });
    console.log(`  ${df.status === 200 ? '✅' : '⚠️'} assigned_developer_id field: ${df.status}`);

    const dr1 = await api('POST', '/relations', {
        collection: 'support_tickets', field: 'assigned_developer_id', related_collection: 'developers',
        schema: null, meta: { one_field: null, one_deselect_action: 'nullify' },
    });
    console.log(`  ${dr1.status === 200 ? '✅' : '⚠️'} assigned_developer_id → developers: ${dr1.status}`);

    // 6. Verify
    console.log('\n' + '='.repeat(50));
    console.log('📊 VERIFICATION');
    console.log('='.repeat(50));
    const f2 = await api('GET', '/fields/support_tickets');
    const fl = f2.data?.data || f2.data || [];
    console.log(`\nsupport_tickets (${fl.length} fields):`);
    fl.forEach(f => console.log('  ' + f.field + ' (' + f.type + ')'));

    const rels = await api('GET', '/relations');
    const stRels = (rels.data?.data || rels.data || []).filter(r => r.collection === 'support_tickets');
    console.log('\nRelations:');
    stRels.forEach(r => console.log('  ' + r.collection + '.' + r.field + ' → ' + r.related_collection));

    console.log('\n🎉 support_tickets created successfully!');
    console.log('\n💰 BILLING NOTE: No schema changes needed!');
    console.log('   Formula: Billable Amount = (SUM(time_logs.minutes) / 60) × developers.hourly_rate');
    console.log('   Data sources already in place: time_logs.minutes, time_logs.developer_id, developers.hourly_rate');
}

main().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
