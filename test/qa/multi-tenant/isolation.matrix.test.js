/**
 * Multi-tenant isolation matrix — SEC-INV-002/003 and cache key scoping.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateAuthorization,
  businessCacheKey,
  buildActorContext,
  AuthzDecision,
} from '../../../lib/securityGovernance/index.js';
import { actorForBusiness, unauthorizedActor } from '../factories/actorFactory.js';
import { deterministicId } from '../factories/ids.js';

describe('Multi-tenant isolation matrix', () => {
  const businessA = deterministicId('biz', 'A');
  const businessB = deterministicId('biz', 'B');
  const recordB = deterministicId('inv', 'B-1');

  it('Business A actor cannot access Business B resource (valid foreign ID)', () => {
    const actor = actorForBusiness(businessA, { permissions: ['invoices.read'] });
    const decision = evaluateAuthorization({
      actor,
      permission: 'invoices.read',
      resourceBusinessId: businessB,
    });
    expect(decision.decision).toBe(AuthzDecision.DENY);
    expect(decision.code).toBe('CROSS_BUSINESS');
  });

  it('Business A actor can access Business A resource with permission', () => {
    const actor = actorForBusiness(businessA, { permissions: ['invoices.read'] });
    const decision = evaluateAuthorization({
      actor,
      permission: 'invoices.read',
      resourceBusinessId: businessA,
    });
    expect(decision.decision).toBe(AuthzDecision.ALLOW);
  });

  it('unauthenticated actor is denied', () => {
    const decision = evaluateAuthorization({
      actor: unauthorizedActor(),
      permission: 'invoices.read',
      resourceBusinessId: businessA,
    });
    expect(decision.decision).toBe(AuthzDecision.DENY);
    expect(decision.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('permission without membership-active status is denied', () => {
    const actor = actorForBusiness(businessA, {
      permissions: ['invoices.read'],
      membershipStatus: 'SUSPENDED',
    });
    const decision = evaluateAuthorization({
      actor,
      permission: 'invoices.read',
      resourceBusinessId: businessA,
    });
    expect(decision.decision).toBe(AuthzDecision.DENY);
    expect(decision.code).toBe('MEMBERSHIP_INACTIVE');
  });

  it('cache keys require businessId and do not collide across businesses', () => {
    expect(() => businessCacheKey({ resource: 'tb', businessId: null })).toThrow(/businessId/);
    const a = businessCacheKey({
      resource: 'trial-balance',
      businessId: businessA,
      filterKey: 'P1',
    });
    const b = businessCacheKey({
      resource: 'trial-balance',
      businessId: businessB,
      filterKey: 'P1',
    });
    expect(a).not.toEqual(b);
    expect(a).toContain(String(businessA));
    expect(b).toContain(String(businessB));
  });

  it('actor context preserves business boundary for foreign record IDs', () => {
    const actor = buildActorContext({
      userId: 'u1',
      businessId: businessA,
      roles: ['Accountant'],
      permissions: ['journals.read'],
      membershipStatus: 'ACTIVE',
    });
    expect(actor.businessId).toBe(businessA);
    const decision = evaluateAuthorization({
      actor,
      permission: 'journals.read',
      resourceBusinessId: businessB,
      resourceOwnerId: recordB,
    });
    expect(decision.code).toBe('CROSS_BUSINESS');
  });
});
