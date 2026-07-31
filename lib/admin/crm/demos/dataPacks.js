/**
 * Demo data packs — Phase 14 Wave 3.
 * Versioned safe packs; checksum; reject Production Tenant/data/credentials.
 */

import { createHash } from 'crypto';
import {
  CRM_DEMO_DATA_PACK_SOURCE_KIND,
  CRM_DEMO_DATA_PACK_SOURCE_KINDS,
  CRM_DEMO_VERSION_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import {
  assertSafeJsonTree,
  assertSodApprover,
  canApproveDemoContent,
  canEditDemoContent,
  canViewDemoContent,
  isEditableStatus,
  nextVersionNumber,
  normalizeCode,
  resolveDemoContentAccess,
  retirePriorActive,
} from './versioning.js';

const FORBIDDEN_SOURCE = new Set([
  'PRODUCTION',
  'PRODUCTION_TENANT',
  'CUSTOMER_DB',
  'LIVE_CLONE',
  'PROD',
  'LIVE',
  'CUSTOMER_PRODUCTION',
  'MRA_EIS_SANDBOX',
  'MRA_EIS',
]);

const CREDENTIAL_KEY_RE =
  /^(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|connection[_-]?string|dsn|credential|auth[_-]?token)$/i;

const PROD_SIGNAL_RE =
  /production[_-]?tenant|prod[_-]?db|live[_-]?payment|mra[_-]?eis|eis[_-]?environment|postgres(ql)?:\/\/.*prod|amazonaws\.com\/prod|sk_live_|rk_live_/i;

export function hasCrmDemoDataPackModel(prisma) {
  return typeof prisma?.crmDemoDataPack?.create === 'function';
}

export function serializeDataPack(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    sourceKind: row.sourceKind,
    checksum: row.checksum || null,
    payloadJson: row.payloadJson ?? null,
    authoredByAdminId: row.authoredByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    activeDirectlyEditable: false,
    productionDataRejected: true,
  };
}

function checksumPayload(payload) {
  const normalised = JSON.stringify(payload ?? null);
  return createHash('sha256').update(normalised).digest('hex');
}

function scanObjectForForbidden(value, path = 'root', hits = []) {
  if (value == null) return hits;
  if (typeof value === 'string') {
    if (PROD_SIGNAL_RE.test(value)) {
      hits.push({ path, reason: 'production_signal_in_value' });
    }
    if (
      /password\s*=|secret\s*=|api[_-]?key\s*=/i.test(value) ||
      /Bearer\s+[A-Za-z0-9._\-]{20,}/.test(value)
    ) {
      hits.push({ path, reason: 'credential_signal_in_value' });
    }
    return hits;
  }
  if (typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanObjectForForbidden(v, `${path}[${i}]`, hits));
    return hits;
  }
  for (const [k, v] of Object.entries(value)) {
    if (CREDENTIAL_KEY_RE.test(k)) {
      hits.push({ path: `${path}.${k}`, reason: 'credential_key' });
    }
    if (/productionTenantId|prodTenantId|liveDbUrl|productionConnection/i.test(k)) {
      hits.push({ path: `${path}.${k}`, reason: 'production_key' });
    }
    if (k === 'isProductionData' && v === true) {
      hits.push({ path: `${path}.${k}`, reason: 'is_production_data_flag' });
    }
    if (k === 'containsCredentials' && v === true) {
      hits.push({ path: `${path}.${k}`, reason: 'contains_credentials_flag' });
    }
    scanObjectForForbidden(v, `${path}.${k}`, hits);
  }
  return hits;
}

/**
 * Reject Production Tenant/data/credentials as data pack source.
 */
export function validateDataPackSource(args = {}) {
  const sourceKind = String(args.sourceKind || CRM_DEMO_DATA_PACK_SOURCE_KIND.SYNTHETIC)
    .trim()
    .toUpperCase();
  if (FORBIDDEN_SOURCE.has(sourceKind) || !CRM_DEMO_DATA_PACK_SOURCE_KINDS.includes(sourceKind)) {
    return {
      ok: false,
      error: 'production_data_pack_source_rejected',
      reason: 'source_kind_forbidden_or_unknown',
      sourceKind,
    };
  }
  if (args.productionTenantId || (args.tenantId && args.isProduction === true)) {
    return {
      ok: false,
      error: 'production_tenant_rejected',
      reason: 'production_tenant_not_allowed_as_data_pack',
    };
  }
  if (args.containsCredentials === true || args.isProductionData === true) {
    return {
      ok: false,
      error: 'production_credentials_or_data_rejected',
      reason: 'explicit_production_or_credential_flag',
    };
  }
  const hits = scanObjectForForbidden(args.payloadJson);
  if (hits.length > 0) {
    return {
      ok: false,
      error: 'production_data_or_credentials_detected',
      reason: hits[0].reason,
      hits: hits.slice(0, 20),
    };
  }
  return { ok: true, sourceKind };
}

async function loadPack(prisma, packId) {
  const id = packId ? String(packId).trim() : '';
  if (!id || !hasCrmDemoDataPackModel(prisma)) return null;
  try {
    return await prisma.crmDemoDataPack.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

export async function createDataPackVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_data_pack_forbidden' };
  }
  if (!hasCrmDemoDataPackModel(prisma)) {
    return { ok: false, error: 'crm_demo_data_pack_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = normalizeCode(args.code);
  if (!code) return { ok: false, error: 'invalid_data_pack_code' };

  const validation = validateDataPackSource(args);
  if (!validation.ok) return validation;

  let payloadJson;
  try {
    payloadJson =
      args.payloadJson !== undefined ? assertSafeJsonTree(args.payloadJson) : { entities: [] };
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  const version =
    args.version != null && !Number.isNaN(Number(args.version))
      ? Number(args.version)
      : await nextVersionNumber(prisma.crmDemoDataPack, code);

  try {
    const row = await prisma.crmDemoDataPack.create({
      data: {
        code,
        version,
        status: CRM_DEMO_VERSION_STATUS.DRAFT,
        name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
        sourceKind: validation.sourceKind,
        checksum: checksumPayload(payloadJson),
        payloadJson,
        authoredByAdminId: args.admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return { ok: true, dataPack: serializeDataPack(row) };
  } catch (err) {
    if (err?.code === 'P2002') {
      return { ok: false, error: 'data_pack_version_conflict' };
    }
    return { ok: false, error: err?.message || 'data_pack_create_failed' };
  }
}

export async function updateDataPackVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_data_pack_forbidden' };
  }
  const row = await loadPack(prisma, args.dataPackId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'data_pack_not_found' };
  if (!isEditableStatus(row.status)) {
    return { ok: false, error: 'active_demo_content_not_directly_editable' };
  }

  const patch = args.patch || args;
  const nextPayload =
    patch.payloadJson !== undefined ? patch.payloadJson : row.payloadJson;
  const validation = validateDataPackSource({
    sourceKind: patch.sourceKind || row.sourceKind,
    payloadJson: nextPayload,
    productionTenantId: patch.productionTenantId,
    tenantId: patch.tenantId,
    isProduction: patch.isProduction,
    containsCredentials: patch.containsCredentials,
    isProductionData: patch.isProductionData,
  });
  if (!validation.ok) return validation;

  let payloadJson = nextPayload;
  try {
    if (patch.payloadJson !== undefined) {
      payloadJson = assertSafeJsonTree(patch.payloadJson);
    }
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoDataPack.update({
    where: { id: row.id },
    data: {
      name:
        patch.name !== undefined
          ? String(patch.name || '').trim().slice(0, 200) || null
          : row.name,
      sourceKind: validation.sourceKind,
      payloadJson,
      checksum: checksumPayload(payloadJson),
      updatedAt: now,
    },
  });
  return { ok: true, dataPack: serializeDataPack(updated) };
}

export async function requestDataPackApproval(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_data_pack_forbidden' };
  }
  const row = await loadPack(prisma, args.dataPackId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'data_pack_not_found' };
  if (!isEditableStatus(row.status) && row.status !== CRM_DEMO_VERSION_STATUS.DRAFT) {
    return { ok: false, error: 'data_pack_not_requestable' };
  }
  const updated = await prisma.crmDemoDataPack.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL,
      updatedAt: args.now || new Date(),
    },
  });
  return { ok: true, dataPack: serializeDataPack(updated) };
}

export async function approveDataPackVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canApproveDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_data_pack_approve_forbidden' };
  }
  const row = await loadPack(prisma, args.dataPackId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'data_pack_not_found' };
  if (row.status !== CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL) {
    return { ok: false, error: 'data_pack_not_pending_approval' };
  }
  const sod = assertSodApprover(row, args.admin);
  if (!sod.ok) return sod;

  const revalidate = validateDataPackSource({
    sourceKind: row.sourceKind,
    payloadJson: row.payloadJson,
  });
  if (!revalidate.ok) return revalidate;

  const now = args.now || new Date();
  await retirePriorActive(prisma.crmDemoDataPack, row.code, now);
  const updated = await prisma.crmDemoDataPack.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.ACTIVE,
      approvedByAdminId: sod.approverId,
      approvedAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, dataPack: serializeDataPack(updated) };
}

export async function listDataPackVersions(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_data_pack_forbidden' };
  }
  if (!hasCrmDemoDataPackModel(prisma)) {
    return { ok: false, error: 'crm_demo_data_pack_model_unavailable', status: 'UNAVAILABLE' };
  }
  const where = {};
  if (args.code) where.code = normalizeCode(args.code) || String(args.code).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  const take = Math.min(
    Math.max(Number(args.limit) || CRM_LIST_DEFAULT_LIMIT, 1),
    CRM_LIST_MAX_LIMIT
  );
  const rows = await prisma.crmDemoDataPack.findMany({
    where,
    orderBy: [{ code: 'asc' }, { version: 'desc' }],
    take,
  });
  return { ok: true, dataPacks: rows.map(serializeDataPack), count: rows.length };
}
