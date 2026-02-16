/**
 * Migrate Developers to Employees
 * 1. Create 'employees' collection
 * 2. Migrate fields & data
 * 3. Update relations (time_logs, support_tickets)
 * 4. Migrate junction (projects_developers -> projects_employees)
 * 5. Cleanup
 */

require('dotenv').config();
const http = require('http');

const BASE = process.env.PUBLIC_URL || 'http://127.0.0.1:8055';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;

let TOKEN = '';

async function api(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
        const bs = body ? JSON.stringify(body) : null;
        if (bs) opts.headers['Content-Length'] = Buffer.byteLength(bs);

        const req = http.request(opts, (res) => {
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
    console.log('🚀 Starting Employee Migration...\n');

    // Login
    const loginR = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    TOKEN = loginR.data.data.access_token;
    console.log('✅ Authenticated');

    // 1. Get Developers schema
    console.log('🔍 Fetching Developers schema...');
    const devColR = await api('GET', '/collections/developers');
    const devFieldsR = await api('GET', '/fields/developers');

    if (devColR.status !== 200) {
        console.log('❌ Developers collection not found.');
        return;
    }

    // 2. Create Employees collection
    console.log('📦 Creating "employees" collection...');
    const fieldsToCreate = devFieldsR.data.data.filter(f => !['id', 'date_created', 'date_updated', 'user_created', 'user_updated'].includes(f.field));

    await api('POST', '/collections', {
        collection: 'employees',
        meta: {
            icon: 'badge',
            display_template: '{{employee_name}} ({{email}})',
            note: 'Employee profiles'
        },
        schema: {}
    });

    for (const f of fieldsToCreate) {
        // Skip relational fields for now, just create base types
        if (f.type !== 'alias') {
            await api('POST', '/fields/employees', {
                field: f.field,
                type: f.type,
                meta: f.meta,
                schema: f.schema
            });
        }
    }
    console.log('  ✅ Collection created');

    // 3. Migrate Data
    console.log('🚚 Migrating data...');
    const devItemsR = await api('GET', '/items/developers?limit=-1');
    const items = devItemsR.data.data;

    for (const item of items) {
        const { id, date_created, date_updated, ...data } = item;
        await api('POST', '/items/employees', { ...data, id }); // Keep IDs
    }
    console.log(`  ✅ Migrated ${items.length} employees`);

    // 4. Update Relations
    console.log('🔗 Updating relations...');
    // Job Role relation (if it was on developers)
    await api('POST', '/relations', {
        collection: 'employees',
        field: 'job_role',
        related_collection: 'job_roles',
        meta: { one_field: null }
    });

    // Time Logs
    const timeLogRelR = await api('PATCH', '/relations/time_logs/employee_id', {
        related_collection: 'employees'
    });
    console.log('  ✅ Updated time_logs relation');

    // Support Tickets
    await api('PATCH', '/relations/support_tickets/assigned_employee_id', {
        related_collection: 'employees'
    });
    console.log('  ✅ Updated support_tickets relation');

    // 5. Migrate Junction
    console.log('🔄 Migrating projects junction...');
    await api('POST', '/collections', {
        collection: 'projects_employees',
        meta: { hidden: true },
        schema: {}
    });

    await api('POST', '/fields/projects_employees', { field: 'id', type: 'integer', schema: { is_primary_key: true } });
    await api('POST', '/fields/projects_employees', { field: 'projects_id', type: 'integer' });
    await api('POST', '/fields/projects_employees', { field: 'employees_id', type: 'integer' });
    await api('POST', '/fields/projects_employees', { field: 'role', type: 'string' });

    await api('POST', '/relations', { collection: 'projects_employees', field: 'projects_id', related_collection: 'projects' });
    await api('POST', '/relations', { collection: 'projects_employees', field: 'employees_id', related_collection: 'employees' });

    const jItemsR = await api('GET', '/items/projects_developers?limit=-1');
    for (const ji of (jItemsR.data.data || [])) {
        await api('POST', '/items/projects_employees', {
            projects_id: ji.projects_id,
            employees_id: ji.developers_id, // Map dev_id to emp_id
            role: ji.role
        });
    }

    // Update Projects alias field
    await api('PATCH', '/fields/projects/employees', {
        meta: {
            options: { template: '{{employees_id.employee_name}}' }
        }
    });
    console.log('  ✅ Junction migrated');

    // 6. Cleanup
    console.log('🧹 Cleaning up old collections...');
    await api('DELETE', '/collections/projects_developers');
    await api('DELETE', '/collections/developers');
    console.log('  ✅ Done');

    console.log('\n🎉 Migration Successfully Completed!');
}

main().catch(console.error);
