import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static guard: payroll status / details / payslip must look up by id + tenantId.
 * Full HTTP IDOR tests need a seeded DB; this prevents regressions that drop tenant scope.
 */
describe('payroll tenant scoping (static)', () => {
  const root = join(process.cwd());

  it('status route scopes findFirst by id and tenantId', () => {
    const src = readFileSync(
      join(root, 'app/api/payroll/[id]/status/route.js'),
      'utf8'
    );
    expect(src).toMatch(/findFirst\s*\(\s*\{[\s\S]*where:\s*\{\s*id,\s*tenantId:\s*user\.tenantId/);
    expect(src).not.toMatch(/findUnique\s*\(\s*\{\s*where:\s*\{\s*id\s*\}/);
  });

  it('details and payslip routes scope by tenantId', () => {
    const details = readFileSync(
      join(root, 'app/api/payroll/[id]/details/route.js'),
      'utf8'
    );
    const payslip = readFileSync(
      join(root, 'app/api/payroll/[id]/payslip/route.js'),
      'utf8'
    );
    expect(details).toMatch(/tenantId:\s*user\.tenantId/);
    expect(payslip).toMatch(/tenantId:\s*user\.tenantId/);
  });
});
