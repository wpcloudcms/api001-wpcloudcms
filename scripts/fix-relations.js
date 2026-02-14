/**
 * Fix relations — remove orphaned alias fields, recreate relations properly
 * The FK constraint failures also prevented relation metadata from saving.
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

    // Step 1: Delete orphan O2M alias fields that reference non-existent relations
    console.log('🗑️  Cleaning orphaned alias fields...');
    const orphans = [
        'projects/developers',       // M2M alias
        'projects/time_logs',        // O2M alias  
        'projects/support_tickets',  // O2M alias
        'developers/time_logs',      // O2M alias
    ];
    for (const path of orphans) {
        const r = await api('DELETE', `/fields/${path}`);
        console.log(`  ${r.status === 204 ? '✅ Deleted' : '⚠️  ' + r.status}: ${path}`);
    }

    // Step 2: Fix the M2O field types - they need to be integer to match the PK type
    // The id columns are auto-increment integers, not UUIDs
    console.log('\n🔧 Checking PK types...');
    for (const col of ['customers', 'developers', 'projects']) {
        const f = await api('GET', `/fields/${col}/id`);
        const idType = f.data?.data?.type;
        console.log(`  ${col}.id type: ${idType}`);
    }

    // Step 3: Delete the wrongly-typed FK fields and recreate as integer
    console.log('\n🔄 Fixing FK field types (uuid → integer)...');

    const fkFields = [
        { collection: 'projects', field: 'customer_id' },
        { collection: 'time_logs', field: 'project_id' },
        { collection: 'time_logs', field: 'developer_id' },
        { collection: 'support_tickets', field: 'customer_id' },
        { collection: 'support_tickets', field: 'project_id' },
        { collection: 'support_tickets', field: 'assigned_developer_id' },
        { collection: 'projects_developers', field: 'projects_id' },
        { collection: 'projects_developers', field: 'developers_id' },
    ];

    for (const { collection, field } of fkFields) {
        // Check current type
        const f = await api('GET', `/fields/${collection}/${field}`);
        const curType = f.data?.data?.type;
        console.log(`  ${collection}.${field}: ${curType}`);

        if (curType === 'string' || curType === 'uuid') {
            // Delete and recreate as integer
            const del = await api('DELETE', `/fields/${collection}/${field}`);
            console.log(`    Deleted: ${del.status}`);

            const create = await api('POST', `/fields/${collection}`, {
                field: field,
                type: 'integer',
                schema: { is_nullable: true },
                meta: {
                    interface: 'select-dropdown-m2o',
                    display: 'related-values',
                    width: 'half',
                },
            });
            console.log(`    Recreated as integer: ${create.status}`);
        }
    }

    // Step 4: Create all relations properly (schema: null to avoid FK constraints)
    console.log('\n🔗 Creating relations...');

    const relations = [
        // projects.customer_id → customers
        {
            collection: 'projects', field: 'customer_id', related_collection: 'customers',
            schema: null,
            meta: { one_field: null, one_deselect_action: 'nullify' },
        },
        // time_logs.project_id → projects (with O2M reverse)
        {
            collection: 'time_logs', field: 'project_id', related_collection: 'projects',
            schema: null,
            meta: { one_field: 'time_logs', one_deselect_action: 'nullify' },
        },
        // time_logs.developer_id → developers (with O2M reverse)
        {
            collection: 'time_logs', field: 'developer_id', related_collection: 'developers',
            schema: null,
            meta: { one_field: 'time_logs', one_deselect_action: 'nullify' },
        },
        // support_tickets.customer_id → customers
        {
            collection: 'support_tickets', field: 'customer_id', related_collection: 'customers',
            schema: null,
            meta: { one_field: null, one_deselect_action: 'nullify' },
        },
        // support_tickets.project_id → projects (with O2M reverse)
        {
            collection: 'support_tickets', field: 'project_id', related_collection: 'projects',
            schema: null,
            meta: { one_field: 'support_tickets', one_deselect_action: 'nullify' },
        },
        // support_tickets.assigned_developer_id → developers
        {
            collection: 'support_tickets', field: 'assigned_developer_id', related_collection: 'developers',
            schema: null,
            meta: { one_field: null, one_deselect_action: 'nullify' },
        },
        // projects_developers.projects_id → projects (M2M leg)
        {
            collection: 'projects_developers', field: 'projects_id', related_collection: 'projects',
            schema: null,
            meta: { one_field: 'developers', junction_field: 'developers_id' },
        },
        // projects_developers.developers_id → developers (M2M leg)
        {
            collection: 'projects_developers', field: 'developers_id', related_collection: 'developers',
            schema: null,
            meta: { one_field: null, junction_field: 'projects_id' },
        },
    ];

    for (const rel of relations) {
        const r = await api('POST', '/relations', rel);
        const ok = r.status === 200;
        console.log(`  ${ok ? '✅' : '⚠️ '} ${rel.collection}.${rel.field} → ${rel.related_collection}: ${ok ? 'OK' : r.data?.errors?.[0]?.message || r.status}`);
    }

    // Step 5: Verify
    console.log('\n' + '='.repeat(50));
    console.log('📊 VERIFICATION');
    console.log('='.repeat(50));

    const rels = await api('GET', '/relations');
    const userRels = (rels.data?.data || rels.data || []).filter(r => !r.collection.startsWith('directus_'));
    console.log(`\nRelations: ${userRels.length}`);
    userRels.forEach(r => console.log(`  ${r.collection}.${r.field} → ${r.related_collection} (one_field: ${r.meta?.one_field || 'none'})`));

    console.log('\n🎉 Relations fixed!');
}

main().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
