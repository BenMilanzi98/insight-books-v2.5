import { buildActorContext } from '../../../lib/securityGovernance/domain/actorContext.js';
import { businessId, userId } from './ids.js';

export function buildActor({
  business = businessId(1),
  user = userId(1),
  roles = ['Clerk'],
  permissions = ['journal.view'],
  branchScopes = [],
  membershipStatus = 'ACTIVE',
} = {}) {
  return buildActorContext({
    userId: user,
    businessId: business,
    roles,
    permissions,
    branchScopes,
    membershipStatus,
    authenticationMethod: 'SESSION',
  });
}

export function actorForBusiness(business, opts = {}) {
  return buildActor({
    business,
    user: opts.user || userId(1),
    roles: opts.roles || ['Clerk'],
    permissions: opts.permissions || ['journal.view'],
    branchScopes: opts.branchScopes || [],
    membershipStatus: opts.membershipStatus || 'ACTIVE',
  });
}

export function unauthorizedActor() {
  return buildActorContext({
    userId: null,
    businessId: null,
    roles: [],
    permissions: [],
    membershipStatus: null,
  });
}

export function buildOtherBusinessActor() {
  return buildActor({
    business: businessId(2),
    user: userId(2),
    permissions: ['journal.view', 'journal.post'],
  });
}
