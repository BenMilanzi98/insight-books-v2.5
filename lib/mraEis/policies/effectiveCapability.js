import {
  BLOCKER,
  WARNING,
  PLATFORM_STATUS,
  ENTITLEMENT_STATUS,
  PARTICIPATION_STATUS,
  BUSINESS_OPS_STATUS,
  EIS_ENVIRONMENT,
  CERTIFICATION_STATUS,
  EIS_OPERATION,
  POLICY_VERSION,
  ACTIVE_ENTITLEMENT_STATUSES,
  OPERATION_MODE,
} from '../domain/constants.js';

const OPS_REQUIRING_OPERATIONAL = new Set([
  EIS_OPERATION.CREATE_FISCAL_SNAPSHOT,
  EIS_OPERATION.TRANSMIT_SALE,
  EIS_OPERATION.USE_OFFLINE_MODE,
  EIS_OPERATION.ACTIVATE_TERMINAL,
  EIS_OPERATION.SYNC_CONFIGURATION,
  EIS_OPERATION.MAP_PRODUCTS,
  EIS_OPERATION.MAP_TAXES,
  EIS_OPERATION.ENABLE_OPERATION,
]);

/**
 * Pure, deterministic capability evaluation.
 * Future runtime deps (terminal/config/mappings) are placeholders until Phase 5+.
 *
 * @param {object} input
 * @returns {object} MraEisCapabilityResult
 */
export function evaluateMraEisCapability(input = {}) {
  const {
    tenantId = null,
    businessId = null,
    requestedOperation = EIS_OPERATION.VIEW_EIS,
    environment = EIS_ENVIRONMENT.SANDBOX,
    platform = {},
    entitlement = null,
    participation = null,
    businessSetting = null,
    certification = null,
    offlineCertification = null,
    futureRuntime = {},
    featureFlags = {},
    now = new Date(),
  } = input;

  const blockers = [];
  const warnings = [];
  const requiredActions = [];

  const pushBlocker = (code, message, action) => {
    blockers.push({ code, message, action: action || null });
    if (action) requiredActions.push(action);
  };
  const pushWarning = (code, message) => warnings.push({ code, message });

  const platformStatus = platform.status || PLATFORM_STATUS.DISABLED;
  const platformEnabled = platformStatus === PLATFORM_STATUS.ENABLED;
  const emergencyPaused = platformStatus === PLATFORM_STATUS.EMERGENCY_PAUSED;
  const maintenance = platformStatus === PLATFORM_STATUS.MAINTENANCE;

  if (platformStatus === PLATFORM_STATUS.DISABLED || platformStatus === PLATFORM_STATUS.RETIRED) {
    pushBlocker(BLOCKER.EIS_PLATFORM_DISABLED, 'Platform EIS is disabled.', 'Contact InsightBooks System Administration.');
  }
  if (emergencyPaused) {
    pushBlocker(
      BLOCKER.EIS_PLATFORM_EMERGENCY_PAUSED,
      'Platform emergency pause is active. Local sales and accounting remain available.',
      'Wait for platform operators to end the pause.'
    );
  }
  if (maintenance) {
    pushBlocker(BLOCKER.EIS_PLATFORM_MAINTENANCE, 'Platform EIS is in maintenance.', 'Try again after maintenance ends.');
  }

  const entitlementStatus = entitlement?.status || ENTITLEMENT_STATUS.NOT_ENTITLED;
  let tenantSandboxAllowed = Boolean(entitlement?.sandboxAllowed);
  let tenantProductionAllowed = Boolean(entitlement?.productionAllowed);
  if (entitlementStatus === ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY) {
    tenantSandboxAllowed = true;
    tenantProductionAllowed = false;
  }
  if (entitlementStatus === ENTITLEMENT_STATUS.ENTITLED_PRODUCTION) {
    tenantSandboxAllowed = entitlement?.sandboxAllowed !== false;
    tenantProductionAllowed = true;
  }

  const effectiveUntil = entitlement?.effectiveUntil ? new Date(entitlement.effectiveUntil) : null;
  const effectiveFrom = entitlement?.effectiveFrom ? new Date(entitlement.effectiveFrom) : null;
  const expiredByDate = effectiveUntil && effectiveUntil.getTime() < now.getTime();
  const notYetEffective = effectiveFrom && effectiveFrom.getTime() > now.getTime();

  let resolvedEntitlementStatus = entitlementStatus;
  if (ACTIVE_ENTITLEMENT_STATUSES.has(entitlementStatus) && expiredByDate) {
    resolvedEntitlementStatus = ENTITLEMENT_STATUS.EXPIRED;
  }

  const tenantEntitled = ACTIVE_ENTITLEMENT_STATUSES.has(resolvedEntitlementStatus) && !notYetEffective;

  if (resolvedEntitlementStatus === ENTITLEMENT_STATUS.NOT_ENTITLED) {
    pushBlocker(BLOCKER.TENANT_NOT_ENTITLED, 'Tenant is not entitled to EIS.', 'Request entitlement from System Administration.');
  } else if (resolvedEntitlementStatus === ENTITLEMENT_STATUS.ENTITLEMENT_PENDING) {
    pushBlocker(BLOCKER.TENANT_ENTITLEMENT_PENDING, 'Entitlement is pending.', 'Wait for System Administration review.');
  } else if (resolvedEntitlementStatus === ENTITLEMENT_STATUS.SUSPENDED) {
    pushBlocker(BLOCKER.TENANT_ENTITLEMENT_SUSPENDED, 'Entitlement is suspended.', 'Contact System Administration.');
  } else if (resolvedEntitlementStatus === ENTITLEMENT_STATUS.REVOKED) {
    pushBlocker(BLOCKER.TENANT_ENTITLEMENT_REVOKED, 'Entitlement was revoked.', 'Request a new entitlement grant.');
  } else if (resolvedEntitlementStatus === ENTITLEMENT_STATUS.EXPIRED) {
    pushBlocker(BLOCKER.TENANT_ENTITLEMENT_EXPIRED, 'Entitlement has expired.', 'Request entitlement renewal.');
  }

  if (tenantEntitled && effectiveUntil) {
    const days = (effectiveUntil.getTime() - now.getTime()) / (24 * 3600 * 1000);
    if (days > 0 && days <= 30) {
      pushWarning(WARNING.ENTITLEMENT_EXPIRING, `Entitlement expires in ${Math.ceil(days)} day(s).`);
    }
  }
  if (resolvedEntitlementStatus === ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY) {
    pushWarning(WARNING.SANDBOX_ONLY, 'Sandbox entitlement only — production is not authorized.');
  }

  const requestedEnvironment = environment || EIS_ENVIRONMENT.SANDBOX;
  const isProductionEnv = requestedEnvironment === EIS_ENVIRONMENT.PRODUCTION;
  const isSandboxEnv =
    requestedEnvironment === EIS_ENVIRONMENT.SANDBOX ||
    requestedEnvironment === EIS_ENVIRONMENT.MOCK ||
    requestedEnvironment === EIS_ENVIRONMENT.DEVELOPMENT ||
    requestedEnvironment === EIS_ENVIRONMENT.CERTIFICATION ||
    requestedEnvironment === EIS_ENVIRONMENT.STAGING;

  let environmentAllowed = false;
  if (isProductionEnv) {
    environmentAllowed = tenantProductionAllowed && Boolean(featureFlags.production !== false);
    if (!tenantProductionAllowed) {
      pushBlocker(
        BLOCKER.PRODUCTION_NOT_AUTHORIZED,
        'Production EIS is not authorized for this tenant.',
        'Request production entitlement from System Administration.'
      );
    }
  } else if (isSandboxEnv) {
    environmentAllowed = tenantSandboxAllowed && Boolean(featureFlags.sandbox !== false);
    if (!tenantSandboxAllowed && tenantEntitled) {
      pushBlocker(BLOCKER.SANDBOX_NOT_AUTHORIZED, 'Sandbox EIS is not authorized.', 'Contact System Administration.');
    }
  } else {
    pushBlocker(BLOCKER.ENVIRONMENT_MISMATCH, `Unknown environment ${requestedEnvironment}.`);
  }

  const certStatus = certification?.status || CERTIFICATION_STATUS.NOT_STARTED;
  const certExpired =
    certification?.effectiveUntil && new Date(certification.effectiveUntil).getTime() < now.getTime();
  const productionCertOk =
    !certExpired &&
    (certStatus === CERTIFICATION_STATUS.CERTIFIED_ONLINE ||
      certStatus === CERTIFICATION_STATUS.PRODUCTION_APPROVED ||
      certStatus === CERTIFICATION_STATUS.NOT_REQUIRED_FOR_CURRENT_ACTION);

  let certificationSatisfied = true;
  if (isProductionEnv && OPS_REQUIRING_OPERATIONAL.has(requestedOperation)) {
    certificationSatisfied = productionCertOk;
    if (!productionCertOk) {
      pushBlocker(
        BLOCKER.PRODUCTION_CERTIFICATION_REQUIRED,
        'Valid production certification is required.',
        'Complete certification evidence with System Administration.'
      );
    }
  }
  if (requestedOperation === EIS_OPERATION.USE_OFFLINE_MODE) {
    const offlineOk =
      offlineCertification?.status === CERTIFICATION_STATUS.CERTIFIED_OFFLINE &&
      !(
        offlineCertification.effectiveUntil &&
        new Date(offlineCertification.effectiveUntil).getTime() < now.getTime()
      );
    if (!offlineOk) {
      certificationSatisfied = false;
      pushBlocker(
        BLOCKER.OFFLINE_NOT_CERTIFIED,
        'Offline EIS mode is not certified.',
        'Offline remains disabled until MRA certification and Phase 16.'
      );
    }
  }

  const participationStatus = participation?.status || PARTICIPATION_STATUS.NOT_STARTED;
  const tenantParticipating = participationStatus === PARTICIPATION_STATUS.OPTED_IN;
  if (
    requestedOperation !== EIS_OPERATION.VIEW_EIS &&
    requestedOperation !== EIS_OPERATION.VIEW_REPORTS &&
    tenantEntitled
  ) {
    if (participationStatus === PARTICIPATION_STATUS.NOT_STARTED || participationStatus === PARTICIPATION_STATUS.OPTED_OUT) {
      if (OPS_REQUIRING_OPERATIONAL.has(requestedOperation) || requestedOperation === EIS_OPERATION.START_SETUP || requestedOperation === EIS_OPERATION.ENABLE_OPERATION) {
        pushBlocker(BLOCKER.TENANT_NOT_PARTICIPATING, 'Tenant has not opted into EIS.', 'Opt in from Integrations → MRA EIS.');
      }
    }
    if (participationStatus === PARTICIPATION_STATUS.PAUSED) {
      pushBlocker(BLOCKER.TENANT_OPERATION_PAUSED, 'Tenant EIS participation is paused.', 'Resume participation to continue.');
    }
    if (participationStatus === PARTICIPATION_STATUS.SUSPENDED_BY_SYSTEM) {
      pushBlocker(BLOCKER.TENANT_ENTITLEMENT_SUSPENDED, 'Participation overridden by system suspension.', 'Contact System Administration.');
    }
  }

  const businessOperationalStatus = businessSetting?.status || BUSINESS_OPS_STATUS.UNAVAILABLE;
  const businessOperationallyEnabled = businessOperationalStatus === BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED;

  if (!businessSetting && OPS_REQUIRING_OPERATIONAL.has(requestedOperation)) {
    pushBlocker(BLOCKER.BUSINESS_SETTING_MISSING, 'Business EIS settings are missing.', 'Start EIS setup.');
  }
  if (businessOperationalStatus === BUSINESS_OPS_STATUS.SETUP_REQUIRED || businessOperationalStatus === BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS) {
    if (OPS_REQUIRING_OPERATIONAL.has(requestedOperation) || requestedOperation === EIS_OPERATION.ENABLE_OPERATION) {
      pushBlocker(BLOCKER.BUSINESS_SETUP_REQUIRED, 'EIS setup is incomplete.', 'Complete the readiness checklist.');
      pushWarning(WARNING.SETUP_INCOMPLETE, 'Setup has not finished.');
    }
  }
  if (businessOperationalStatus === BUSINESS_OPS_STATUS.PAUSED) {
    pushBlocker(BLOCKER.BUSINESS_OPERATION_PAUSED, 'Business EIS operation is paused.', 'Resume business EIS operation.');
  }
  if (
    businessOperationalStatus === BUSINESS_OPS_STATUS.DISABLED ||
    businessOperationalStatus === BUSINESS_OPS_STATUS.UNAVAILABLE
  ) {
    if (OPS_REQUIRING_OPERATIONAL.has(requestedOperation)) {
      pushBlocker(BLOCKER.BUSINESS_OPERATION_DISABLED, 'Business EIS operation is disabled.', 'Enable operational use after setup.');
    }
  }
  if (businessOperationalStatus === BUSINESS_OPS_STATUS.SUSPENDED_BY_SYSTEM) {
    pushBlocker(BLOCKER.BUSINESS_SUSPENDED_BY_SYSTEM, 'Business EIS is suspended by the system.', 'Contact System Administration.');
  }
  if (businessSetting?.preferredOperationMode === OPERATION_MODE.ONLINE_WITH_CERTIFIED_OFFLINE_FALLBACK) {
    pushWarning(WARNING.PHASE_DEPENDENCY_PENDING, 'Offline fallback preference is stored but offline remains certification-gated.');
  }

  // Future Phase 5+ placeholders — always block fiscal ops in Phase 4
  const terminalSatisfied = Boolean(futureRuntime.terminalActive);
  const configurationSatisfied = Boolean(futureRuntime.configurationCurrent);
  const siteMappingStatus = futureRuntime.siteMappingComplete ? 'COMPLETE' : 'REQUIRED';
  const productMappingStatus = futureRuntime.productMappingComplete ? 'COMPLETE' : 'REQUIRED';
  const taxMappingStatus = futureRuntime.taxMappingComplete ? 'COMPLETE' : 'REQUIRED';
  const paymentMappingStatus = futureRuntime.paymentMappingComplete ? 'COMPLETE' : 'REQUIRED';
  const terminalBlocked = Boolean(futureRuntime.terminalBlocked);

  if (OPS_REQUIRING_OPERATIONAL.has(requestedOperation)) {
    if (!terminalSatisfied) {
      pushBlocker(BLOCKER.TERMINAL_REQUIRED, 'An active MRA terminal is required (Phase 7).', 'Complete terminal activation in a later phase.');
    }
    if (terminalBlocked) {
      pushBlocker(BLOCKER.TERMINAL_BLOCKED, 'Terminal is blocked by MRA.', 'Resolve terminal block before transmitting.');
    }
    if (!configurationSatisfied) {
      pushBlocker(BLOCKER.CONFIGURATION_REQUIRED, 'Current MRA configuration is required (Phase 8).', 'Synchronize configuration in a later phase.');
    }
    if (!futureRuntime.siteMappingComplete) {
      pushBlocker(BLOCKER.SITE_MAPPING_REQUIRED, 'Site mapping is required (Phase 9).', 'Map branch/site in a later phase.');
    }
    if (!futureRuntime.productMappingComplete) {
      pushBlocker(BLOCKER.PRODUCT_MAPPING_REQUIRED, 'Product mappings are required (Phase 10).', 'Map products in a later phase.');
    }
    if (!futureRuntime.taxMappingComplete) {
      pushBlocker(BLOCKER.TAX_MAPPING_REQUIRED, 'Tax mappings are required (Phase 9).', 'Map taxes in a later phase.');
    }
    if (!futureRuntime.paymentMappingComplete) {
      pushBlocker(BLOCKER.PAYMENT_MAPPING_REQUIRED, 'Payment-method mappings are required (Phase 9).', 'Map payment methods in a later phase.');
    }
    pushWarning(WARNING.PHASE_DEPENDENCY_PENDING, 'Fiscal transmission is not enabled in Phase 4.');
  }

  if (featureFlags.tenantOptIn === false && requestedOperation === EIS_OPERATION.START_SETUP) {
    pushBlocker(BLOCKER.FEATURE_FLAG_DISABLED, 'Tenant opt-in feature flag is disabled.');
  }

  const setupSatisfied = [
    BUSINESS_OPS_STATUS.READY_FOR_ACTIVATION,
    BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED,
    BUSINESS_OPS_STATUS.PAUSED,
  ].includes(businessOperationalStatus);

  const controlPlaneOk =
    platformEnabled &&
    !emergencyPaused &&
    !maintenance &&
    tenantEntitled &&
    environmentAllowed &&
    certificationSatisfied !== false;

  const effectiveSetupAllowed =
    controlPlaneOk &&
    tenantParticipating &&
    participationStatus !== PARTICIPATION_STATUS.PAUSED &&
    participationStatus !== PARTICIPATION_STATUS.SUSPENDED_BY_SYSTEM &&
    businessOperationalStatus !== BUSINESS_OPS_STATUS.SUSPENDED_BY_SYSTEM &&
    businessOperationalStatus !== BUSINESS_OPS_STATUS.DISABLED;

  const effectiveOperational =
    controlPlaneOk &&
    tenantParticipating &&
    businessOperationallyEnabled &&
    terminalSatisfied &&
    configurationSatisfied &&
    Boolean(futureRuntime.siteMappingComplete) &&
    Boolean(futureRuntime.productMappingComplete) &&
    Boolean(futureRuntime.taxMappingComplete) &&
    Boolean(futureRuntime.paymentMappingComplete) &&
    !terminalBlocked;

  const effectiveAvailable =
    platformEnabled &&
    !emergencyPaused &&
    resolvedEntitlementStatus !== ENTITLEMENT_STATUS.NOT_ENTITLED &&
    resolvedEntitlementStatus !== ENTITLEMENT_STATUS.REVOKED;

  let operationAllowed = false;
  if (requestedOperation === EIS_OPERATION.VIEW_EIS || requestedOperation === EIS_OPERATION.VIEW_REPORTS) {
    operationAllowed = effectiveAvailable || resolvedEntitlementStatus === ENTITLEMENT_STATUS.NOT_ENTITLED;
  } else if (requestedOperation === EIS_OPERATION.START_SETUP || requestedOperation === EIS_OPERATION.MODIFY_SETTINGS) {
    operationAllowed = effectiveSetupAllowed && blockers.every((b) => !OPS_REQUIRING_OPERATIONAL.has(requestedOperation) || b.code !== BLOCKER.TERMINAL_REQUIRED);
    // Setup allowed even when future terminal blockers exist — strip those for setup ops
    const setupBlocking = blockers.filter(
      (b) =>
        ![
          BLOCKER.TERMINAL_REQUIRED,
          BLOCKER.TERMINAL_NOT_ACTIVE,
          BLOCKER.CONFIGURATION_REQUIRED,
          BLOCKER.SITE_MAPPING_REQUIRED,
          BLOCKER.PRODUCT_MAPPING_REQUIRED,
          BLOCKER.TAX_MAPPING_REQUIRED,
          BLOCKER.PAYMENT_MAPPING_REQUIRED,
        ].includes(b.code)
    );
    operationAllowed =
      platformEnabled &&
      !emergencyPaused &&
      !maintenance &&
      tenantEntitled &&
      tenantParticipating &&
      participationStatus !== PARTICIPATION_STATUS.PAUSED &&
      setupBlocking.length === 0;
  } else if (requestedOperation === EIS_OPERATION.PAUSE || requestedOperation === EIS_OPERATION.DISABLE) {
    operationAllowed = tenantEntitled && !emergencyPaused;
  } else if (OPS_REQUIRING_OPERATIONAL.has(requestedOperation)) {
    operationAllowed = effectiveOperational && blockers.length === 0;
  } else {
    operationAllowed = blockers.length === 0;
  }

  return {
    tenantId,
    businessId: businessId || tenantId,
    requestedOperation,
    platformStatus,
    platformEnabled,
    emergencyPaused,
    tenantEntitlementStatus: resolvedEntitlementStatus,
    tenantEntitled,
    tenantSandboxAllowed,
    tenantProductionAllowed,
    tenantParticipationStatus: participationStatus,
    tenantParticipating,
    businessOperationalStatus,
    businessOperationallyEnabled,
    requestedEnvironment,
    environmentAllowed,
    certificationStatus: certStatus,
    certificationSatisfied,
    setupStatus: businessSetting?.setupStatus || businessOperationalStatus,
    setupSatisfied,
    terminalStatus: futureRuntime.terminalStatus || (terminalSatisfied ? 'ACTIVE' : 'NOT_IMPLEMENTED'),
    terminalSatisfied,
    configurationStatus: futureRuntime.configurationStatus || (configurationSatisfied ? 'CURRENT' : 'NOT_IMPLEMENTED'),
    configurationSatisfied,
    siteMappingStatus,
    productMappingStatus,
    taxMappingStatus,
    paymentMappingStatus,
    terminalBlocked,
    effectiveAvailable,
    effectiveSetupAllowed,
    effectiveOperational,
    operationAllowed,
    blockers,
    warnings,
    requiredActions: [...new Set(requiredActions)],
    policyVersion: POLICY_VERSION,
    evaluatedAt: now.toISOString(),
  };
}

export function pausePolicyContract({ scope, pauseMode }) {
  const emergency = pauseMode === 'SYSTEM_EMERGENCY_PAUSE' || scope === 'PLATFORM_EMERGENCY';
  return {
    scope,
    pauseMode,
    allowNewFiscalSnapshots: false,
    allowQueueClaims: emergency ? false : pauseMode !== 'PAUSE_ALL_PROCESSING',
    allowRetries: emergency ? false : pauseMode === 'PAUSE_NEW_ONLY',
    allowReconciliation: true,
    allowReadAccess: true,
    allowConfigurationSync: !emergency,
    allowMappingMaintenance: !emergency,
  };
}

export function disablementPolicyContract({ mode, queueDepth = 0, unknownOutcomes = 0 }) {
  return {
    mode,
    preservesHistory: true,
    deletesCredentials: false,
    deletesTransmissions: false,
    allowImmediate:
      mode === 'DISABLE_BEFORE_SETUP' ||
      mode === 'DISABLE_BEFORE_ACTIVATION' ||
      mode === 'IMMEDIATE_ADMINISTRATIVE_SUSPENSION' ||
      mode === 'REVOKE_ENTITLEMENT',
    requiresQueueDrain: mode === 'DISABLE_AFTER_QUEUE_DRAINS',
    queueDepth,
    unknownOutcomes,
    queueDrainComplete: queueDepth === 0 && unknownOutcomes === 0,
    note: 'Queue-drain completion job is dormant until Phase 13+ transmission queues exist.',
  };
}
