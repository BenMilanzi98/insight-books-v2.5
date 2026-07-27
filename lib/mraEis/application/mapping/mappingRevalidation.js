import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS, EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { markMappingsStale } from './mappingLifecycle.js';
import { calculateMraEisMappingCompleteness } from './mappingCompleteness.js';

const KIND_BY_EVENT = {
  [EIS_OUTBOX_EVENT.SITE_MAPPING_REVALIDATION_REQUESTED]: 'SITE',
  [EIS_OUTBOX_EVENT.TAX_MAPPING_REVALIDATION_REQUESTED]: 'TAX',
  [EIS_OUTBOX_EVENT.LEVY_MAPPING_REVALIDATION_REQUESTED]: 'LEVY',
  [EIS_OUTBOX_EVENT.PAYMENT_MAPPING_REVALIDATION_REQUESTED]: 'PAYMENT',
};

/**
 * Consume Phase 8 mapping-revalidation events.
 * Never auto-remap to a nearest new definition.
 */
export async function revalidateMappingsForConfigurationChange({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  configurationSetChecksum = null,
  eventType = null,
  mappingKinds = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const kinds = mappingKinds
    || (eventType && KIND_BY_EVENT[eventType] ? [KIND_BY_EVENT[eventType]] : ['SITE', 'TAX', 'LEVY', 'PAYMENT']);

  const results = [];

  for (const kind of kinds) {
    const model =
      kind === 'SITE'
        ? 'mraEisSiteMapping'
        : kind === 'TAX'
          ? 'mraEisTaxMapping'
          : kind === 'LEVY'
            ? 'mraEisLevyMapping'
            : 'mraEisPaymentMethodMapping';

    const actives = await db[model].findMany({
      where: { tenantId, businessId, ...(kind !== 'LEVY' ? { environment: env } : {}), status: MAPPING_STATUS.ACTIVE },
    });

    let markedStale = 0;
    let markedConflict = 0;
    let remainedActive = 0;

    for (const row of actives) {
      let outcome = 'ACTIVE';

      if (kind === 'SITE') {
        const site = await db.mraEisSite.findFirst({
          where: { tenantId, businessId, mraSiteId: row.mraSiteId, environment: env },
        });
        if (!site) outcome = 'STALE';
        else if (!site.active) outcome = 'CONFLICT';
        else if (
          configurationSetChecksum
          && row.sourceConfigurationSnapshotId
          && site.sourceConfigurationSnapshotId
          && site.sourceChecksum
          && configurationSetChecksum !== site.sourceChecksum
        ) {
          outcome = 'STALE';
        }
      }

      if (kind === 'TAX') {
        const ext = row.externalTaxDefinitionId
          ? await db.mraEisExternalTaxDefinition.findFirst({
              where: { id: row.externalTaxDefinitionId, tenantId, businessId },
            })
          : await db.mraEisExternalTaxDefinition.findFirst({
              where: { tenantId, businessId, externalTaxId: row.mraTaxRateId, environment: env },
            });
        if (!ext) outcome = 'STALE';
        else if (ext.active === false) outcome = 'CONFLICT';
        else if (Number(ext.rate) !== Number(row.mraRateSnapshot)) outcome = 'CONFLICT';
      }

      if (kind === 'LEVY') {
        const ext = row.externalLevyDefinitionId
          ? await db.mraEisExternalLevyDefinition.findFirst({
              where: { id: row.externalLevyDefinitionId, tenantId, businessId },
            })
          : null;
        if (row.externalLevyDefinitionId && !ext) outcome = 'STALE';
        else if (ext && ext.active === false) outcome = 'CONFLICT';
      }

      if (kind === 'PAYMENT') {
        // Payment codes from docs/config — if mapping references unknown non-canonical code, conflict
        const code = String(row.mraPaymentMethodCode || '');
        if (!code || code.includes(' ')) outcome = 'CONFLICT';
      }

      if (outcome === 'STALE') {
        await db[model].update({
          where: { id: row.id },
          data: { status: MAPPING_STATUS.STALE, version: { increment: 1 } },
        });
        markedStale += 1;
      } else if (outcome === 'CONFLICT') {
        await db[model].update({
          where: { id: row.id },
          data: { status: MAPPING_STATUS.CONFLICT, version: { increment: 1 } },
        });
        markedConflict += 1;
      } else {
        remainedActive += 1;
      }
    }

    results.push({ kind, examined: actives.length, markedStale, markedConflict, remainedActive });

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorType: 'SERVICE',
      action: `${kind}_MAPPING_REVALIDATED`,
      resourceType: model,
      resourceId: businessId,
      environment: env,
      metadata: {
        configurationSetChecksum,
        eventType,
        markedStale,
        markedConflict,
        remainedActive,
        autoRemap: false,
      },
    }, db);
  }

  const completeness = await calculateMraEisMappingCompleteness({
    tenantId,
    businessId,
    environment: env,
    db,
  });

  return {
    results,
    completeness,
    autoRemapped: false,
    revalidationVersion: 'phase9-revalidation-v1',
  };
}

export async function markAllActiveMappingsStaleForBusiness({
  tenantId,
  businessId = tenantId,
  reason = 'CONFIGURATION_CHANGE',
  db = prisma,
}) {
  const kinds = ['SITE', 'TAX', 'LEVY', 'PAYMENT'];
  const out = [];
  for (const kind of kinds) {
    out.push(await markMappingsStale({ tenantId, businessId, kind, reason, db }));
  }
  return out;
}
