export class LoanReadinessError extends Error {
  constructor(code, message, { retryable = false, context = {}, status = 400 } = {}) {
    super(message);
    this.name = 'LoanReadinessError';
    this.code = code;
    this.retryable = retryable;
    this.context = context;
    this.status = status;
  }
}

export class LoanReadinessConfigurationMissingError extends LoanReadinessError {
  constructor(message = 'Approved Loan Readiness configuration is required.') {
    super('LOAN_READINESS_CONFIGURATION_MISSING', message, { status: 422 });
  }
}

export class AssessmentVersionImmutableError extends LoanReadinessError {
  constructor(message = 'Approved assessments are immutable. Create a new version.') {
    super('ASSESSMENT_VERSION_IMMUTABLE', message, { status: 409 });
  }
}

export class AssessmentIntegrityBlockedError extends LoanReadinessError {
  constructor(message = 'Assessment integrity is INVALID or BLOCKED; approval is not allowed.') {
    super('ASSESSMENT_INTEGRITY_BLOCKED', message, { status: 422 });
  }
}

export class CrossTenantLoanReadinessError extends LoanReadinessError {
  constructor(message = 'Cross-business loan readiness reference rejected.') {
    super('CROSS_TENANT_LOAN_READINESS', message, { status: 403 });
  }
}

export class ProtectedAttributeInputError extends LoanReadinessError {
  constructor(attrs = []) {
    super(
      'PROTECTED_ATTRIBUTE_INPUT',
      `Protected personal attributes cannot be used in scoring: ${attrs.join(', ')}`,
      { status: 422, context: { attrs } }
    );
  }
}

export class ScoreWeightsInvalidError extends LoanReadinessError {
  constructor(message = 'Score model weights must total exactly 100%.') {
    super('SCORE_WEIGHTS_INVALID', message, { status: 422 });
  }
}

export class InvalidLoanTermsError extends LoanReadinessError {
  constructor(message = 'Loan terms are invalid for amortization.') {
    super('INVALID_LOAN_TERMS', message, { status: 422 });
  }
}

export class AssessmentNotFoundError extends LoanReadinessError {
  constructor(message = 'Assessment not found for this business.') {
    super('ASSESSMENT_NOT_FOUND', message, { status: 404 });
  }
}

export class SeparationOfDutiesError extends LoanReadinessError {
  constructor(
    message = 'Separation of duties: the preparer cannot be the sole approver. A different reviewer must mark the assessment reviewed first, or another user must approve.'
  ) {
    super('SEPARATION_OF_DUTIES', message, { status: 403 });
  }
}

export class AiCommentaryValidationError extends LoanReadinessError {
  constructor(message = 'AI commentary failed validation or requires human review.') {
    super('AI_COMMENTARY_VALIDATION', message, { status: 422 });
  }
}
