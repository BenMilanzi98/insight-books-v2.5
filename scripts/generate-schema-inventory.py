# Phase 1 audit: generate machine-readable Prisma schema inventory (read-only).
import re
import json
import os

src = open(r'prisma\schema.prisma', encoding='utf-8').read()
models = {}
for m in re.finditer(r'^model (\w+) \{(.*?)^\}', src, re.M | re.S):
    name, body = m.group(1), m.group(2)
    fields = []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith('//') or line.startswith('@@') or line.startswith('///'):
            continue
        parts = line.split()
        if len(parts) >= 2 and re.match(r'^\w+$', parts[0]):
            fields.append({'name': parts[0], 'type': parts[1], 'attrs': ' '.join(parts[2:])})
    uniques = re.findall(r'@@unique\(\[([^\]]+)\]\)', body)
    indexes = re.findall(r'@@index\(\[([^\]]+)\]\)', body)
    models[name] = {
        'fields': fields,
        'uniqueConstraints': uniques,
        'indexes': indexes,
        'hasTenantId': any(f['name'] == 'tenantId' for f in fields),
        'tenantIdNullable': any(f['name'] == 'tenantId' and f['type'].endswith('?') for f in fields),
        'floatMoneyFields': [
            f['name'] for f in fields
            if f['type'].rstrip('?') == 'Float'
            and re.search(r'amount|balance|debit|credit|total|paid|price|principal', f['name'], re.I)
        ],
        'cascadeDeletes': re.findall(r'(\w+)\s+\w+\?*\s+@relation\([^)]*onDelete: Cascade', body),
    }

os.makedirs(r'artifacts\accounting-audit', exist_ok=True)
with open(r'artifacts\accounting-audit\schema-inventory.json', 'w', encoding='utf-8') as f:
    json.dump({'commit': '5b59a68', 'modelCount': len(models), 'models': models}, f, indent=2)

float_money = {k: v['floatMoneyFields'] for k, v in models.items() if v['floatMoneyFields']}
print('models:', len(models))
print('models with Float money fields:', len(float_money))
for k, v in float_money.items():
    print(' ', k, '->', ', '.join(v))
