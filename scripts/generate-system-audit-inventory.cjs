#!/usr/bin/env node
/**
 * Regenerates artifacts/system-audit/inventory-counts.json from the repo.
 * Run: node scripts/generate-system-audit-inventory.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'system-audit', 'inventory-counts.json');

function walk(dir, filterFn, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filterFn, acc);
    else if (filterFn(full, entry.name)) acc.push(path.relative(ROOT, full));
  }
  return acc;
}

const pages = walk(path.join(ROOT, 'app'), (_, n) => n === 'page.js');
const apis = walk(path.join(ROOT, 'app', 'api'), (_, n) => n === 'route.js');
const migrations = fs.existsSync(path.join(ROOT, 'prisma', 'migrations'))
  ? fs.readdirSync(path.join(ROOT, 'prisma', 'migrations'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];
const tests = walk(path.join(ROOT, 'test'), (f) => /\.(test|spec)\.js$/.test(f));
const libModules = fs.existsSync(path.join(ROOT, 'lib'))
  ? fs.readdirSync(path.join(ROOT, 'lib'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

const schemaPath = path.join(ROOT, 'prisma', 'schema.prisma');
let models = [];
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
}

const payload = {
  generatedAt: new Date().toISOString(),
  counts: {
    pages: pages.length,
    apis: apis.length,
    models: models.length,
    migrations: migrations.length,
    tests: tests.length,
    libModules: libModules.length,
    cronJobs: walk(path.join(ROOT, 'app', 'api', 'cron'), (_, n) => n === 'route.js').length,
  },
  pages,
  apis,
  models,
  migrations,
  tests,
  libModules,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log('Wrote', OUT);
console.log(JSON.stringify(payload.counts, null, 2));
