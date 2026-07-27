/**
 * Fiscal number scope resolution — Phase 12.
 * Server-authoritative. Ambiguous scope blocks.
 */
import { resolveFiscalNumberContract, getOnlineOfflineNumberPolicy } from './fiscalNumberContractRegistry.js';

export const SCOPE_RESOLUTION_VERSION = 'phase12-scope-resolution-v1';

/**
 * resolveFiscalNumberScope
 */
export function resolveFiscalNumberScope({
  tenantId,
  businessId,
  branchId = null,
  terminalId = null,
  mraSiteId = null,
  sourceType,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  onlineOrOfflineMode = 'ONLINE',
} = {}) {
  const blockers = [];
  const warnings = [];
  const env = String(environment).toUpperCase();
  const mode = String(onlineOrOfflineMode || 'ONLINE').toUpperCase();
  const contractResult = resolveFiscalNumberContract({ environment: env });
  const offlinePolicy = getOnlineOfflineNumberPolicy();

  if (mode === 'OFFLINE' || mode === 'CERTIFIED_OFFLINE') {
    blockers.push('OFFLINE_NUMBERING_DISABLED');
    return blocked(blockers, warnings, contractResult, {
      tenantId,
      businessId,
      terminalId,
      env,
      mode,
    });
  }

  if (!terminalId) blockers.push('TERMINAL_REQUIRED_FOR_SCOPE');
  if (!tenantId || !businessId) blockers.push('TENANT_BUSINESS_REQUIRED');
  if (tenantId !== businessId) blockers.push('BUSINESS_SCOPE_MISMATCH');

  if (!contractResult.allowsAllocation) {
    blockers.push('FISCAL_NUMBER_CONTRACT_UNVERIFIED');
  }

  // Provisional sandbox scope: terminal + business date + environment (not inventing MRA site-only)
  const businessDate = toBusinessDate(transactionDate);
  const scopeKey = [
    'v1',
    env,
    'ONLINE',
    tenantId,
    businessId,
    terminalId || 'NO_TERMINAL',
    businessDate,
    sourceType || 'ANY',
  ].join('|');

  if (blockers.length) {
    return blocked(blockers, warnings, contractResult, {
      tenantId,
      businessId,
      terminalId,
      env,
      mode,
      scopeKey,
    });
  }

  return {
    resolved: true,
    scopeKey,
    scopeDimensions: {
      tenantId,
      businessId,
      terminalId,
      branchId,
      mraSiteId,
      environment: env,
      onlineOrOfflineMode: 'ONLINE',
      businessDate,
      sourceType,
    },
    contractVersion: contractResult.registryVersion,
    contractKey: contractResult.contract?.key,
    resetBoundary: contractResult.contract?.resetPolicy || 'PER_BUSINESS_DAY',
    nextSequencePolicy: 'ATOMIC_INCREMENT',
    isSynthetic: contractResult.isSynthetic,
    offlinePolicy,
    blockers,
    warnings,
    resolutionVersion: SCOPE_RESOLUTION_VERSION,
  };
}

function blocked(blockers, warnings, contractResult, ids) {
  return {
    resolved: false,
    scopeKey: null,
    scopeDimensions: {
      tenantId: ids.tenantId,
      businessId: ids.businessId,
      terminalId: ids.terminalId,
      environment: ids.env,
      onlineOrOfflineMode: ids.mode,
    },
    contractVersion: contractResult.registryVersion,
    contractKey: contractResult.contract?.key,
    resetBoundary: null,
    nextSequencePolicy: null,
    isSynthetic: contractResult.isSynthetic,
    blockers,
    warnings,
    resolutionVersion: SCOPE_RESOLUTION_VERSION,
  };
}

function toBusinessDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

export function formatSyntheticFiscalNumber({ terminalId, businessDate, sequence }) {
  const short = String(terminalId || 'TERM').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
  const day = String(businessDate).replace(/-/g, '');
  const seq = String(sequence).padStart(6, '0');
  return `SYN-${short}-${day}-${seq}`;
}
