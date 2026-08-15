import prisma from '@/lib/prisma';

function serviceError(message, status = 400, code = 'ASSUMPTION_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function serializeSet(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    effectiveDate: row.effectiveDate,
    createdAt: row.createdAt,
    assumptions: (row.assumptions || []).map((a) => ({
      id: a.id,
      assumptionType: a.assumptionType,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
      accountId: a.accountId,
      value: a.value,
      unit: a.unit,
      startDate: a.startDate,
      endDate: a.endDate,
      notes: a.notes,
    })),
  };
}

export async function listAssumptionSets(tenantId) {
  const rows = await prisma.forecastAssumptionSet.findMany({
    where: { tenantId, businessId: tenantId },
    orderBy: { createdAt: 'desc' },
    include: { assumptions: true },
    take: 100,
  });
  return rows.map(serializeSet);
}

export async function getAssumptionSet(tenantId, id) {
  const row = await prisma.forecastAssumptionSet.findFirst({
    where: { id, tenantId },
    include: { assumptions: true },
  });
  if (!row) throw serviceError('Assumption set not found', 404, 'ASSUMPTION_NOT_FOUND');
  return serializeSet(row);
}

export async function createAssumptionSet(tenantId, userId, input = {}) {
  const name = String(input.name || '').trim();
  if (!name) throw serviceError('Name is required');
  const assumptions = Array.isArray(input.assumptions) ? input.assumptions : [];
  const row = await prisma.forecastAssumptionSet.create({
    data: {
      tenantId,
      businessId: tenantId,
      name,
      description: input.description || null,
      version: 1,
      createdById: userId || null,
      assumptions: {
        create: assumptions.map((a) => ({
          assumptionType: String(a.assumptionType || 'GROWTH').toUpperCase(),
          scopeType: String(a.scopeType || 'GLOBAL').toUpperCase(),
          scopeId: a.scopeId || null,
          accountId: a.accountId || null,
          value: Number(a.value) || 0,
          unit: String(a.unit || 'PERCENT').toUpperCase(),
          startDate: a.startDate ? new Date(a.startDate) : null,
          endDate: a.endDate ? new Date(a.endDate) : null,
          notes: a.notes || null,
        })),
      },
    },
    include: { assumptions: true },
  });
  return serializeSet(row);
}

export async function updateAssumptionSet(tenantId, id, input = {}) {
  await getAssumptionSet(tenantId, id);
  const assumptions = Array.isArray(input.assumptions) ? input.assumptions : null;

  await prisma.$transaction(async (tx) => {
    const data = { version: { increment: 1 } };
    if (input.name != null) data.name = String(input.name).trim();
    if (input.description !== undefined) data.description = input.description;
    await tx.forecastAssumptionSet.update({ where: { id }, data });
    if (assumptions) {
      await tx.forecastAssumption.deleteMany({ where: { assumptionSetId: id } });
      if (assumptions.length) {
        await tx.forecastAssumption.createMany({
          data: assumptions.map((a) => ({
            assumptionSetId: id,
            assumptionType: String(a.assumptionType || 'GROWTH').toUpperCase(),
            scopeType: String(a.scopeType || 'GLOBAL').toUpperCase(),
            scopeId: a.scopeId || null,
            accountId: a.accountId || null,
            value: Number(a.value) || 0,
            unit: String(a.unit || 'PERCENT').toUpperCase(),
            startDate: a.startDate ? new Date(a.startDate) : null,
            endDate: a.endDate ? new Date(a.endDate) : null,
            notes: a.notes || null,
          })),
        });
      }
    }
  });

  return getAssumptionSet(tenantId, id);
}

export async function deleteAssumptionSet(tenantId, id) {
  await getAssumptionSet(tenantId, id);
  const linked = await prisma.forecast.count({ where: { tenantId, assumptionSetId: id } });
  if (linked > 0) {
    throw serviceError(
      'Assumption set is attached to forecasts — detach first',
      409,
      'ASSUMPTION_IN_USE'
    );
  }
  await prisma.forecastAssumptionSet.delete({ where: { id } });
  return { id, deleted: true };
}
