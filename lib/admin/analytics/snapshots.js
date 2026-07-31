/**
 * Rebuildable daily / monthly snapshots from fact tables.
 */

function dayKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function monthKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Rebuild platform payment succeeded daily totals from billing facts.
 */
export async function rebuildDailyBillingSnapshots(db, { from, to } = {}) {
  const where = {
    eventType: 'PLATFORM_PAYMENT_SUCCEEDED',
  };
  if (from || to) {
    where.occurredAt = {};
    if (from) where.occurredAt.gte = new Date(from);
    if (to) where.occurredAt.lte = new Date(to);
  }

  const facts = await db.analyticsFactPlatformBilling.findMany({ where });
  const buckets = new Map();

  for (const f of facts) {
    const dk = dayKey(f.occurredAt);
    const key = `${dk}|payments_succeeded_count|${f.tenantId || ''}`;
    const prev = buckets.get(key) || {
      snapshotDate: new Date(`${dk}T00:00:00.000Z`),
      metricKey: 'payments_succeeded_count',
      tenantId: f.tenantId || '',
      count: 0,
      amount: 0,
    };
    prev.count += 1;
    prev.amount += Number(f.amount || 0);
    buckets.set(key, prev);
  }

  let written = 0;
  for (const b of buckets.values()) {
    await db.analyticsDailySnapshot.upsert({
      where: {
        snapshotDate_metricKey_tenantId: {
          snapshotDate: b.snapshotDate,
          metricKey: b.metricKey,
          tenantId: b.tenantId,
        },
      },
      create: {
        snapshotDate: b.snapshotDate,
        metricKey: b.metricKey,
        tenantId: b.tenantId,
        valueNumeric: b.count,
        valueJson: { amount: b.amount, count: b.count },
        rebuiltAt: new Date(),
      },
      update: {
        valueNumeric: b.count,
        valueJson: { amount: b.amount, count: b.count },
        rebuiltAt: new Date(),
      },
    });
    written += 1;

    const ym = monthKey(b.snapshotDate);
    await db.analyticsMonthlySnapshot.upsert({
      where: {
        yearMonth_metricKey_tenantId: {
          yearMonth: ym,
          metricKey: 'payments_succeeded_count',
          tenantId: b.tenantId,
        },
      },
      create: {
        yearMonth: ym,
        metricKey: 'payments_succeeded_count',
        tenantId: b.tenantId,
        valueNumeric: b.count,
        valueJson: { amount: b.amount, count: b.count },
        rebuiltAt: new Date(),
      },
      update: {
        valueNumeric: b.count,
        valueJson: { amount: b.amount, count: b.count },
        rebuiltAt: new Date(),
      },
    });
  }

  return { ok: true, written, factCount: facts.length };
}
