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
    const loginR = await api('POST', '/auth/login', {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    const token = loginR.data.data.access_token;

    console.log('🔧 Fixing Tasks collection metadata...');
    const patchR = await api('PATCH', '/collections/tasks', {
        meta: {
            icon: 'assignment',
            display_template: '{{name}}',
            translations: [
                { language: 'en-US', translation: 'Tasks', singular: 'Task', plural: 'Tasks' }
            ]
        }
    }, token);

    if (patchR.status === 200) {
        console.log('✅ Tasks collection fixed successfully!');
    } else {
        console.log('❌ Failed to fix Tasks collection:', patchR.status, patchR.data);
    }
}

main();
