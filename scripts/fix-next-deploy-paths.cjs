/**
 * After deploying a Windows-built .next to Linux, rewrite absolute build-machine
 * paths in Next metadata so next start resolves files from the VPS project root.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const target = path.join(projectRoot, '.next', 'required-server-files.json');

if (!fs.existsSync(target)) {
  console.log('[fix-next-deploy-paths] no required-server-files.json — skip');
  process.exit(0);
}

let raw = fs.readFileSync(target, 'utf8');
const before = raw;

// Replace any Windows or stale absolute project root with current Linux path.
raw = raw.replace(/C:\\\\laragon\\\\www\\\\insight-books-v2\.5/g, projectRoot.replace(/\\/g, '\\\\'));
raw = raw.replace(/C:\/laragon\/www\/insight-books-v2\.5/g, projectRoot.replace(/\\/g, '/'));
raw = raw.replace(/"appDir":\s*"[^"]+"/, `"appDir": ${JSON.stringify(projectRoot)}`);
raw = raw.replace(/"root":\s*"[^"]+"/, `"root": ${JSON.stringify(projectRoot)}`);
raw = raw.replace(/"outputFileTracingRoot":\s*"[^"]+"/, `"outputFileTracingRoot": ${JSON.stringify(projectRoot)}`);

if (raw !== before) {
  fs.writeFileSync(target, raw);
  console.log('[fix-next-deploy-paths] patched', target);
} else {
  console.log('[fix-next-deploy-paths] already OK');
}
