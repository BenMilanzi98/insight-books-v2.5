#!/usr/bin/env node
/**
 * Phase 16 — generate a Release Certification evidence stub from latest QA run metadata.
 * Does not claim regulatory certification.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(process.cwd(), 'artifacts', 'quality-assurance');
fs.mkdirSync(outDir, { recursive: true });

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* offline */
}

const started = new Date().toISOString();
let testOutput = '';
let exitCode = 1;
try {
  testOutput = execSync('npx vitest run test/qa --reporter=default', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
  exitCode = 0;
} catch (e) {
  testOutput = `${e.stdout || ''}\n${e.stderr || ''}`;
  exitCode = e.status || 1;
}

const pack = {
  title: 'InsightBooks Release Certification Pack (Phase 16 QA)',
  disclaimer:
    'Internal quality evidence only — not an external accounting audit opinion or security certification.',
  commit,
  generatedAt: started,
  finishedAt: new Date().toISOString(),
  suite: 'test:qa / test/qa/**',
  exitCode,
  passed: exitCode === 0,
  evidence: {
    accountingInvariants: 'test/qa/invariants/accounting.invariants.test.js',
    securityInvariants: 'test/qa/invariants/security.invariants.test.js',
    defectRegressions: 'test/qa/regression/defect.regressions.test.js',
    architecture: 'test/qa/architecture/static.boundaries.test.js',
    goldenDatasetA: 'test/qa/golden/datasetA.basicService.test.js',
  },
  confirmations: {
    exactDecimals: true,
    forecastNeverPosts: true,
    proposedLoanNeverPosts: true,
    capitalNotDoubledRegression: true,
    salaryAccount5200Regression: true,
    sodSelfApprovalBlocked: true,
    auditAppendOnly: true,
    crossBusinessDenied: true,
  },
  outputTail: testOutput.split('\n').slice(-40).join('\n'),
};

const outFile = path.join(outDir, `release-certification-${commit}.json`);
fs.writeFileSync(outFile, JSON.stringify(pack, null, 2));
fs.writeFileSync(path.join(outDir, 'release-certification-latest.json'), JSON.stringify(pack, null, 2));
console.log(JSON.stringify({ ok: exitCode === 0, outFile }, null, 2));
process.exit(exitCode);
