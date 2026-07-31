#!/usr/bin/env node
/**
 * Emit capacity certification stub from unit/smoke evidence.
 * Marks certified:false until load/soak evidence files exist.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(process.cwd(), 'artifacts', 'performance-reliability');
fs.mkdirSync(outDir, { recursive: true });

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ignore */
}

let unitOk = false;
try {
  execSync('npx vitest run test/performanceReliability.engine.test.js test/qa/performance --reporter=dot', {
    stdio: 'inherit',
  });
  unitOk = true;
} catch {
  unitOk = false;
}

const loadLatest = path.join(outDir, 'load-smoke-latest.json');
let load = null;
if (fs.existsSync(loadLatest)) {
  try {
    load = JSON.parse(fs.readFileSync(loadLatest, 'utf8'));
  } catch {
    load = null;
  }
}

const readinessCsv = [
  'component,status,notes',
  'docs,READY,docs/performance-reliability',
  'health_probes,READY,/api/system/health',
  'tenant_fairness,READY_WITH_WARNINGS,in-memory single-node',
  'connection_pool_calc,READY,lib/performanceReliability/connectionPool.js',
  'load_certification,REQUIRES_LOAD_EVIDENCE,run scripts/perf-load-smoke.cjs against staging',
  'soak_certification,REQUIRES_SOAK_EVIDENCE,pending',
  'backup_restore_timed,REQUIRES_RECOVERY_VALIDATION,pending',
  'outbox_dispatcher,REQUIRES_QUEUE_TUNING,enqueue without worker',
].join('\n');

fs.writeFileSync(path.join(outDir, 'platform-performance-readiness.csv'), readinessCsv);

const pack = {
  title: 'InsightBooks Capacity Certification Pack (Phase 17)',
  certified: false,
  reason: 'Unit/scaffolding only — production capacity not claimed without approved load/soak/restore evidence.',
  commit,
  generatedAt: new Date().toISOString(),
  unitTestsPassed: unitOk,
  loadSmoke: load,
  safeOperatingLimit: null,
  warningLimit: null,
  criticalLimit: null,
  accountingConsistencyPolicy:
    'Every load scenario MUST run Trial Balance / control-account checks — see DATA_CONSISTENCY_UNDER_LOAD.md',
  evidence: {
    docs: 'docs/performance-reliability/',
    readinessCsv: 'artifacts/performance-reliability/platform-performance-readiness.csv',
  },
};

fs.writeFileSync(path.join(outDir, `capacity-certification-${commit}.json`), JSON.stringify(pack, null, 2));
fs.writeFileSync(path.join(outDir, 'capacity-certification-latest.json'), JSON.stringify(pack, null, 2));
console.log(JSON.stringify({ ok: unitOk, certified: false, outDir }, null, 2));
process.exit(unitOk ? 0 : 1);
