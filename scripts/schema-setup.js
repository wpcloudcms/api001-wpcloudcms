/**
 * Directus Schema Setup via REST API
 * Creates all collections, fields, relationships, and permissions
 * Idempotent - checks what exists before creating
 */

require('dotenv').config();
const http = require('http');
const https = require('https');

const BASE = process.env.PUBLIC_URL || 'http://localhost:8055';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;

let TOKEN = '';

// --- HTTP helper ---
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

async function login() {
    const r = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    if (r.status !== 200) throw new Error('Auth failed: ' + JSON.stringify(r.data));
    TOKEN = r.data.data.access_token;
    console.log('🔐 Authenticated\n');
}

async function getCollections() {
    const r = await api('GET', '/collections');
    const items = r.data?.data || r.data || [];
    return items.filter(c => !c.collection.startsWith('directus_')).map(c => c.collection);
}

async function getFields(collection) {
    const r = await api('GET', '/fields/' + collection);
    const items = r.data?.data || r.data || [];
    return items.map(f => f.field);
}

async function getRelations() {
    const r = await api('GET', '/relations');
    const items = r.data?.data || r.data || [];
    return items.filter(r => !r.collection.startsWith('directus_'));
}

async function createCollectionSafe(name, meta) {
    const r = await api('POST', '/collections', { collection: name, meta, schema: {} });
    if (r.status === 200) {
        console.log(`  ✅ Created collection: ${name}`);
    } else {
        console.log(`  ⚠️  Collection ${name}: ${r.data.errors?.[0]?.message || 'already exists'}`);
    }
}

async function createFieldSafe(collection, fieldData) {
    const r = await api('POST', '/fields/' + collection, fieldData);
    if (r.status === 200) {
        console.log(`  ✅ ${collection}.${fieldData.field}`);
    } else {
        console.log(`  ⚠️  ${collection}.${fieldData.field}: ${r.data.errors?.[0]?.message || 'error'}`);
    }
    return r;
}

async function createRelationSafe(relData) {
    const r = await api('POST', '/relations', relData);
    if (r.status === 200) {
        console.log(`  ✅ Relation: ${relData.collection}.${relData.field} → ${relData.related_collection}`);
    } else {
        console.log(`  ⚠️  Relation ${relData.collection}.${relData.field}: ${r.data.errors?.[0]?.message || 'error'}`);
    }
}

// ========== MAIN ==========
async function main() {
    await login();

    // Check existing state
    const existing = await getCollections();
    console.log('📋 Existing collections:', existing.join(', ') || 'none');

    const existingRelations = await getRelations();
    console.log('🔗 Existing relations:', existingRelations.map(r => r.collection + '.' + r.field).join(', ') || 'none');
    console.log('');

    // ========== 1. CUSTOMERS ==========
    console.log('📦 [1/4] CUSTOMERS');
    if (!existing.includes('customers')) {
        await createCollectionSafe('customers', {
            icon: 'people',
            note: 'Customer information and contact details',
            display_template: '{{customer_name}} ({{email}})',
        });
    } else {
        console.log('  ℹ️  Collection exists');
    }

    const custFields = await getFields('customers');
    const custFieldsToAdd = [
        { field: 'status', type: 'string', schema: { default_value: 'Active' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }] }, width: 'half', sort: 2 } },
        { field: 'date_created', type: 'timestamp', schema: {}, meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, width: 'half', sort: 3 } },
        { field: 'date_updated', type: 'timestamp', schema: {}, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half', sort: 4 } },
        { field: 'customer_name', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, width: 'half', sort: 5 } },
        { field: 'email', type: 'string', schema: { is_nullable: false, is_unique: true }, meta: { interface: 'input', required: true, width: 'half', sort: 6 } },
        { field: 'phone', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', sort: 7 } },
        { field: 'company', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', sort: 8 } },
        { field: 'address', type: 'text', schema: {}, meta: { interface: 'input-multiline', sort: 9 } },
        { field: 'notes', type: 'text', schema: {}, meta: { interface: 'input-rich-text-md', sort: 10 } },
    ];
    for (const f of custFieldsToAdd) {
        if (!custFields.includes(f.field)) await createFieldSafe('customers', f);
        else console.log(`  ℹ️  ${f.field} exists`);
    }
    console.log('');

    // ========== 2. DEVELOPERS ==========
    console.log('📦 [2/4] DEVELOPERS');
    if (!existing.includes('developers')) {
        await createCollectionSafe('developers', {
            icon: 'code',
            note: 'Developer profiles with skills and availability',
            display_template: '{{developer_name}} ({{email}})',
        });
    } else {
        console.log('  ℹ️  Collection exists');
    }

    const devFields = await getFields('developers');
    const devFieldsToAdd = [
        { field: 'status', type: 'string', schema: { default_value: 'Active' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }] }, width: 'half', sort: 2 } },
        { field: 'date_created', type: 'timestamp', schema: {}, meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, width: 'half', sort: 3 } },
        { field: 'date_updated', type: 'timestamp', schema: {}, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half', sort: 4 } },
        { field: 'developer_name', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, width: 'half', sort: 5 } },
        { field: 'email', type: 'string', schema: { is_nullable: false, is_unique: true }, meta: { interface: 'input', required: true, width: 'half', sort: 6 } },
        { field: 'phone', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', sort: 7 } },
        { field: 'specialization', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', sort: 8 } },
        { field: 'hourly_rate', type: 'decimal', schema: {}, meta: { interface: 'input', width: 'half', sort: 9 } },
        { field: 'availability', type: 'string', schema: { default_value: 'Available' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Available', value: 'Available' }, { text: 'Busy', value: 'Busy' }, { text: 'Unavailable', value: 'Unavailable' }] }, width: 'half', sort: 10 } },
        { field: 'skills', type: 'json', schema: {}, meta: { interface: 'tags', sort: 11 } },
    ];
    for (const f of devFieldsToAdd) {
        if (!devFields.includes(f.field)) await createFieldSafe('developers', f);
        else console.log(`  ℹ️  ${f.field} exists`);
    }
    console.log('');

    // ========== 3. PROJECTS ==========
    console.log('📦 [3/4] PROJECTS');
    if (!existing.includes('projects')) {
        await createCollectionSafe('projects', {
            icon: 'work',
            note: 'Project management with budgets and deadlines',
            display_template: '{{project_name}}',
        });
    } else {
        console.log('  ℹ️  Collection exists');
    }

    const projFields = await getFields('projects');
    const projFieldsToAdd = [
        { field: 'status', type: 'string', schema: { default_value: 'Draft' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Draft', value: 'Draft' }, { text: 'In Progress', value: 'In Progress' }, { text: 'Completed', value: 'Completed' }, { text: 'Cancelled', value: 'Cancelled' }] }, width: 'half', sort: 2 } },
        { field: 'date_created', type: 'timestamp', schema: {}, meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, width: 'half', sort: 3 } },
        { field: 'date_updated', type: 'timestamp', schema: {}, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half', sort: 4 } },
        { field: 'project_name', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, sort: 5 } },
        { field: 'description', type: 'text', schema: {}, meta: { interface: 'input-rich-text-md', sort: 6 } },
        { field: 'budget', type: 'decimal', schema: {}, meta: { interface: 'input', width: 'half', sort: 8 } },
        { field: 'deadline', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half', sort: 9 } },
        { field: 'start_date', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half', sort: 10 } },
        { field: 'end_date', type: 'date', schema: {}, meta: { interface: 'datetime', width: 'half', sort: 11 } },
        { field: 'priority', type: 'string', schema: { default_value: 'Medium' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Low', value: 'Low' }, { text: 'Medium', value: 'Medium' }, { text: 'High', value: 'High' }] }, width: 'half', sort: 12 } },
    ];
    for (const f of projFieldsToAdd) {
        if (!projFields.includes(f.field)) await createFieldSafe('projects', f);
        else console.log(`  ℹ️  ${f.field} exists`);
    }

    // customer_id M2O
    if (!projFields.includes('customer_id')) {
        await createFieldSafe('projects', {
            field: 'customer_id',
            type: 'uuid',
            schema: { is_nullable: true },
            meta: { interface: 'select-dropdown-m2o', display: 'related-values', display_options: { template: '{{customer_name}}' }, width: 'half', sort: 7 },
        });
        await createRelationSafe({
            collection: 'projects',
            field: 'customer_id',
            related_collection: 'customers',
            schema: null,
            meta: { one_field: null },
        });
    } else {
        console.log('  ℹ️  customer_id exists');
    }
    console.log('');

    // ========== 4. PROJECTS_DEVELOPERS ==========
    console.log('📦 [4/4] PROJECTS_DEVELOPERS (junction)');
    if (!existing.includes('projects_developers')) {
        await createCollectionSafe('projects_developers', {
            icon: 'link',
            hidden: true,
            note: 'Junction: projects ↔ developers',
        });
    } else {
        console.log('  ℹ️  Collection exists');
    }

    const juncFields = await getFields('projects_developers');

    // projects_id M2O
    if (!juncFields.includes('projects_id')) {
        await createFieldSafe('projects_developers', {
            field: 'projects_id',
            type: 'uuid',
            schema: { is_nullable: false },
            meta: { interface: 'select-dropdown-m2o', hidden: true, sort: 2 },
        });
        await createRelationSafe({
            collection: 'projects_developers',
            field: 'projects_id',
            related_collection: 'projects',
            schema: null,
            meta: { one_field: 'developers', one_deselect_action: 'nullify', junction_field: 'developers_id' },
        });
    } else {
        console.log('  ℹ️  projects_id exists');
    }

    // developers_id M2O
    if (!juncFields.includes('developers_id')) {
        await createFieldSafe('projects_developers', {
            field: 'developers_id',
            type: 'uuid',
            schema: { is_nullable: false },
            meta: { interface: 'select-dropdown-m2o', hidden: true, sort: 3 },
        });
        await createRelationSafe({
            collection: 'projects_developers',
            field: 'developers_id',
            related_collection: 'developers',
            schema: null,
            meta: { one_field: null, junction_field: 'projects_id' },
        });
    } else {
        console.log('  ℹ️  developers_id exists');
    }

    // M2M alias on projects
    if (!projFields.includes('developers')) {
        await createFieldSafe('projects', {
            field: 'developers',
            type: 'alias',
            meta: { interface: 'list-m2m', special: ['m2m'], options: { template: '{{developers_id.developer_name}}' }, sort: 13 },
        });
    } else {
        console.log('  ℹ️  projects.developers alias exists');
    }

    // junction extra fields
    if (!juncFields.includes('role')) {
        await createFieldSafe('projects_developers', { field: 'role', type: 'string', schema: {}, meta: { interface: 'input', note: 'e.g., Lead, Contributor', sort: 4 } });
    } else {
        console.log('  ℹ️  role exists');
    }
    if (!juncFields.includes('assigned_date')) {
        await createFieldSafe('projects_developers', { field: 'assigned_date', type: 'timestamp', schema: {}, meta: { special: ['date-created'], interface: 'datetime', readonly: true, sort: 5 } });
    } else {
        console.log('  ℹ️  assigned_date exists');
    }
    console.log('');

    // ========== 5. PERMISSIONS ==========
    console.log('🔒 Setting up permissions...');

    // Get Public role ID
    const rolesR = await api('GET', '/roles');
    const publicRole = rolesR.data.data.find(r => r.name === 'Public');
    if (!publicRole) {
        console.log('  ⚠️  Public role not found, skipping permissions');
    } else {
        const roleId = publicRole.id;

        // Get existing permissions
        const permR = await api('GET', '/permissions?filter[role][_eq]=' + roleId);
        const existingPerms = permR.data?.data || permR.data || [];

        const permsToCreate = [
            { role: roleId, collection: 'projects', action: 'create', fields: ['*'], permissions: {}, validation: {} },
            { role: roleId, collection: 'customers', action: 'read', fields: ['*'], permissions: {}, validation: {} },
            { role: roleId, collection: 'developers', action: 'read', fields: ['*'], permissions: {}, validation: {} },
        ];

        for (const perm of permsToCreate) {
            const exists = existingPerms.find(p => p.collection === perm.collection && p.action === perm.action);
            if (!exists) {
                const pr = await api('POST', '/permissions', perm);
                if (pr.status === 200) {
                    console.log(`  ✅ Public: ${perm.action.toUpperCase()} ${perm.collection}`);
                } else {
                    console.log(`  ⚠️  ${perm.collection} ${perm.action}: ${pr.data.errors?.[0]?.message || 'error'}`);
                }
            } else {
                console.log(`  ℹ️  ${perm.action.toUpperCase()} ${perm.collection} exists`);
            }
        }
    }
    console.log('');

    // ========== FINAL SUMMARY ==========
    console.log('='.repeat(50));
    console.log('📊 FINAL STATE');
    console.log('='.repeat(50));

    const finalCols = await getCollections();
    console.log('\nCollections:', finalCols.join(', '));

    for (const col of ['customers', 'developers', 'projects', 'projects_developers']) {
        const fields = await getFields(col);
        console.log(`\n${col}: ${fields.join(', ')}`);
    }

    const finalRels = await getRelations();
    console.log('\nRelations:');
    finalRels.forEach(r => console.log(`  ${r.collection}.${r.field} → ${r.related_collection}`));

    console.log('\n🎉 Schema setup complete!');
}

main().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
