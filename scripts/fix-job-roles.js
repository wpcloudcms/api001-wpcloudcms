require('dotenv').config();
const http = require('http');
const BASE = process.env.PUBLIC_URL || 'http://127.0.0.1:8055';

async function api(method, path, body, token) {
    return new Promise((resolve) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
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
    console.log('🚀 Fixing Job Roles Relationship...');

    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    // 1. Create job_role field in employees
    console.log('📝 Creating job_role field...');
    const fieldRes = await api('POST', '/fields/employees', {
        field: 'job_role',
        type: 'integer',
        meta: {
            interface: 'select-dropdown-m2o',
            template: '{{name}}',
            width: 'half'
        },
        schema: {
            default_value: null
        }
    }, token);

    // 2. Create Relation
    console.log('🔗 Creating Relationship...');
    await api('POST', '/relations', {
        collection: 'employees',
        field: 'job_role',
        related_collection: 'job_roles',
        meta: {
            one_field: null,
            one_deselect_action: 'nullify'
        },
        schema: {
            on_delete: 'SET NULL'
        }
    }, token);

    // 3. Assign roles
    console.log('👥 Assigning roles to employees...');
    const ems = (await api('GET', '/items/employees?limit=-1', null, token)).data.data;
    const roles = (await api('GET', '/items/job_roles', null, token)).data.data;

    const devRole = roles.find(r => r.name === 'Developer')?.id;
    const desRole = roles.find(r => r.name === 'Designer')?.id;

    for (const e of ems) {
        let roleId = devRole;
        if (e.employee_name && e.employee_name.toLowerCase().includes('design')) roleId = desRole;

        await api('PATCH', `/items/employees/${e.id}`, { job_role: roleId }, token);
    }

    console.log('✅ Job Roles Relationship established!');
}

main();
