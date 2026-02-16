/**
 * Full Schema Update: Tasks, Services, Invoicing, Payroll
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
    console.log('🚀 Starting Full Financial & Tasks Schema Update...\n');

    // Login
    const loginR = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
    TOKEN = loginR.data.data.access_token;
    console.log('✅ Authenticated');

    // 1. CUSTOMERS: Add hourly_rate
    console.log('👤 Updating Customers collection...');
    await api('POST', '/fields/customers', {
        field: 'hourly_rate',
        type: 'decimal',
        meta: { interface: 'numeric', options: { iconLeft: 'attach_money', placeholder: 'Rate charged to client' }, width: 'half' }
    });

    // 2. SERVICES
    console.log('🏷️ Creating Services collection...');
    await api('POST', '/collections', {
        collection: 'services',
        meta: { icon: 'shopping_bag', note: 'Fixed price services' },
        schema: {}
    });
    await api('POST', '/fields/services', { field: 'name', type: 'string', meta: { interface: 'input', required: true } });
    await api('POST', '/fields/services', { field: 'price', type: 'decimal', meta: { interface: 'numeric', options: { iconLeft: 'attach_money' } } });
    await api('POST', '/fields/services', {
        field: 'discount_type', type: 'string',
        meta: { interface: 'select-dropdown', options: { choices: [{ text: 'None', value: 'None' }, { text: 'Fixed', value: 'Fixed' }, { text: 'Percentage', value: 'Percentage' }] } }
    });
    await api('POST', '/fields/services', { field: 'discount_value', type: 'decimal', meta: { interface: 'numeric' } });

    // 3. TASKS
    console.log('📋 Creating Tasks collection...');
    await api('POST', '/collections', {
        collection: 'tasks',
        meta: { icon: 'assign', note: 'Project tasks' },
        schema: {}
    });
    await api('POST', '/fields/tasks', { field: 'name', type: 'string', meta: { interface: 'input', required: true, width: 'full' } });
    await api('POST', '/fields/tasks', { field: 'status', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [{ text: 'To Do', value: 'To Do' }, { text: 'In Progress', value: 'In Progress' }, { text: 'Done', value: 'Done' }, { text: 'Blocked', value: 'Blocked' }] }, width: 'half' } });
    await api('POST', '/fields/tasks', { field: 'priority', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Low', value: 'Low' }, { text: 'Medium', value: 'Medium' }, { text: 'High', value: 'High' }, { text: 'Urgent', value: 'Urgent' }] }, width: 'half' } });
    await api('POST', '/fields/tasks', { field: 'deadline', type: 'date', meta: { interface: 'datetime', width: 'half' } });
    await api('POST', '/fields/tasks', { field: 'estimated_minutes', type: 'integer', meta: { interface: 'numeric', width: 'half' } });

    // Tasks Relations
    await api('POST', '/fields/tasks', { field: 'project_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'tasks', field: 'project_id', related_collection: 'projects' });
    await api('POST', '/fields/tasks', { field: 'employee_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'tasks', field: 'employee_id', related_collection: 'employees' });

    // 4. INVOICES
    console.log('📄 Creating Invoices system...');
    await api('POST', '/collections', {
        collection: 'invoices',
        meta: { icon: 'receipt_long', note: 'Client Invoices' },
        schema: {}
    });
    await api('POST', '/fields/invoices', { field: 'invoice_id', type: 'string', meta: { interface: 'input', required: true, width: 'half' } });
    await api('POST', '/fields/invoices', { field: 'status', type: 'string', meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Draft', value: 'Draft' }, { text: 'Sent', value: 'Sent' }, { text: 'Paid', value: 'Paid' }] } } });
    await api('POST', '/fields/invoices', { field: 'date_from', type: 'date', meta: { width: 'half' } });
    await api('POST', '/fields/invoices', { field: 'date_to', type: 'date', meta: { width: 'half' } });
    await api('POST', '/fields/invoices', { field: 'total_amount', type: 'decimal', meta: { interface: 'numeric', readonly: true, width: 'half' } });

    await api('POST', '/fields/invoices', { field: 'customer_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'invoices', field: 'customer_id', related_collection: 'customers' });
    await api('POST', '/fields/invoices', { field: 'project_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'invoices', field: 'project_id', related_collection: 'projects' });

    // Invoices <-> Services (M2M)
    await api('POST', '/collections', { collection: 'invoices_services', meta: { hidden: true }, schema: {} });
    await api('POST', '/fields/invoices_services', { field: 'id', type: 'integer', schema: { is_primary_key: true } });
    await api('POST', '/fields/invoices_services', { field: 'invoices_id', type: 'integer' });
    await api('POST', '/fields/invoices_services', { field: 'services_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'invoices_services', field: 'invoices_id', related_collection: 'invoices' });
    await api('POST', '/relations', { collection: 'invoices_services', field: 'services_id', related_collection: 'services' });
    await api('POST', '/fields/invoices', { field: 'services', type: 'alias', meta: { interface: 'list-m2m', special: ['m2m'] } });

    // 5. PAYROLLS
    console.log('💸 Creating Payrolls collection...');
    await api('POST', '/collections', {
        collection: 'payrolls',
        meta: { icon: 'payments', note: 'Employee Payroll' },
        schema: {}
    });
    await api('POST', '/fields/payrolls', { field: 'month', type: 'integer', meta: { width: 'half' } });
    await api('POST', '/fields/payrolls', { field: 'year', type: 'integer', meta: { width: 'half' } });
    await api('POST', '/fields/payrolls', { field: 'total_minutes', type: 'integer', meta: { width: 'half', readonly: true } });
    await api('POST', '/fields/payrolls', { field: 'hourly_rate', type: 'decimal', meta: { width: 'half', readonly: true } });
    await api('POST', '/fields/payrolls', { field: 'total_amount', type: 'decimal', meta: { width: 'half', readonly: true } });
    await api('POST', '/fields/payrolls', { field: 'status', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Draft', value: 'Draft' }, { text: 'Paid', value: 'Paid' }] } } });

    await api('POST', '/fields/payrolls', { field: 'employee_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'payrolls', field: 'employee_id', related_collection: 'employees' });

    // 6. TIME LOGS: Add task_id
    console.log('⏱️ Updating Time Logs...');
    await api('POST', '/fields/time_logs', { field: 'task_id', type: 'integer' });
    await api('POST', '/relations', { collection: 'time_logs', field: 'task_id', related_collection: 'tasks' });

    console.log('\n✨ Full Schema Update Completed!');
}

main().catch(console.error);
