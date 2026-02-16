require('dotenv').config();
const http = require('http');
const https = require('https');

const TARGET_URL = 'https://api001.wpcloudcms.com';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;

async function api(method, urlStr, body, token) {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + (url.search || ''),
            method,
            headers: { 'Content-Type': 'application/json' },
            rejectUnauthorized: false
        };
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;

        const req = client.request(opts, (res) => {
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
    console.log(`🛡️  Fixing Permissions for ${TARGET_URL}...\n`);

    const loginR = await api('POST', `${TARGET_URL}/auth/login`, { email: EMAIL, password: PASS });
    if (loginR.status !== 200 || !loginR.data?.data) {
        console.error('❌ Login failed:', loginR.data);
        process.exit(1);
    }
    const token = loginR.data.data.access_token;
    console.log('✅ Authenticated');

    // Find Public Role ID
    const rolesR = await api('GET', `${TARGET_URL}/roles`, null, token);
    const roles = rolesR.data?.data || [];
    let publicRoleId = null;

    const publicRole = roles.find(r => r.name.toLowerCase() === 'public');
    if (publicRole) {
        publicRoleId = publicRole.id;
        console.log(`✅ Found Public Role ID: ${publicRoleId}`);
    } else {
        console.log('⚠️  Literal "Public" role not found. Using null role (Legacy/Standard Public)...');
    }

    const collections = [
        'invoices', 'services', 'tasks', 'payrolls',
        'invoices_services', 'support_tickets_tasks',
        'job_roles', 'customers', 'employees',
        'projects', 'time_logs', 'support_tickets'
    ];

    for (const collection of collections) {
        // Query filter for role: null uses _null
        const filter = publicRoleId ? `filter[role][_eq]=${publicRoleId}` : 'filter[role][_null]=true';
        const checkR = await api('GET', `${TARGET_URL}/permissions?${filter}&filter[collection][_eq]=${collection}`, null, token);

        const payload = {
            role: publicRoleId, // null or uuid
            collection: collection,
            action: 'read',
            fields: ['*']
        };

        if (checkR.data?.data?.length > 0) {
            console.log(`  ℹ️  Updating permission for "${collection}"...`);
            await api('PATCH', `${TARGET_URL}/permissions/${checkR.data.data[0].id}`, payload, token);
        } else {
            console.log(`  ➕  Creating permission for "${collection}"...`);
            await api('POST', `${TARGET_URL}/permissions`, payload, token);
        }
    }

    console.log('\n✨ Permissions fix completed!');
}

main().catch(console.error);
