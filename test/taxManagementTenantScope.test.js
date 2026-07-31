import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static guard: tax-management + reversal APIs must scope by tenantId.
 * Full HTTP IDOR needs a seeded multi-tenant DB; this blocks regressions that drop scope.
 */
function walkRouteFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkRouteFiles(full, out);
    else if (name === 'route.js') out.push(full);
  }
  return out;
}

describe('tax-management + reversals tenant scoping (static)', () => {
  const root = join(process.cwd());

  it('every tax-management route uses user.tenantId', () => {
    const routes = walkRouteFiles(join(root, 'app/api/tax-management'));
    expect(routes.length).toBeGreaterThan(5);
    for (const file of routes) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).toMatch(/user\.tenantId/);
      expect(src, file).not.toMatch(/findUnique\s*\(\s*\{\s*where:\s*\{\s*id\s*\}/);
    }
  });

  it('reverse API scopes pending/register/approve by tenantId', () => {
    const src = readFileSync(join(root, 'app/api/transactions/reverse/route.js'), 'utf8');
    expect(src).toMatch(/const tenantId = user\.tenantId/);
    expect(src).toMatch(/listPendingReversalApprovals\(\s*\{\s*tenantId/);
    expect(src).toMatch(/approveTransactionReversal\(\s*\{[\s\S]*tenantId/);
    expect(src).toMatch(/executeTransactionReversal\(\s*\{[\s\S]*tenantId/);
    expect(src).toMatch(/findRegisterRow\(\s*\{[\s\S]*tenantId/);
  });

  it('reversal engine approve/reject/listPending query by tenantId', () => {
    const src = readFileSync(join(root, 'lib/reversals/reversalEngine.js'), 'utf8');
    expect(src).toMatch(/findFirst\(\s*\{[\s\S]*where:\s*\{\s*id:\s*reversalId,\s*tenantId/);
    expect(src).toMatch(/findMany\(\s*\{[\s\S]*where:\s*\{[\s\S]*tenantId/);
  });

  it('reversals list API scopes by user.tenantId', () => {
    const src = readFileSync(join(root, 'app/api/transactions/reversals/route.js'), 'utf8');
    expect(src).toMatch(/tenantId:\s*user\.tenantId/);
  });

  it('SoD settings API upserts by tenantId', () => {
    const src = readFileSync(
      join(root, 'app/api/transactions/reversals/sod/route.js'),
      'utf8'
    );
    expect(src).toMatch(/where:\s*\{\s*tenantId:\s*user\.tenantId/);
    expect(src).toMatch(/create:\s*\{[\s\S]*tenantId:\s*user\.tenantId/);
  });
});
