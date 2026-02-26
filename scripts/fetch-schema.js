const https = require('https');
const fs = require('fs');

async function api(method, path, body, token) {
    return new Promise((resolve) => {
        const url = new URL(path, 'https://api001.wpcloudcms.com');
        const opts = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + (url.search || ''),
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;
        const bs = body ? JSON.stringify(body) : null;
        if (bs) opts.headers['Content-Length'] = Buffer.byteLength(bs);

        const req = https.request(opts, (res) => {
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
    console.log('Authenticating with Ploi server...');
    const login = await api('POST', '/auth/login', {
        email: 'ramki.r@aaryaits.com',
        password: 'yj9p0s@k19gnuk3mhf!'
    });

    if (login.status !== 200) {
        console.error('Login failed!', login.data);
        return;
    }

    const token = login.data.data.access_token;
    console.log('Success! Fetching schema snapshot...');

    const snapshot = await api('GET', '/schema/snapshot', null, token);

    if (snapshot.status === 200) {
        fs.writeFileSync('snapshot.json', JSON.stringify(snapshot.data.data, null, 2));
        console.log('Saved to snapshot.json!');
    } else {
        console.error('Failed to get schema:', snapshot.data);
    }
}

main();
