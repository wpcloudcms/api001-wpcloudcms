/**
 * Repair Employees Data Model
 * 1. Read metadata from 'developers' fields
 * 2. Register/Update 'employees' fields with the same metadata
 * 3. Delete 'developers' collection
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
    console.log('🔧 Repairing Employees data model...\n');

    // Login
    const loginR = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    TOKEN = loginRes = loginR.data.data.access_token;
    console.log('✅ Authenticated');

    // 1. Get Developers schema
    const devFieldsR = await api('GET', '/fields/developers');
    const devFields = devFieldsR.data.data;

    // 2. Register fields in Employees
    console.log('📝 Registering fields in Employees...');
    for (const df of devFields) {
        if (df.field === 'id') continue;

        let targetField = df.field;
        if (targetField === 'developer_name') targetField = 'employee_name';

        // Prepare body for registration
        const body = {
            field: targetField,
            type: df.type,
            meta: df.meta,
            schema: df.schema
        };

        // If it's the renamed name field, update label
        if (targetField === 'employee_name' && body.meta) {
            body.meta.options = body.meta.options || {};
            // Directus stores labels in translations usually, but basic label is often in meta
            body.meta.label = 'Employee Name';
        }

        const res = await api('POST', `/fields/employees`, body);
        if (res.status === 200) {
            console.log(`  ✅ Registered ${targetField}`);
        } else {
            // Already registered? Try PATCH
            const patchRes = await api('PATCH', `/fields/employees/${targetField}`, { meta: body.meta });
            console.log(`  ℹ️  ${targetField}: ${patchRes.status === 200 ? 'Meta updated' : 'Manual fix needed (' + res.data.errors?.[0]?.message + ')'}`);
        }
    }

    // 3. Update collection meta
    console.log('📦 Updating Employees collection settings...');
    await api('PATCH', '/collections/employees', {
        meta: {
            icon: 'badge',
            display_template: '{{employee_name}} ({{email}})',
            note: 'Employee profiles'
        }
    });

    // 4. Delete Developers
    console.log('🧹 Attempting to delete legacy Developers collection...');

    // First remove relations pointing TO developers if any
    const relsR = await api('GET', '/relations');
    const rels = relsR.data.data;
    const devRels = rels.filter(r => r.related_collection === 'developers' || r.collection === 'developers');

    for (const rel of devRels) {
        console.log(`  🔗 Dropping relation ${rel.collection}.${rel.field}`);
        await api('DELETE', `/relations/${rel.collection}/${rel.field}`);
    }

    const delRes = await api('DELETE', '/collections/developers');
    if (delRes.status === 204 || delRes.status === 200) {
        console.log('  ✅ Developers collection deleted');
    } else {
        console.log(`  ❌ Failed to delete Developers: ${JSON.stringify(delRes.data)}`);
    }

    console.log('\n✨ Repair complete!');
}

main().catch(console.error);
