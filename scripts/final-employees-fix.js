/**
 * CLEAN & CONFIGURE EMPLOYEES
 */

require('dotenv').config();
const http = require('http');

const BASE = process.env.PUBLIC_URL || 'http://127.0.0.1:8055';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;

let TOKEN = '';

async function api(method, path, body) {
    return new Promise((resolve) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + (url.search || ''),
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
        if (bs) req.write(bs);
        req.end();
    });
}

async function main() {
    console.log('🚀 Finalizing Employees Data Model...\n');

    // Login
    const loginR = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    TOKEN = loginR.data.data.access_token;
    console.log('✅ Authenticated');

    // 1. Cleanup redundant fields
    console.log('🧹 Purging redundant developer_name field...');
    await api('DELETE', '/fields/employees/developer_name');

    // 2. Define standard field configs
    const fieldConfigs = [
        { field: 'employee_name', type: 'string', meta: { interface: 'input', label: 'Employee Name', width: 'half' } },
        { field: 'email', type: 'string', meta: { interface: 'input', label: 'Email', width: 'half', options: { iconLeft: 'email' } } },
        { field: 'phone', type: 'string', meta: { interface: 'input', label: 'Phone', width: 'half', options: { iconLeft: 'phone' } } },
        { field: 'status', type: 'string', meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }] } } },
        { field: 'availability', type: 'string', meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Available', value: 'Available' }, { text: 'Busy', value: 'Busy' }] } } },
        { field: 'specialization', type: 'string', meta: { interface: 'input', label: 'Specialization', width: 'full' } },
        { field: 'hourly_rate', type: 'decimal', meta: { interface: 'numeric', width: 'half', options: { iconLeft: 'attach_money' } } },
        { field: 'skills', type: 'json', meta: { interface: 'tags', width: 'full' } },
        { field: 'date_created', type: 'timestamp', meta: { readonly: true, hidden: true, special: ['date-created'] } },
        { field: 'date_updated', type: 'timestamp', meta: { readonly: true, hidden: true, special: ['date-updated'] } }
    ];

    console.log('📝 Configuring Employees fields...');
    for (const conf of fieldConfigs) {
        // Register/Update meta
        const res = await api('POST', '/fields/employees', conf);
        if (res.status === 200) {
            console.log(`  ✅ Configured ${conf.field}`);
        } else {
            // Already there? Patch it.
            const patchRes = await api('PATCH', `/fields/employees/${conf.field}`, { meta: conf.meta });
            console.log(`  🔄 Updated ${conf.field} (${patchRes.status === 200 ? 'SUCCESS' : 'PATCH FAILED'})`);
        }
    }

    // 3. Setup Job Role relation
    console.log('🔗 Setting up Job Role relation...');
    await api('POST', '/relations', {
        collection: 'employees',
        field: 'job_role',
        related_collection: 'job_roles',
        meta: { one_field: null, width: 'half' }
    });

    // 4. Update Time Logs & Tickets logic to use correct fields if they reset
    console.log('🛠️ Verifying foreign key relationships...');
    await api('PATCH', '/relations/time_logs/employee_id', { related_collection: 'employees' });
    await api('PATCH', '/relations/support_tickets/assigned_employee_id', { related_collection: 'employees' });

    console.log('\n✨ Employees data model is now fully configured!');
}

main().catch(console.error);
