/**
 * Fix GraphQL Relations
 * Connects orphaned integer fields to their correct collections
 */

require('dotenv').config();
const https = require('https');

const BASE_URL = 'https://api001.wpcloudcms.com';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;

async function api(method, path, body, token) {
    const url = new URL(path, BASE_URL);
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: url.hostname,
            path: url.pathname + (url.search || ''),
            method,
            headers: { 'Content-Type': 'application/json' },
            rejectUnauthorized: false
        };
        if (token) opts.headers['Authorization'] = `Bearer ${token}`;

        const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('🛡️  Fixing GraphQL Relations...\n');

    // 1. Authenticate
    const login = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    if (login.status !== 200) {
        console.error('❌ Login failed:', login.data);
        process.exit(1);
    }
    const token = login.data.data.access_token;
    console.log('✅ Authenticated');

    // 2. Define relations to fix
    const relations = [
        {
            collection: 'time_logs',
            field: 'developer_id',
            related_collection: 'employees',
            meta: { one_field: 'time_logs', width: 'half' },
            schema: null // Use null schema if already an integer field in DB
        },
        {
            collection: 'support_tickets',
            field: 'assigned_developer_id',
            related_collection: 'employees',
            meta: { one_field: null, width: 'half' },
            schema: null
        }
    ];

    // 3. Apply relations
    for (const rel of relations) {
        console.log(`🔗 Linking ${rel.collection}.${rel.field} to ${rel.related_collection}...`);

        // We use POST to create the relation metadata even if the field exists
        const res = await api('POST', '/relations', rel, token);

        if (res.status === 200 || res.status === 204) {
            console.log(`   ✅ Successfully linked.`);
        } else {
            const msg = res.data?.errors?.[0]?.message || JSON.stringify(res.data);
            if (msg.includes('already exists')) {
                console.log(`   ℹ️  Relation already exists.`);
            } else {
                console.error(`   ❌ Failed: ${msg}`);
            }
        }
    }

    console.log('\n✨ Relations fix completed! Please refresh your dashboard.');
}

main().catch(console.error);
