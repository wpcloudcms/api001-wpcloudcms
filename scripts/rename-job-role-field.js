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
    console.log('🚀 Renaming Job Role field...');

    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    // 1. Create new field
    console.log('📝 Creating job_role_name field...');
    await api('POST', '/fields/job_roles', {
        field: 'job_role_name',
        type: 'string',
        meta: {
            interface: 'input',
            width: 'full'
        }
    }, token);

    // 2. Migrate data
    console.log('🔄 Migrating data...');
    const roles = (await api('GET', '/items/job_roles', null, token)).data.data;
    for (const r of roles) {
        await api('PATCH', `/items/job_roles/${r.id}`, { job_role_name: r.name }, token);
    }

    // 3. Delete old field
    console.log('🗑️ Deleting old name field...');
    await api('DELETE', '/fields/job_roles/name', null, token);

    // 4. Update Employees display template if it uses 'name'
    console.log('⚙️ Updating collection metadata...');
    await api('PATCH', '/collections/job_roles', {
        meta: {
            display_template: '{{job_role_name}}'
        }
    }, token);

    console.log('✅ Field renamed to job_role_name!');
}

main();
