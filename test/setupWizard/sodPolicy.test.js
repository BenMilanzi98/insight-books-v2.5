import { describe, it, expect } from 'vitest';
import { assertSetupApprovalAllowed } from '../../lib/setupWizard/sodPolicy.js';

describe('assertSetupApprovalAllowed', () => {
  it('allows self-approval when policy says so', () => {
    expect(() =>
      assertSetupApprovalAllowed({ allowSelfApproval: true }, 'u1', 'u1')
    ).not.toThrow();
  });

  it('denies self-approval when segregated', () => {
    expect(() =>
      assertSetupApprovalAllowed({ allowSelfApproval: false }, 'u1', 'u1')
    ).toThrow(/Self-approval/);
  });
});
