const http = require('http');
const https = require('https');

const SOURCE_URL = 'https://api001.wpcloudcms.com';
const DEST_URL = 'http://localhost:8055';
const EMAIL = 'ramki.r@aaryaits.com';
const PASS = 'yj9p0s@k19gnuk3mhf!';

async function api(base, method, path, body, token) {
    return new Promise((resolve) => {
        const url = new URL(path, base);
        const lib = url.protocol === 'https:' ? https : http;
        const opts = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + (url.search || ''),
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;
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
        req.on('error', (err) => resolve({ status: 500, error: err.message }));
        if (bs) req.write(bs);
        req.end();
    });
}

async function main() {
    console.log('Authenticating...');
    const srcAuth = await api(SOURCE_URL, 'POST', '/auth/login', { email: EMAIL, password: PASS });
    const destAuth = await api(DEST_URL, 'POST', '/auth/login', { email: EMAIL, password: PASS });

    if (srcAuth.status !== 200 || destAuth.status !== 200) {
        console.error('Auth failed', { src: srcAuth.data, dest: destAuth.data });
        return;
    }
    const srcToken = srcAuth.data.data.access_token;
    const destToken = destAuth.data.data.access_token;

    // Ordered to respect foreign keys (roughly)
    const collections = [
        'job_roles',
        'customers',
        'employees',
        'projects',
        'projects_employees',
        'services',
        'invoices',
        'invoices_services',
        'tasks',
        'time_logs',
        'payrolls',
        'support_tickets',
        'support_tickets_tasks'
    ];

    for (const c of collections) {
        console.log(`Copying ${c}...`);
        const srcData = await api(SOURCE_URL, 'GET', `/items/${c}?limit=-1`, null, srcToken);
        const items = srcData.data?.data;
        if (!items || !items.length) {
            console.log(`  No items in ${c}`);
            continue;
        }

        // Push items in batches or all at once
        const destPush = await api(DEST_URL, 'POST', `/items/${c}`, items, destToken);
        if (destPush.status === 200) {
            console.log(`  ✅ Added ${items.length} items to ${c}`);
        } else {
            console.log(`  ⚠️ Failed to push ${c}:`, destPush.data?.errors?.[0]?.message || 'error');
        }
    }
    console.log('Data migration complete!');
}

main();
