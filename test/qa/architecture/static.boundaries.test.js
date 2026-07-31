/**
 * Lightweight static / architectural assertions for Phase 16.
 * Scans source files for known anti-patterns (fail CI when introduced).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function listJs(dir, acc = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return acc;
  for (const name of fs.readdirSync(full)) {
    const rel = path.join(dir, name).replace(/\\/g, '/');
    const abs = path.join(ROOT, rel);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      listJs(rel, acc);
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
      acc.push(rel);
    }
  }
  return acc;
}

describe('Architecture: security & accounting boundaries', () => {
  it('securityGovernance audit service forbids update/delete', () => {
    const src = read('lib/securityGovernance/application/auditService.js');
    expect(src).toMatch(/AUDIT_APPEND_ONLY/);
    expect(src).toMatch(/cannot be updated/);
    expect(src).toMatch(/cannot be deleted/);
  });

  it('session cookie parser supports signed v2 tokens', () => {
    const src = read('lib/sessionCookie.js');
    expect(src).toMatch(/v2\./);
    expect(src).toMatch(/createHmac/);
  });

  it('tenantApiAccess includes V2 / security API prefixes', () => {
    const src = read('lib/tenantApiAccess.js');
    for (const prefix of [
      '/api/accounting-v2',
      '/api/coa-v2',
      '/api/bank-reconciliation',
      '/api/loan-readiness',
      '/api/security-governance',
      '/api/financial-planning',
    ]) {
      expect(src, `missing rule for ${prefix}`).toContain(prefix);
    }
  });

  it('financial planning and loan readiness engines declare neverPostsToGl', () => {
    const plan = read('lib/financialPlanning/domain/threeStatementEngine.js');
    const loan = read('lib/loanReadiness/domain/assessmentEngine.js');
    expect(plan.includes('neverPostsToGl') || plan.includes('Never writes')).toBe(true);
    expect(loan).toMatch(/neverPostsToGl/);
  });

  it('no focused Vitest tests committed under test/', () => {
    // Match live .only calls; avoid matching this file's own pattern string.
    const focused = /\b(?:test|it|describe)\.only\s*\(/;
    const files = listJs('test');
    const offenders = [];
    for (const f of files) {
      const text = read(f);
      if (focused.test(text)) offenders.push(f);
    }
    expect(offenders, `focused tests: ${offenders.join(', ')}`).toEqual([]);
  });
});
