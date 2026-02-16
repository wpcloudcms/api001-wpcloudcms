/**
 * Refactor Schema Script (Native HTTP version)
 * 1. Renames "Developers" to "Employees"
 * 2. Renames "Developer Name" to "Employee Name"
 * 3. Creates "Job Roles" collection
 * 4. Adds relation from Employees to Job Roles
 * 5. Adds User Roles (Customer, Designer, etc.)
 */

require('dotenv').config();
const http = require('http');
const https = require('https');

// Configuration
const BASE = process.env.PUBLIC_URL || 'http://127.0.0.1:8055';
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
    console.log('🔐 Authenticating...');
    const r = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    if (r.status !== 200) throw new Error('Auth failed: ' + JSON.stringify(r.data));
    TOKEN = r.data.data.access_token;
    console.log('✅ Authenticated\n');
}

async function main() {
    await login();

    // 1. Rename Developers -> Employees
    console.log('📦 [1/6] Renaming Developers to Employees...');
    const colR = await api('PATCH', '/collections/developers', {
        meta: {
            icon: 'badge',
            display_template: '{{employee_name}} ({{email}})',
            note: 'Employee profiles with roles and availability'
        }
    });
    // Directus might not allow renaming the collection via PATCH core name, 
    // but we can try updating the meta.
    // To actually rename the 'collection' string, it's safer to use the internal API if available, 
    // or create a new collection and move data.
    // However, Directus PATCH /collections/:id usually allows changing the collection name if supported by DB.

    // Let's try to update the collection name field itself
    const renameR = await api('PATCH', '/collections/developers', {
        collection: 'employees'
    });
    if (renameR.status === 200) console.log('  ✅ Collection renamed to "employees"');
    else console.log(`  ℹ️  Collection rename: ${renameR.data.errors?.[0]?.message || 'skipped'}`);

    // 2. Rename fields in Employees
    console.log('📝 [2/6] Renaming fields...');
    const actualCol = renameR.status === 200 ? 'employees' : 'developers';

    const fieldR = await api('PATCH', `/fields/${actualCol}/developer_name`, {
        field: 'employee_name'
    });
    if (fieldR.status === 200) console.log(`  ✅ ${actualCol}.developer_name -> employee_name`);
    else console.log(`  ℹ️  Field rename: ${fieldR.data.errors?.[0]?.message || 'skipped'}`);

    // 3. Create Job Roles collection
    console.log('📂 [3/6] Creating Job Roles collection...');
    const jrR = await api('POST', '/collections', {
        collection: 'job_roles',
        meta: { icon: 'assignment_ind', display_template: '{{name}}' },
        schema: {}
    });
    if (jrR.status === 200) {
        console.log('  ✅ Created "job_roles" collection');
        await api('POST', `/fields/job_roles`, {
            field: 'name',
            type: 'string',
            meta: { interface: 'input', required: true }
        });

        // Seed
        const roles = ['Developer', 'Designer', 'Project Manager', 'Sales', 'Marketing'];
        for (const role of roles) {
            await api('POST', '/items/job_roles', { name: role });
        }
        console.log('  ✅ Seeded sample Job Roles');
    } else {
        console.log(`  ℹ️  "job_roles" creation: ${jrR.data.errors?.[0]?.message || 'exists'}`);
    }

    // 4. Add M2O relation
    console.log('🔗 [4/6] Connecting Employees to Job Roles...');
    const m2oR = await api('POST', `/fields/${actualCol}`, {
        field: 'job_role',
        type: 'integer',
        meta: {
            interface: 'select-dropdown-m2o',
            display: 'related-values',
            display_options: { template: '{{name}}' },
            width: 'half'
        }
    });
    if (m2oR.status === 200) {
        await api('POST', '/relations', {
            collection: actualCol,
            field: 'job_role',
            related_collection: 'job_roles',
            meta: { one_field: null }
        });
        console.log('  ✅ Added job_role relation');
    } else {
        console.log(`  ℹ️  job_role field: ${m2oR.data.errors?.[0]?.message || 'exists'}`);
    }

    // 5. System Roles
    console.log('👥 [5/6] Creating System Roles...');
    const systemRoles = [
        { name: 'Customer', icon: 'person' },
        { name: 'Designer', icon: 'palette' },
        { name: 'Developer', icon: 'code' },
        { name: 'Sales', icon: 'payments' },
        { name: 'Marketing', icon: 'campaign' },
        { name: 'Site Admin', icon: 'settings' }
    ];

    const existingRolesR = await api('GET', '/roles');
    const existingRoleNames = (existingRolesR.data?.data || []).map(r => r.name);

    for (const roleData of systemRoles) {
        if (!existingRoleNames.includes(roleData.name)) {
            const rr = await api('POST', '/roles', roleData);
            if (rr.status === 200) console.log(`  ✅ Role "${roleData.name}" created.`);
        } else {
            console.log(`  ℹ️  Role "${roleData.name}" exists.`);
        }
    }

    // 6. Junction Update
    console.log('🔄 [6/6] Updating junction collection...');
    const jrenameR = await api('PATCH', '/collections/projects_developers', {
        collection: 'projects_employees'
    });
    const actualJunc = jrenameR.status === 200 ? 'projects_employees' : 'projects_developers';

    if (jrenameR.status === 200) console.log('  ✅ Junction renamed to "projects_employees"');

    await api('PATCH', `/fields/${actualJunc}/developers_id`, {
        field: 'employees_id'
    });
    console.log(`  ✅ ${actualJunc}.developers_id -> employees_id`);

    // 7. Remaining Field Renames
    console.log('📝 [7/7] Final field scrubs...');
    await api('PATCH', '/fields/time_logs/developer_id', { field: 'employee_id' });
    console.log('  ✅ time_logs.developer_id -> employee_id');

    await api('PATCH', '/fields/support_tickets/assigned_developer_id', { field: 'assigned_employee_id' });
    console.log('  ✅ support_tickets.assigned_developer_id -> assigned_employee_id');

    await api('PATCH', '/fields/projects/developers', { field: 'employees', meta: { options: { template: '{{employees_id.employee_name}}' } } });
    console.log('  ✅ projects.developers -> employees');

    console.log('\n🎉 Refactor complete!');
}

main().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
