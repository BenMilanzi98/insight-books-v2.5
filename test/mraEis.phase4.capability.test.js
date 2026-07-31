import { describe, expect, it } from 'vitest';
import {
  evaluateMraEisCapability,
  pausePolicyContract,
  disablementPolicyContract,
  PLATFORM_STATUS,
  ENTITLEMENT_STATUS,
  PARTICIPATION_STATUS,
  BUSINESS_OPS_STATUS,
  EIS_OPERATION,
  EIS_ENVIRONMENT,
  CERTIFICATION_STATUS,
  assertEntitlementTransition,
  ENTITLEMENT_TRANSITIONS,
} from '../lib/mraEis/index.js';

describe('Phase 4 EIS effective capability', () => {
  it('defaults platform disabled and tenant not entitled', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.TRANSMIT_SALE,
    });
    expect(result.platformEnabled).toBe(false);
    expect(result.tenantEntitled).toBe(false);
    expect(result.effectiveOperational).toBe(false);
    expect(result.blockers.some((b) => b.code === 'EIS_PLATFORM_DISABLED')).toBe(true);
    expect(result.blockers.some((b) => b.code === 'TENANT_NOT_ENTITLED')).toBe(true);
  });

  it('sandbox entitlement does not authorize production', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.TRANSMIT_SALE,
      environment: EIS_ENVIRONMENT.PRODUCTION,
      platform: { status: PLATFORM_STATUS.ENABLED },
      entitlement: {
        status: ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY,
        sandboxAllowed: true,
        productionAllowed: false,
      },
      participation: { status: PARTICIPATION_STATUS.OPTED_IN },
      businessSetting: { status: BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED },
      featureFlags: { sandbox: true, production: true },
    });
    expect(result.tenantProductionAllowed).toBe(false);
    expect(result.environmentAllowed).toBe(false);
    expect(result.blockers.some((b) => b.code === 'PRODUCTION_NOT_AUTHORIZED')).toBe(true);
  });

  it('emergency pause overrides tenant operational enablement', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.START_SETUP,
      platform: { status: PLATFORM_STATUS.EMERGENCY_PAUSED },
      entitlement: { status: ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY },
      participation: { status: PARTICIPATION_STATUS.OPTED_IN },
      businessSetting: { status: BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS },
      featureFlags: { sandbox: true },
    });
    expect(result.emergencyPaused).toBe(true);
    expect(result.operationAllowed).toBe(false);
    expect(result.blockers.some((b) => b.code === 'EIS_PLATFORM_EMERGENCY_PAUSED')).toBe(true);
  });

  it('system suspension of participation blocks setup', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.START_SETUP,
      platform: { status: PLATFORM_STATUS.ENABLED },
      entitlement: { status: ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY },
      participation: { status: PARTICIPATION_STATUS.SUSPENDED_BY_SYSTEM },
      businessSetting: { status: BUSINESS_OPS_STATUS.AVAILABLE },
      featureFlags: { sandbox: true },
    });
    expect(result.operationAllowed).toBe(false);
  });

  it('production transmit requires certification', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.TRANSMIT_SALE,
      environment: EIS_ENVIRONMENT.PRODUCTION,
      platform: { status: PLATFORM_STATUS.ENABLED },
      entitlement: {
        status: ENTITLEMENT_STATUS.ENTITLED_PRODUCTION,
        sandboxAllowed: true,
        productionAllowed: true,
      },
      participation: { status: PARTICIPATION_STATUS.OPTED_IN },
      businessSetting: { status: BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED },
      certification: { status: CERTIFICATION_STATUS.NOT_STARTED },
      featureFlags: { production: true, sandbox: true },
      futureRuntime: {
        terminalActive: true,
        configurationCurrent: true,
        siteMappingComplete: true,
        productMappingComplete: true,
        taxMappingComplete: true,
        paymentMappingComplete: true,
      },
    });
    expect(result.blockers.some((b) => b.code === 'PRODUCTION_CERTIFICATION_REQUIRED')).toBe(true);
    expect(result.effectiveOperational).toBe(false);
  });

  it('offline requires offline certification', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.USE_OFFLINE_MODE,
      platform: { status: PLATFORM_STATUS.ENABLED },
      entitlement: { status: ENTITLEMENT_STATUS.ENTITLED_PRODUCTION, productionAllowed: true },
      participation: { status: PARTICIPATION_STATUS.OPTED_IN },
      businessSetting: { status: BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED },
      certification: { status: CERTIFICATION_STATUS.PRODUCTION_APPROVED },
      offlineCertification: { status: CERTIFICATION_STATUS.NOT_STARTED },
      featureFlags: { production: true, sandbox: true },
    });
    expect(result.blockers.some((b) => b.code === 'OFFLINE_NOT_CERTIFIED')).toBe(true);
  });

  it('phase 4 future runtime blockers prevent transmit even when controls pass', () => {
    const result = evaluateMraEisCapability({
      tenantId: 't1',
      requestedOperation: EIS_OPERATION.TRANSMIT_SALE,
      environment: EIS_ENVIRONMENT.SANDBOX,
      platform: { status: PLATFORM_STATUS.ENABLED },
      entitlement: { status: ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY },
      participation: { status: PARTICIPATION_STATUS.OPTED_IN },
      businessSetting: { status: BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED },
      featureFlags: { sandbox: true },
    });
    expect(result.blockers.some((b) => b.code === 'TERMINAL_REQUIRED')).toBe(true);
    expect(result.effectiveOperational).toBe(false);
  });

  it('rejects revoked resume transition', () => {
    expect(() =>
      assertEntitlementTransition(ENTITLEMENT_STATUS.REVOKED, ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY)
    ).toThrow(/Invalid transition/);
    expect(ENTITLEMENT_TRANSITIONS[ENTITLEMENT_STATUS.REVOKED].size).toBe(0);
  });

  it('pause and disablement contracts preserve history semantics', () => {
    const pause = pausePolicyContract({ scope: 'TENANT', pauseMode: 'PAUSE_NEW_ONLY' });
    expect(pause.allowNewFiscalSnapshots).toBe(false);
    expect(pause.allowReadAccess).toBe(true);
    const disable = disablementPolicyContract({ mode: 'REVOKE_ENTITLEMENT' });
    expect(disable.preservesHistory).toBe(true);
    expect(disable.deletesTransmissions).toBe(false);
  });
});
