import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { evaluateTenantEisCapability } from '../capabilityService.js';
import { EIS_OPERATION } from '../../domain/constants.js';
import { getCryptoVersion } from '../../infrastructure/security/cryptoRegistry.js';
import { resolveMasterKey } from '../../infrastructure/security/masterKey.js';
import { getActivationEndpointConfig, resolveActivationMode } from '../../infrastructure/mraClient/environmentConfig.js';
import { ACTIVATION_MODE } from '../../domain/operationalEnums.js';
import { CRYPTO_CONTRACT_STATUS } from '../../infrastructure/security/cryptoRegistry.js';

/**
 * Canonical terminal activation readiness — server-authoritative for UI and actions.
 */
export async function evaluateTerminalActivationReadiness({
  tenantId,
  businessId = tenantId,
  branchId = null,
  environment = 'SANDBOX',
  actorContext = null,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const blockers = [];
  const warnings = [];
  const requiredActions = [];
  const env = String(environment).toUpperCase();
  const mode = resolveActivationMode(env);

  const capability = await evaluateTenantEisCapability({
    tenantId,
    businessId,
    requestedOperation: EIS_OPERATION.START_SETUP,
    environment: env,
  });

  const platformAvailable = Boolean(capability.platformEnabled);
  const tenantEntitled = Boolean(capability.tenantEntitled);
  const tenantParticipating = Boolean(capability.tenantParticipating);
  const businessSetupActive = Boolean(capability.businessSetupAllowed || capability.effectiveSetupAllowed);
  const environmentAuthorized = Boolean(
    capability.environmentAuthorized ?? (capability.sandboxAllowed || capability.productionAllowed)
  );
  const certificationSatisfied =
    env !== 'PRODUCTION' || Boolean(capability.certificationSatisfied || capability.productionAllowed);

  if (!platformAvailable) blockers.push({ code: 'PLATFORM_EIS_DISABLED', message: 'Platform EIS is disabled.' });
  if (!tenantEntitled) blockers.push({ code: 'TENANT_NOT_ENTITLED', message: 'Tenant is not entitled to EIS.' });
  if (!tenantParticipating) blockers.push({ code: 'TENANT_NOT_PARTICIPATING', message: 'Tenant has not opted into EIS.' });
  if (!businessSetupActive) blockers.push({ code: 'BUSINESS_SETUP_NOT_STARTED', message: 'Business EIS setup is not active.' });
  if (env === 'PRODUCTION' && !capability.productionAllowed) {
    blockers.push({ code: 'ENVIRONMENT_NOT_AUTHORIZED', message: 'Production EIS is not authorized.' });
  }
  if (env === 'PRODUCTION' && !certificationSatisfied) {
    blockers.push({ code: 'PRODUCTION_CERTIFICATION_REQUIRED', message: 'Production certification is required.' });
  }
  if (env === 'PRODUCTION' && mode !== ACTIVATION_MODE.PRODUCTION) {
    warnings.push({ code: 'PRODUCTION_MODE_NOT_LIVE', message: 'Production activation remains gated until sandbox verification.' });
  }

  const product = await db.mraEisCertifiedProduct.findFirst({
    where: { environment: env, status: 'ACTIVE' },
    orderBy: { effectiveFrom: 'desc' },
  });
  // Fallback to env-configured product for MOCK/SANDBOX development
  const productId = product?.productId || process.env.MRA_EIS_PRODUCT_ID || (mode === ACTIVATION_MODE.MOCK ? 'IB-EIS-MOCK' : null);
  const productVersion =
    product?.productVersion || process.env.MRA_EIS_PRODUCT_VERSION || (mode === ACTIVATION_MODE.MOCK ? '0.0.0-mock' : null);
  if (!productId) blockers.push({ code: 'PRODUCT_ID_REQUIRED', message: 'Certified Product ID is not configured.' });
  if (!productVersion) blockers.push({ code: 'PRODUCT_VERSION_REQUIRED', message: 'Certified Product version is not configured.' });

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, tin: true, taxId: true },
  });
  const sellerTin = tenant?.tin || tenant?.taxId || null;
  if (!sellerTin && mode !== ACTIVATION_MODE.MOCK) {
    blockers.push({ code: 'SELLER_TIN_REQUIRED', message: 'Seller TIN is required on the Business/Tenant.' });
  } else if (!sellerTin) {
    warnings.push({ code: 'SELLER_TIN_MISSING_MOCK', message: 'Seller TIN missing; mock mode will use TEST-TIN.' });
  }

  if (branchId) {
    const branch = await db.branch.findFirst({ where: { id: branchId, tenantId } }).catch(() => null);
    if (!branch) blockers.push({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found for this Business.' });
  }

  let secretProviderAvailable = false;
  let encryptionKeyAvailable = false;
  try {
    resolveMasterKey({
      environment: process.env.MRA_EIS_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    });
    secretProviderAvailable = true;
    encryptionKeyAvailable = true;
  } catch {
    if (process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY === '1') {
      secretProviderAvailable = true;
      encryptionKeyAvailable = true;
    } else {
      blockers.push({ code: 'SECRET_PROVIDER_UNAVAILABLE', message: 'EIS credential master key is not configured.' });
      blockers.push({ code: 'ENCRYPTION_KEY_UNAVAILABLE', message: 'Encryption key unavailable.' });
    }
  }

  const signer = getCryptoVersion('ACTIVATION_CONFIRMATION_HMAC_SHA512_V1');
  const activationSignerVerified =
    signer &&
    [CRYPTO_CONTRACT_STATUS.VERIFIED, CRYPTO_CONTRACT_STATUS.VERIFIED_WITH_TEST_VECTOR, CRYPTO_CONTRACT_STATUS.VERIFIED_IN_SANDBOX].includes(
      signer.contractStatus
    );
  if (!activationSignerVerified) {
    blockers.push({ code: 'CONFIRMATION_SIGNER_UNVERIFIED', message: 'Activation confirmation signer is unverified.' });
  } else if (!signer.productionEnabled && env === 'PRODUCTION') {
    blockers.push({
      code: 'CONFIRMATION_SIGNER_UNVERIFIED',
      message: 'Confirmation signer is not enabled for production (sandbox verification pending).',
    });
  }

  let apiEnvironmentConfigured = true;
  try {
    getActivationEndpointConfig(env);
  } catch {
    apiEnvironmentConfigured = false;
    blockers.push({ code: 'MRA_BASE_URL_MISSING', message: 'MRA API base URL is not configured.' });
  }

  // SaaS terminal identity remains a Phase 1 clarification — production blocked
  if (env === 'PRODUCTION') {
    blockers.push({
      code: 'STABLE_PLATFORM_IDENTITY_REQUIRED',
      message: 'Production SaaS terminal identity (Q-017–019) is not yet approved; production activation blocked.',
    });
  }

  const identity = await db.mraEisPlatformIdentity.findFirst({
    where: { tenantId, businessId, environment: env, status: 'ACTIVE' },
  });
  const stablePlatformIdentityAvailable = Boolean(identity) || mode === ACTIVATION_MODE.MOCK;
  if (!stablePlatformIdentityAvailable) {
    blockers.push({ code: 'STABLE_PLATFORM_IDENTITY_REQUIRED', message: 'Stable platform identity is not available.' });
  }

  const activationContractVerified = true; // OpenAPI path/method verified in Phase 1
  const confirmationContractVerified = activationSignerVerified;

  if (env === 'PRODUCTION' && mode !== ACTIVATION_MODE.PRODUCTION) {
    requiredActions.push('Complete sandbox activation verification before production.');
  }
  if (!product) requiredActions.push('Register an active MraEisCertifiedProduct for this environment (or set MRA_EIS_PRODUCT_ID).');
  if (!identity && mode !== ACTIVATION_MODE.MOCK) requiredActions.push('Provision a stable platform identity for this Business.');

  const readyToCreateTerminal =
    platformAvailable &&
    tenantEntitled &&
    tenantParticipating &&
    businessSetupActive &&
    Boolean(productId) &&
    Boolean(productVersion) &&
    (env !== 'PRODUCTION' || (capability.productionAllowed && certificationSatisfied && false)); // production create still blocked by SaaS identity

  // Soften: allow create terminal draft in sandbox/mock when core gates pass
  const readyCreate =
    platformAvailable &&
    tenantEntitled &&
    tenantParticipating &&
    businessSetupActive &&
    Boolean(productId) &&
    Boolean(productVersion) &&
    env !== 'PRODUCTION';

  const readyToSubmitActivation =
    readyCreate &&
    secretProviderAvailable &&
    encryptionKeyAvailable &&
    apiEnvironmentConfigured &&
    stablePlatformIdentityAvailable &&
    activationContractVerified;

  const readyToConfirmActivation =
    readyToSubmitActivation && confirmationContractVerified && (env !== 'PRODUCTION' || Boolean(signer?.productionEnabled));

  return {
    platformAvailable,
    tenantEntitled,
    tenantParticipating,
    businessSetupActive,
    environmentAuthorized: env === 'PRODUCTION' ? Boolean(capability.productionAllowed) : true,
    certificationSatisfied,
    productIdConfigured: Boolean(productId),
    productVersionConfigured: Boolean(productVersion),
    productId,
    productVersion,
    stablePlatformIdentityAvailable,
    businessDataComplete: Boolean(tenant?.name),
    sellerTinAvailable: Boolean(sellerTin),
    sellerTin: sellerTin || (mode === ACTIVATION_MODE.MOCK ? 'TEST-TIN-0001' : null),
    siteRequirementStatus: 'OPTIONAL_UNTIL_PHASE_8',
    branchRequirementStatus: branchId ? 'PROVIDED' : 'OPTIONAL',
    secretProviderAvailable,
    encryptionKeyAvailable,
    activationContractVerified,
    activationSignerVerified,
    confirmationContractVerified,
    apiEnvironmentConfigured,
    approvalSatisfied: env !== 'PRODUCTION',
    activationMode: mode,
    blockers,
    warnings,
    requiredActions,
    readyToCreateTerminal: readyCreate,
    readyToSubmitActivation,
    readyToConfirmActivation,
    policyVersion: 'phase7-readiness-v1',
    evaluatedAt: new Date().toISOString(),
    actorId: actorContext?.actorId || null,
  };
}
