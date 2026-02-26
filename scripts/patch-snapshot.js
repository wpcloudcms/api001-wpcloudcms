const fs = require('fs');
const s = JSON.parse(fs.readFileSync('snapshot.json', 'utf8'));

const fieldsByCol = {};
s.fields.forEach(f => {
    if (!fieldsByCol[f.collection]) fieldsByCol[f.collection] = new Set();
    fieldsByCol[f.collection].add(f.field);
});

const missing = [];
s.relations.forEach(r => {
    if (!fieldsByCol[r.collection] || !fieldsByCol[r.collection].has(r.field)) {
        missing.push({ collection: r.collection, field: r.field });
    }
});

let added = 0;
for (const m of missing) {
    s.fields.push({
        collection: m.collection,
        field: m.field,
        type: "integer",
        meta: {
            collection: m.collection,
            field: m.field,
            hidden: true,
            interface: null,
            note: null,
            readonly: false,
            required: false,
            sort: 99,
            width: "full"
        },
        schema: {
            name: m.field,
            table: m.collection,
            data_type: "INT",
            is_nullable: true,
            is_unique: false,
            is_indexed: true,
            is_primary_key: false,
            has_auto_increment: false
        }
    });
    added++;
}

fs.writeFileSync('snapshot.json', JSON.stringify(s, null, 2));
console.log(`Patched snapshot.json with ${added} missing fields.`);
