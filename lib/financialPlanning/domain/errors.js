export class PlanningError extends Error {
  constructor(code, message, { retryable = false, context = {}, status = 400 } = {}) {
    super(message);
    this.name = 'PlanningError';
    this.code = code;
    this.retryable = retryable;
    this.context = context;
    this.status = status;
  }
}

export class PlanningConfigurationMissingError extends PlanningError {
  constructor(message = 'Approved planning configuration is required.') {
    super('PLANNING_CONFIGURATION_MISSING', message, { status: 422 });
  }
}

export class ForecastVersionImmutableError extends PlanningError {
  constructor(message = 'Approved forecast versions are immutable. Create a new version.') {
    super('FORECAST_VERSION_IMMUTABLE', message, { status: 409 });
  }
}

export class ForecastIntegrityBlockedError extends PlanningError {
  constructor(message = 'Forecast integrity is INVALID or BLOCKED; approval is not allowed.') {
    super('FORECAST_INTEGRITY_BLOCKED', message, { status: 422 });
  }
}

export class CrossTenantPlanningError extends PlanningError {
  constructor(message = 'Cross-business planning reference rejected.') {
    super('CROSS_TENANT_PLANNING', message, { status: 403 });
  }
}

export class InsufficientHistoricalDataError extends PlanningError {
  constructor(message = 'Insufficient historical periods for automatic baseline.') {
    super('INSUFFICIENT_HISTORICAL_DATA', message, { status: 422 });
  }
}

export class AISuggestionValidationError extends PlanningError {
  constructor(message = 'AI suggestion failed validation or requires human review.') {
    super('AI_SUGGESTION_VALIDATION', message, { status: 422 });
  }
}

export class ManualOverrideApprovalRequiredError extends PlanningError {
  constructor(message = 'Manual override requires a reason and approval where policy requires it.') {
    super('MANUAL_OVERRIDE_APPROVAL_REQUIRED', message, { status: 422 });
  }
}

export class ScenarioNotFoundError extends PlanningError {
  constructor(message = 'Scenario not found for this business.') {
    super('SCENARIO_NOT_FOUND', message, { status: 404 });
  }
}

export class ForecastVersionNotFoundError extends PlanningError {
  constructor(message = 'Forecast version not found for this business.') {
    super('FORECAST_VERSION_NOT_FOUND', message, { status: 404 });
  }
}
