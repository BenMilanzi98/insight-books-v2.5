import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { mockRetiredResponse } from '@/lib/admin/mockRetired';
import { assertAuditNotMutable } from '@/lib/admin/auditImmutability';
import { preventFormulaInjection } from '@/lib/admin/exportSafety';

const root = process.cwd();

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('residual hardening — no fake metrics', () => {
  it('security sessions return honest empty, not mock people', () => {
    const src = read('app/api/admin/security/sessions/route.js');
    expect(src).toMatch(/source:\s*'none'/);
    expect(src).not.toMatch(/John Doe|Jane Smith/);
  });

  it('legacy reports returns 410 to platform-reports', () => {
    const src = read('app/api/admin/reports/route.js');
    expect(src).toMatch(/410|Gone|platform-reports/);
    expect(src).not.toMatch(/mock data for now/i);
  });

  it('performance and metrics APIs do not call Math.random()', () => {
    const call = /Math\.random\s*\(/;
    expect(read('app/api/admin/performance/route.js')).not.toMatch(call);
    expect(read('app/api/admin/performance/metrics/route.js')).not.toMatch(call);
    expect(read('app/api/admin/metrics/route.js')).not.toMatch(call);
    expect(read('app/api/admin/analytics/route.js')).not.toMatch(call);
    expect(read('app/api/admin/dashboard/stats/route.js')).not.toMatch(call);
  });

  it('users export uses real prisma + formula safety', () => {
    const src = read('app/api/admin/users/export/route.js');
    expect(src).toMatch(/preventFormulaInjection/);
    expect(src).toMatch(/prisma\.user\.findMany/);
    expect(src).not.toMatch(/john\.doe@example\.com/i);
  });

  it('users roles uses database Role model', () => {
    const src = read('app/api/admin/users/roles/route.js');
    expect(src).toMatch(/prisma\.role\.findMany/);
    expect(src).not.toMatch(/mock data for now/i);
  });

  it('updates API is honest empty', () => {
    const src = read('app/api/admin/updates/route.js');
    expect(src).toMatch(/updates:\s*\[\]/);
    expect(src).not.toMatch(/Security Patch v1\.2\.1/);
  });
});

describe('residual hardening — health / reports / imports', () => {
  it('system health exposes email queues and retry route exists', () => {
    const health = read('app/api/admin/system-health/route.js');
    expect(health).toMatch(/queues/);
    expect(health).toMatch(/emailLog\.count/);
    expect(existsSync(join(root, 'app/api/admin/system-health/retry/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/insightbooks/reports/page.js'))).toBe(true);
    expect(existsSync(join(root, 'app/insightbooks/imports/page.js'))).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/imports/dry-run/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/security/compliance/route.js'))).toBe(true);
  });

  it('nav includes reports, imports, and security surfaces', () => {
    const overview = ADMIN_NAV_SECTIONS.find((s) => s.id === 'overview');
    const hrefs = overview.items.map((i) => i.href);
    expect(hrefs).toContain('/insightbooks/reports');
    expect(hrefs).toContain('/insightbooks/imports');
    const security = ADMIN_NAV_SECTIONS.find((s) => s.id === 'security');
    const audit = security.items.find((i) => i.href === '/insightbooks/audit');
    expect(audit.subItems.map((s) => s.href)).toContain('/insightbooks/security');
  });

  it('permission catalog includes users.export and health.retryJobs', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.users.export).toBe('systemAdmin.users.export');
    expect(SYSTEM_ADMIN_PERMISSIONS.health.retryJobs).toBe('systemAdmin.health.retryJobs');
  });
});

describe('residual hardening — helpers', () => {
  it('mockRetiredResponse and audit immutability work', () => {
    const r = mockRetiredResponse('Test');
    expect(r.mockRetired).toBe(true);
    expect(() => assertAuditNotMutable('update')).toThrow(/append-only/i);
    expect(preventFormulaInjection('=1+1')).toBe("'=1+1");
  });

  it('audit APIs require audit.view', () => {
    expect(read('app/api/admin/audit/logs/route.js')).toMatch(/audit\.view/);
    expect(read('app/api/admin/audit/admin-logs/route.js')).toMatch(/audit\.view/);
  });
});
