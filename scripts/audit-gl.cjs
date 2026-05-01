#!/usr/bin/env node
/**
 * GL / trial balance reconciliation report for CI and auditors.
 *
 * Direct DB (default when AUDIT_GL_TENANT_ID is set — no Next server needed):
 *   AUDIT_GL_TENANT_ID=<uuid> node scripts/audit-gl.cjs 2025-01-01 2025-01-31 [branchId|all] [report.json]
 *
 * HTTP (running app — uses same auth as the browser):
 *   AUDIT_GL_SESSION=<session-token> node scripts/audit-gl.cjs ...
 *   # or AUDIT_GL_COOKIE="session=..."  (full Cookie header value for session only also works)
 *   Optional: AUDIT_GL_BASE_URL=http://localhost:3000
 *
 * Exit 0 only if report.allOk; otherwise exits 1.
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { createJiti } = require('jiti');

function parseArgs(argv) {
  const out = { start: null, end: null, branch: null, output: null, positional: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--start') out.start = argv[++i];
    else if (a === '--end') out.end = argv[++i];
    else if (a === '--branch') out.branch = argv[++i];
    else if (a === '--out') out.output = argv[++i];
    else if (!a.startsWith('-')) out.positional.push(a);
  }
  const p = out.positional;
  if (!out.start && p[0]) out.start = p[0];
  if (!out.end && p[1]) out.end = p[1];

  if (out.branch == null && p.length >= 3) {
    const third = p[2];
    if (!third.endsWith('.json')) out.branch = third;
  }
  if (!out.output) {
    const last = p[p.length - 1];
    if (last && last.endsWith('.json')) out.output = last;
  }

  return out;
}

async function runDirect({ start, end, branch }) {
  const jiti = createJiti(__filename, {
    interopDefault: true,
    alias: {
      '@': path.join(__dirname, '..'),
    },
  });

  const { runGlReconciliation } = jiti(path.join(__dirname, '..', 'lib/glReconciliation.js'));
  const prismaMod = jiti(path.join(__dirname, '..', 'lib/prisma.js'));
  const prisma = prismaMod.default || prismaMod;

  const tenantId = process.env.AUDIT_GL_TENANT_ID;
  if (!tenantId) {
    throw new Error('AUDIT_GL_TENANT_ID is required for direct DB mode');
  }

  const branchId =
    branch === 'all' || branch === '' || branch == null ? null : branch;

  try {
    return await runGlReconciliation({
      tenantId,
      branchId,
      startDate: start,
      endDate: end,
      prisma,
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function runHttp({ start, end, branch }) {
  const base = (process.env.AUDIT_GL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = new URL('/api/reports/gl-reconciliation', base);
  url.searchParams.set('startDate', start);
  url.searchParams.set('endDate', end);
  if (branch && branch !== 'all') url.searchParams.set('branchId', branch);
  else url.searchParams.set('branchId', 'all');

  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  const session = process.env.AUDIT_GL_SESSION;
  const cookie = process.env.AUDIT_GL_COOKIE;
  if (session) {
    headers.Authorization = `Bearer ${session}`;
  } else if (cookie) {
    headers.Cookie = cookie.includes('session=') ? cookie : `session=${cookie}`;
  } else {
    throw new Error(
      'HTTP mode: set AUDIT_GL_SESSION (Bearer token) or AUDIT_GL_COOKIE, or use direct mode with AUDIT_GL_TENANT_ID'
    );
  }

  const res = await fetch(url, { headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return body;
}

async function main() {
  const args = parseArgs(process.argv);
  const { start, end, branch, output } = args;

  if (!start || !end) {
    console.error(`
Usage:
  npm run audit:gl -- <startDate> <endDate> [branchId|all] [report.json]

  npm run audit:gl -- --start YYYY-MM-DD --end YYYY-MM-DD [--branch id|all] [--out report.json]

Direct DB (no server): set AUDIT_GL_TENANT_ID in the environment (e.g. .env).
HTTP: unset AUDIT_GL_TENANT_ID and set AUDIT_GL_SESSION or AUDIT_GL_COOKIE.
      Optional AUDIT_GL_BASE_URL (default http://localhost:3000).
`.trim());
    process.exit(2);
  }

  const useDirect = !!String(process.env.AUDIT_GL_TENANT_ID || '').trim();
  const report = useDirect
    ? await runDirect({ start, end, branch })
    : await runHttp({ start, end, branch });

  const json = JSON.stringify(report, null, 2);
  if (output) {
    const target = path.resolve(process.cwd(), output);
    fs.writeFileSync(target, json, 'utf8');
    console.error(`Wrote ${target}`);
  } else {
    console.log(json);
  }

  if (!report.allOk) {
    console.error('audit-gl: FAILED — see JSON above (allOk is false)');
    process.exit(1);
  }
  console.error('audit-gl: OK');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
