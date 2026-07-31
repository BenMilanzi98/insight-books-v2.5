import { describe, it, expect } from 'vitest';
import { assertRoleChangeSafe } from '@/lib/admin/authorization/assertRoleChangeSafe';
import { assertSoD, listGrantedPermissionKeys } from '@/lib/admin/authorization/assertSoD';

describe('assertRoleChangeSafe', () => {
  it('blocks self-escalation to Super Admin', () => {
    const r = assertRoleChangeSafe({
      actor: { id: 'a1', role: 'Billing Administrator' },
      targetAdminId: 'a1',
      newRole: 'Super Admin',
    });
    expect(r.ok).toBe(false);
  });

  it('blocks non-super granting Super Admin without dual control', () => {
    const r = assertRoleChangeSafe({
      actor: { id: 'a1', role: 'Security Administrator' },
      targetAdminId: 'a2',
      newRole: 'Super Admin',
    });
    expect(r.ok).toBe(false);
  });

  it('allows Super Admin to grant Super Admin', () => {
    const r = assertRoleChangeSafe({
      actor: { id: 'a1', role: 'Super Admin' },
      targetAdminId: 'a2',
      newRole: 'Super Admin',
    });
    expect(r.ok).toBe(true);
  });
});

describe('assertSoD', () => {
  it('blocks approve when create already held', () => {
    const r = assertSoD({
      heldPermissions: ['systemAdmin.billing.invoices.create'],
      attemptedPermission: 'systemAdmin.billing.invoices.approve',
    });
    expect(r.ok).toBe(false);
    expect(r.conflictId).toBe('billing_invoice_create_approve');
  });

  it('lists granted keys from nested JSON', () => {
    const keys = listGrantedPermissionKeys({
      permissions: { systemAdmin: { billing: { view: true, reconciliation: true } } },
    });
    expect(keys).toContain('systemAdmin.billing.view');
    expect(keys).toContain('systemAdmin.billing.reconciliation');
  });
});
