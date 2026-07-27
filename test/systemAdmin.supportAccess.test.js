import { describe, it, expect } from 'vitest';
import {
  SUPPORT_ACCESS_STATUSES,
  assertSupportAccessAllowed,
  buildSupportSessionPayload,
  isSupportSessionActive,
} from '@/lib/admin/supportAccess';

describe('supportAccess helpers', () => {
  it('requires admin and permission check', () => {
    expect(assertSupportAccessAllowed({ admin: null }).ok).toBe(false);
    expect(
      assertSupportAccessAllowed({
        admin: { id: 'a1' },
        permissionCheck: () => false,
      }).ok
    ).toBe(false);
    expect(
      assertSupportAccessAllowed({
        admin: { id: 'a1' },
        permissionCheck: () => true,
      }).ok
    ).toBe(true);
  });

  it('builds session payload with real actor and expiry bounds', () => {
    const now = new Date('2026-07-27T10:00:00.000Z');
    const built = buildSupportSessionPayload({
      adminId: 'admin-1',
      tenantId: 'tenant-1',
      reason: 'Investigating billing issue',
      durationMinutes: 60,
      now,
    });
    expect(built.ok).toBe(true);
    expect(built.session.status).toBe(SUPPORT_ACCESS_STATUSES.ACTIVE);
    expect(built.session.realActorId).toBe('admin-1');
    expect(built.session.effectiveTenantId).toBe('tenant-1');
    expect(built.session.expiresAt).toBe('2026-07-27T11:00:00.000Z');
  });

  it('rejects short reasons and missing ids', () => {
    expect(
      buildSupportSessionPayload({
        adminId: 'a',
        tenantId: 't',
        reason: 'short',
      }).ok
    ).toBe(false);
    expect(
      buildSupportSessionPayload({
        adminId: '',
        tenantId: 't',
        reason: 'Long enough reason text',
      }).ok
    ).toBe(false);
  });

  it('clamps duration between 15 and 240 minutes', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const short = buildSupportSessionPayload({
      adminId: 'a',
      tenantId: 't',
      reason: 'Long enough reason',
      durationMinutes: 1,
      now,
    });
    expect(new Date(short.session.expiresAt).getTime() - now.getTime()).toBe(15 * 60 * 1000);

    const long = buildSupportSessionPayload({
      adminId: 'a',
      tenantId: 't',
      reason: 'Long enough reason',
      durationMinutes: 9999,
      now,
    });
    expect(new Date(long.session.expiresAt).getTime() - now.getTime()).toBe(240 * 60 * 1000);
  });

  it('detects active vs expired sessions', () => {
    const now = new Date('2026-07-27T12:00:00.000Z');
    expect(
      isSupportSessionActive(
        {
          status: SUPPORT_ACCESS_STATUSES.ACTIVE,
          expiresAt: '2026-07-27T13:00:00.000Z',
        },
        now
      )
    ).toBe(true);
    expect(
      isSupportSessionActive(
        {
          status: SUPPORT_ACCESS_STATUSES.ACTIVE,
          expiresAt: '2026-07-27T11:00:00.000Z',
        },
        now
      )
    ).toBe(false);
    expect(
      isSupportSessionActive(
        {
          status: SUPPORT_ACCESS_STATUSES.ENDED,
          expiresAt: '2026-07-27T13:00:00.000Z',
        },
        now
      )
    ).toBe(false);
  });
});
