/**
 * Add time_logs collection to Directus
 * M2O: time_logs.project_id → projects, time_logs.developer_id → developers
 * O2M reverse: projects.time_logs, developers.time_logs
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
    // Login
    console.log('🔐 Authenticating...');
    const auth = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    });
    if (auth.status !== 200) throw new Error('Auth failed: ' + JSON.stringify(auth.data));
    TOKEN = auth.data.data.access_token;
    console.log('✅ Authenticated\n');

    // Check if time_logs exists
    const cols = await api('GET', '/collections');
    const existing = (cols.data?.data || cols.data || []).filter(c => !c.collection.startsWith('directus_')).map(c => c.collection);
    console.log('Existing collections:', existing.join(', '));

    if (existing.includes('time_logs')) {
        console.log('\n⚠️  time_logs already exists, deleting first...');
        const del = await api('DELETE', '/collections/time_logs');
        console.log('   Delete:', del.status);
    }

    // 1. Create collection
    console.log('\n📦 Creating time_logs collection...');
    const cr = await api('POST', '/collections', {
        collection: 'time_logs',
        meta: {
            icon: 'schedule',
            note: 'Developer time tracking per project',
            display_template: '{{developer_id.developer_name}} – {{project_id.project_name}} ({{minutes}}m)',
        },
        schema: {},
    });
    if (cr.status === 200) {
        console.log('✅ Collection created');
    } else {
        console.log('❌ Failed:', JSON.stringify(cr.data?.errors?.[0]?.message || cr.data));
        return;
    }

    // 2. Add fields
    console.log('\n📝 Adding fields...');
    const fields = [
        {
            field: 'date_created',
            type: 'timestamp',
            schema: {},
            meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, sort: 2 },
        },
        {
            field: 'date_updated',
            type: 'timestamp',
            schema: {},
            meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, sort: 3 },
        },
        {
            field: 'minutes',
            type: 'integer',
            schema: { is_nullable: false },
            meta: { interface: 'input', required: true, width: 'half', sort: 6, note: 'Time spent in minutes' },
        },
        {
            field: 'log_date',
            type: 'date',
            schema: {},
            meta: { interface: 'datetime', width: 'half', sort: 7 },
        },
        {
            field: 'notes',
            type: 'text',
            schema: {},
            meta: { interface: 'input-multiline', sort: 8 },
        },
    ];

    for (const f of fields) {
        const r = await api('POST', '/fields/time_logs', f);
        console.log(`  ${r.status === 200 ? '✅' : '⚠️ '} ${f.field}: ${r.status === 200 ? 'OK' : r.data?.errors?.[0]?.message || r.status}`);
    }

    // 3. M2O: project_id → projects
    console.log('\n🔗 Creating relationships...');

    // project_id field
    const pf = await api('POST', '/fields/time_logs', {
        field: 'project_id',
        type: 'uuid',
        schema: { is_nullable: true },
        meta: {
            interface: 'select-dropdown-m2o',
            display: 'related-values',
            display_options: { template: '{{project_name}}' },
            width: 'half',
            sort: 4,
        },
    });
    console.log(`  ${pf.status === 200 ? '✅' : '⚠️ '} project_id field: ${pf.status}`);

    // project_id relation
    const pr = await api('POST', '/relations', {
        collection: 'time_logs',
        field: 'project_id',
        related_collection: 'projects',
        schema: null,
        meta: {
            one_field: 'time_logs',
            one_deselect_action: 'nullify',
        },
    });
    console.log(`  ${pr.status === 200 ? '✅' : '⚠️ '} project_id → projects relation: ${pr.status}`);
    if (pr.status !== 200) console.log('     ', pr.data?.errors?.[0]?.message);

    // O2M alias on projects
    const ptl = await api('POST', '/fields/projects', {
        field: 'time_logs',
        type: 'alias',
        meta: {
            interface: 'list-o2m',
            special: ['o2m'],
            display: 'related-values',
            display_options: { template: '{{minutes}}m - {{log_date}}' },
            sort: 14,
        },
    });
    console.log(`  ${ptl.status === 200 ? '✅' : '⚠️ '} projects.time_logs (O2M alias): ${ptl.status}`);

    // developer_id field
    const df = await api('POST', '/fields/time_logs', {
        field: 'developer_id',
        type: 'uuid',
        schema: { is_nullable: true },
        meta: {
            interface: 'select-dropdown-m2o',
            display: 'related-values',
            display_options: { template: '{{developer_name}}' },
            width: 'half',
            sort: 5,
        },
    });
    console.log(`  ${df.status === 200 ? '✅' : '⚠️ '} developer_id field: ${df.status}`);

    // developer_id relation
    const dr = await api('POST', '/relations', {
        collection: 'time_logs',
        field: 'developer_id',
        related_collection: 'developers',
        schema: null,
        meta: {
            one_field: 'time_logs',
            one_deselect_action: 'nullify',
        },
    });
    console.log(`  ${dr.status === 200 ? '✅' : '⚠️ '} developer_id → developers relation: ${dr.status}`);
    if (dr.status !== 200) console.log('     ', dr.data?.errors?.[0]?.message);

    // O2M alias on developers
    const dtl = await api('POST', '/fields/developers', {
        field: 'time_logs',
        type: 'alias',
        meta: {
            interface: 'list-o2m',
            special: ['o2m'],
            display: 'related-values',
            display_options: { template: '{{minutes}}m - {{log_date}}' },
            sort: 12,
        },
    });
    console.log(`  ${dtl.status === 200 ? '✅' : '⚠️ '} developers.time_logs (O2M alias): ${dtl.status}`);

    // 4. Final summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 VERIFICATION');
    console.log('='.repeat(50));

    const f2 = await api('GET', '/fields/time_logs');
    const fieldList = (f2.data?.data || f2.data || []);
    console.log('\ntime_logs fields (' + fieldList.length + '):');
    fieldList.forEach(f => console.log('  ' + f.field + ' (' + f.type + ')'));

    const rels = await api('GET', '/relations');
    const tlRels = (rels.data?.data || rels.data || []).filter(r => r.collection === 'time_logs');
    console.log('\nRelations:');
    tlRels.forEach(r => console.log('  ' + r.collection + '.' + r.field + ' → ' + r.related_collection));

    console.log('\n🎉 time_logs collection created successfully!');
}

main().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
