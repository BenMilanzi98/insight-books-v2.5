#!/usr/bin/env node
/**
 * Phase 17 — lightweight load smoke against a running app.
 * Does NOT certify production capacity. Never target production without approval.
 *
 * Usage:
 *   node scripts/perf-load-smoke.cjs --base=http://127.0.0.1:3000 --concurrency=5 --requests=50
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const base = arg('base', process.env.PERF_BASE_URL || 'http://127.0.0.1:3000');
const concurrency = Number(arg('concurrency', '5'));
const requests = Number(arg('requests', '40'));
const pathName = arg('path', '/api/system/health/live');

function fetchOnce(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const t0 = Date.now();
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        timeout: 15_000,
      },
      (res) => {
        res.resume();
        res.on('end', () =>
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, ms: Date.now() - t0 })
        );
      }
    );
    req.on('error', (e) => resolve({ ok: false, status: 0, ms: Date.now() - t0, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, ms: Date.now() - t0, error: 'timeout' });
    });
    req.end();
  });
}

async function run() {
  const url = `${base.replace(/\/$/, '')}${pathName}`;
  const results = [];
  let next = 0;

  async function worker() {
    while (next < requests) {
      const i = next++;
      results[i] = await fetchOnce(url);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  const started = Date.now();
  await Promise.all(workers);
  const elapsed = Date.now() - started;

  const ok = results.filter((r) => r?.ok).length;
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q) => lat[Math.min(lat.length - 1, Math.ceil(lat.length * q) - 1)] || 0;

  const report = {
    title: 'Phase 17 load smoke (NOT capacity certification)',
    base,
    path: pathName,
    concurrency,
    requests,
    elapsedMs: elapsed,
    success: ok,
    failure: requests - ok,
    errorRate: requests ? (requests - ok) / requests : 1,
    latencyMs: { p50: p(0.5), p95: p(0.95), p99: p(0.99), max: lat[lat.length - 1] || 0 },
    certified: false,
    generatedAt: new Date().toISOString(),
  };

  const outDir = path.join(process.cwd(), 'artifacts', 'performance-reliability');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `load-smoke-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'load-smoke-latest.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.failure === 0, outFile, ...report }, null, 2));
  process.exit(report.failure === 0 ? 0 : 1);
}

run();
