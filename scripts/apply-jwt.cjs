/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const NEEDLE = "process.env.JWT_SECRET || 'your-secret-key'";
const IMPORT = "import { getJwtSecret } from '@/lib/serverJwtSecret';\n";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, acc);
    } else if (e.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const extra = [
  'lib/adminAuth.js',
  'app/api/auth/register/route.js',
  'app/api/affiliate/login/route.js',
  'app/api/debug-jwt/route.js',
  'app/api/admin/tenants/route.js',
  'app/api/affiliate/profile/route.js',
  'app/api/affiliate/referrals/route.js',
  'app/api/affiliate/dashboard-stats/route.js',
];

const set = new Set([
  ...walk(path.join(root, 'app', 'api', 'admin')),
  ...extra.map((f) => path.join(root, f)),
]);

let n = 0;
for (const file of set) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes(NEEDLE)) continue;

  if (!s.includes("from '@/lib/serverJwtSecret'")) {
    const jwtLine = s.indexOf("import jwt from 'jsonwebtoken'");
    if (jwtLine !== -1) {
      const lineEnd = s.indexOf('\n', jwtLine);
      s = `${s.slice(0, lineEnd + 1)}${IMPORT}${s.slice(lineEnd + 1)}`;
    } else {
      s = IMPORT + s;
    }
  }

  s = s.split(NEEDLE).join('getJwtSecret()');
  fs.writeFileSync(file, s);
  n++;
  console.log('Patched', path.relative(root, file));
}
console.log('Files patched:', n);
