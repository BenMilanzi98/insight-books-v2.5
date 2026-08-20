/**
 * Next.js 16 can race-write .next/diagnostics/build-diagnostics.json on Windows.
 * A concurrent read then throws: SyntaxError Expected ',' or '}' ... at JSON.parse
 * Re-apply a tolerant parse after npm installs overwrite node_modules/next.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'next',
  'dist',
  'diagnostics',
  'build-diagnostics.js'
);

if (!fs.existsSync(target)) {
  console.warn('[patch-next-build-diagnostics] next diagnostics file not found — skip');
  process.exit(0);
}

const src = fs.readFileSync(target, 'utf8');
if (src.includes('Concurrent writes can leave this file truncated')) {
  console.log('[patch-next-build-diagnostics] already applied');
  process.exit(0);
}

const needle =
  "    const existingDiagnostics = JSON.parse(await (0, _promises.readFile)(diagnosticsFile, 'utf8').catch(()=>'{}'));";

const replacement = `    let existingDiagnostics = {};
    try {
        const raw = await (0, _promises.readFile)(diagnosticsFile, 'utf8').catch(()=>'{}');
        existingDiagnostics = JSON.parse(raw);
        if (!existingDiagnostics || typeof existingDiagnostics !== 'object' || Array.isArray(existingDiagnostics)) {
            existingDiagnostics = {};
        }
    } catch  {
        // Concurrent writes can leave this file truncated on Windows; treat as empty.
        existingDiagnostics = {};
    }`;

if (!src.includes(needle)) {
  console.warn('[patch-next-build-diagnostics] unexpected next version — needle not found; skip');
  process.exit(0);
}

fs.writeFileSync(target, src.replace(needle, replacement));
console.log('[patch-next-build-diagnostics] applied');
