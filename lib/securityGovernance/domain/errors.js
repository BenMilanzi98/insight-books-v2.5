export class SecurityGovernanceError extends Error {
  constructor(code, message, { status = 400, retryable = false, context = {} } = {}) {
    super(message);
    this.name = 'SecurityGovernanceError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.context = context;
  }
}

export class AuthenticationRequiredError extends SecurityGovernanceError {
  constructor(message = 'Authentication required.') {
    super('AUTHENTICATION_REQUIRED', message, { status: 401 });
  }
}

export class ReauthenticationRequiredError extends SecurityGovernanceError {
  constructor(message = 'Reauthentication required for this action.') {
    super('REAUTHENTICATION_REQUIRED', message, { status: 401 });
  }
}

export class MultiFactorRequiredError extends SecurityGovernanceError {
  constructor(message = 'Multi-factor authentication is required.') {
    super('MULTI_FACTOR_REQUIRED', message, { status: 401 });
  }
}

export class InvalidSessionError extends SecurityGovernanceError {
  constructor(message = 'Session is invalid.') {
    super('INVALID_SESSION', message, { status: 401 });
  }
}

export class SessionRevokedError extends SecurityGovernanceError {
  constructor(message = 'Session has been revoked.') {
    super('SESSION_REVOKED', message, { status: 401 });
  }
}

export class PermissionDeniedError extends SecurityGovernanceError {
  constructor(message = 'Permission denied.', context = {}) {
    super('PERMISSION_DENIED', message, { status: 403, context });
  }
}

export class ScopeDeniedError extends SecurityGovernanceError {
  constructor(message = 'Scope denied for this resource.', context = {}) {
    super('SCOPE_DENIED', message, { status: 403, context });
  }
}

export class CrossTenantAccessError extends SecurityGovernanceError {
  constructor(message = 'Cross-business access rejected.', context = {}) {
    super('CROSS_TENANT_ACCESS', message, { status: 403, context });
  }
}

export class BusinessMembershipRequiredError extends SecurityGovernanceError {
  constructor(message = 'Active business membership is required.') {
    super('BUSINESS_MEMBERSHIP_REQUIRED', message, { status: 403 });
  }
}

export class SegregationOfDutiesConflictError extends SecurityGovernanceError {
  constructor(message = 'Segregation of duties conflict.', context = {}) {
    super('SEGREGATION_OF_DUTIES_CONFLICT', message, { status: 403, context });
  }
}

export class SelfApprovalNotAllowedError extends SecurityGovernanceError {
  constructor(message = 'Self-approval is not allowed for this action.') {
    super('SELF_APPROVAL_NOT_ALLOWED', message, { status: 403 });
  }
}

export class ApprovalRequestExpiredError extends SecurityGovernanceError {
  constructor(message = 'Approval request has expired.') {
    super('APPROVAL_REQUEST_EXPIRED', message, { status: 422 });
  }
}

export class ApprovalRequestInvalidatedError extends SecurityGovernanceError {
  constructor(message = 'Approval request was invalidated after source data changed.') {
    super('APPROVAL_REQUEST_INVALIDATED', message, { status: 422 });
  }
}

export class ApprovalChecksumMismatchError extends SecurityGovernanceError {
  constructor(message = 'Approval payload checksum does not match current source data.') {
    super('APPROVAL_CHECKSUM_MISMATCH', message, { status: 422 });
  }
}

export class RateLimitExceededError extends SecurityGovernanceError {
  constructor(message = 'Rate limit exceeded. Try again later.', context = {}) {
    super('RATE_LIMIT_EXCEEDED', message, { status: 429, retryable: true, context });
  }
}

export class WebhookSignatureError extends SecurityGovernanceError {
  constructor(message = 'Webhook signature verification failed.') {
    super('WEBHOOK_SIGNATURE_FAILED', message, { status: 401 });
  }
}

export class WebhookReplayError extends SecurityGovernanceError {
  constructor(message = 'Webhook replay rejected.') {
    super('WEBHOOK_REPLAY', message, { status: 409 });
  }
}

export class FileSecurityError extends SecurityGovernanceError {
  constructor(message = 'File failed security validation.', context = {}) {
    super('FILE_SECURITY', message, { status: 422, context });
  }
}

export class AuditIntegrityError extends SecurityGovernanceError {
  constructor(message = 'Audit integrity check failed.') {
    super('AUDIT_INTEGRITY_FAILURE', message, { status: 500 });
  }
}

export class ImpersonationDeniedError extends SecurityGovernanceError {
  constructor(message = 'Impersonation denied.') {
    super('IMPERSONATION_DENIED', message, { status: 403 });
  }
}

export class EmergencyAccessDeniedError extends SecurityGovernanceError {
  constructor(message = 'Emergency access denied.') {
    super('EMERGENCY_ACCESS_DENIED', message, { status: 403 });
  }
}

export class AiGovernanceBlockedError extends SecurityGovernanceError {
  constructor(message = 'AI action blocked by governance policy.', context = {}) {
    super('AI_GOVERNANCE_BLOCKED', message, { status: 403, context });
  }
}
