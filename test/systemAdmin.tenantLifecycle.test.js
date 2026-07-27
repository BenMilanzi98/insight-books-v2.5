import { describe, it, expect } from 'vitest';
import {
  TENANT_COMMANDS,
  canTransition,
  targetStatus,
  validateLifecycleCommand,
} from '@/lib/admin/tenantLifecycle';

describe('tenantLifecycle helpers', () => {
  it('exposes explicit lifecycle commands', () => {
    expect(TENANT_COMMANDS.ACTIVATE).toBe('ACTIVATE');
    expect(TENANT_COMMANDS.SUSPEND).toBe('SUSPEND');
    expect(TENANT_COMMANDS.REACTIVATE).toBe('REACTIVATE');
    expect(TENANT_COMMANDS.ARCHIVE).toBe('ARCHIVE');
  });

  it('maps commands to target statuses', () => {
    expect(targetStatus('ACTIVATE')).toBe('ACTIVE');
    expect(targetStatus('SUSPEND')).toBe('SUSPENDED');
    expect(targetStatus('REACTIVATE')).toBe('ACTIVE');
    expect(targetStatus('ARCHIVE')).toBe('ARCHIVED');
  });

  it('allows ACTIVATE from trial/draft statuses', () => {
    expect(canTransition('ACTIVATE', 'TRIAL')).toBe(true);
    expect(canTransition('ACTIVATE', 'DRAFT')).toBe(true);
    expect(canTransition('ACTIVATE', 'SUSPENDED')).toBe(false);
  });

  it('requires reason for SUSPEND and ARCHIVE', () => {
    expect(
      validateLifecycleCommand({
        command: 'SUSPEND',
        reason: '',
        currentStatus: 'ACTIVE',
      }).ok
    ).toBe(false);

    expect(
      validateLifecycleCommand({
        command: 'ARCHIVE',
        reason: '   ',
        currentStatus: 'SUSPENDED',
      }).ok
    ).toBe(false);

    expect(
      validateLifecycleCommand({
        command: 'SUSPEND',
        reason: 'Non-payment',
        currentStatus: 'ACTIVE',
      })
    ).toEqual({ ok: true, nextStatus: 'SUSPENDED' });
  });

  it('rejects unknown commands and illegal transitions', () => {
    expect(
      validateLifecycleCommand({
        command: 'DELETE',
        reason: 'nope',
        currentStatus: 'ACTIVE',
      }).ok
    ).toBe(false);

    expect(
      validateLifecycleCommand({
        command: 'REACTIVATE',
        reason: '',
        currentStatus: 'ACTIVE',
      }).ok
    ).toBe(false);
  });

  it('supports legacy lowercase statuses', () => {
    expect(canTransition('SUSPEND', 'active')).toBe(true);
    expect(canTransition('REACTIVATE', 'suspended')).toBe(true);
    expect(
      validateLifecycleCommand({
        command: 'ACTIVATE',
        currentStatus: 'trial',
      }).nextStatus
    ).toBe('ACTIVE');
  });
});
