/**
 * In-memory Prisma stub for Accounting V2 tests.
 * Implements the model delegates the V2 kernel touches, with:
 *  - unique-constraint enforcement on the event registry (throws { code: 'P2002' })
 *  - real rollback semantics for $transaction (snapshot/restore)
 *  - a `simulateRaceOnce` switch that makes findUnique miss once, to exercise the
 *    concurrent-duplicate P2002 path.
 */

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

export function makeAcctV2PrismaStub(seed = {}) {
  const data = {
    eventRegistry: [...(seed.eventRegistry ?? [])],
    postingAttempts: [...(seed.postingAttempts ?? [])],
    outbox: [...(seed.outbox ?? [])],
    shadowJournals: [...(seed.shadowJournals ?? [])],
    shadowLines: [...(seed.shadowLines ?? [])],
    shadowComparisons: [...(seed.shadowComparisons ?? [])],
    configurations: [...(seed.configurations ?? [])],
    featureFlags: [...(seed.featureFlags ?? [])],
    legacyTransactions: [...(seed.legacyTransactions ?? [])],
    transactionLines: [...(seed.transactionLines ?? [])],
    ledgerBalances: [...(seed.ledgerBalances ?? [])],
    legacyJournalEntries: [...(seed.legacyJournalEntries ?? [])],
    journalEntryLines: [...(seed.journalEntryLines ?? [])],
    journalSequences: [...(seed.journalSequences ?? [])],
    openingBalanceBatches: [...(seed.openingBalanceBatches ?? [])],
    accounts: [...(seed.accounts ?? [])],
    accountingPeriods: [...(seed.accountingPeriods ?? [])],
    auditLogs: [...(seed.auditLogs ?? [])],
    coaV2AccountMappings: [...(seed.coaV2AccountMappings ?? [])],
    invoices: [...(seed.invoices ?? [])],
    anomalies: [...(seed.anomalies ?? [])],
    repairEvidence: [...(seed.repairEvidence ?? [])],
    repairBatches: [...(seed.repairBatches ?? [])],
    repairActions: [...(seed.repairActions ?? [])],
    repairSnapshots: [...(seed.repairSnapshots ?? [])],
    repairExceptions: [...(seed.repairExceptions ?? [])],
    reportRuns: [...(seed.reportRuns ?? [])],
    reportSnapshots: [...(seed.reportSnapshots ?? [])],
    reportCaches: [...(seed.reportCaches ?? [])],
    supplierBills: [...(seed.supplierBills ?? [])],
    budgetItems: [...(seed.budgetItems ?? [])],
    calendarConfigs: [...(seed.calendarConfigs ?? [])],
    financialYears: [...(seed.financialYears ?? [])],
    accountingPeriodsV2: [...(seed.accountingPeriodsV2 ?? [])],
    periodStatusHistory: [...(seed.periodStatusHistory ?? [])],
    periodCloseRuns: [...(seed.periodCloseRuns ?? [])],
    periodCloseTasks: [...(seed.periodCloseTasks ?? [])],
    periodCloseExceptions: [...(seed.periodCloseExceptions ?? [])],
    periodReopenRequests: [...(seed.periodReopenRequests ?? [])],
  };

  const state = { simulateRaceOnce: false, failOn: null };

  const asComparable = (v) => (typeof v === 'number' ? v : new Date(v).getTime());

  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, cond]) => {
      if (key === 'OR') return cond.some((sub) => matches(row, sub));
      if (key === 'AND') return cond.every((sub) => matches(row, sub));
      if (key === 'NOT') return !matches(row, cond);
      if (cond === null) return row[key] == null;
      if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
        if ('in' in cond) return cond.in.includes(row[key]);
        if ('notIn' in cond) return !cond.notIn.includes(row[key]);
        if ('not' in cond) return cond.not === null ? row[key] != null : row[key] !== cond.not;
        if ('contains' in cond) {
          const haystack = String(row[key] ?? '');
          return cond.mode === 'insensitive'
            ? haystack.toLowerCase().includes(String(cond.contains).toLowerCase())
            : haystack.includes(String(cond.contains));
        }
        if ('gte' in cond || 'lte' in cond || 'gt' in cond || 'lt' in cond) {
          if (row[key] == null) return false;
          const v = asComparable(row[key]);
          if ('gte' in cond && v < asComparable(cond.gte)) return false;
          if ('lte' in cond && v > asComparable(cond.lte)) return false;
          if ('gt' in cond && v <= asComparable(cond.gt)) return false;
          if ('lt' in cond && v >= asComparable(cond.lt)) return false;
          return true;
        }
        // nested relation filter — resolve against joined stores
        if (key === 'transaction') {
          const parent = data.legacyTransactions.find((t) => t.id === row.transactionId);
          return parent ? matches(parent, cond) : false;
        }
        if (key === 'journalEntry') {
          const parent = data.legacyJournalEntries.find((j) => j.id === row.journalEntryId);
          return parent ? matches(parent, cond) : false;
        }
        return matches(row[key] ?? {}, cond);
      }
      return row[key] === cond;
    });

  function makeDelegate(store, { uniques = [], modelName = 'model', includeResolver = null } = {}) {
    return {
      findUnique: async ({ where }) => {
        if (state.simulateRaceOnce && modelName === 'acctV2EventRegistry' && where.idempotencyKey) {
          state.simulateRaceOnce = false;
          return null;
        }
        if (where.tenantId_flagKey_moduleKey_eventType) {
          const w = where.tenantId_flagKey_moduleKey_eventType;
          return store.find((r) => matches(r, w)) ?? null;
        }
        const key = Object.keys(where)[0];
        return store.find((r) => r[key] === where[key]) ?? null;
      },
      findFirst: async ({ where, orderBy, select, include } = {}) => {
        let rows = store.filter((r) => matches(r, where ?? {}));
        if (orderBy) rows = sortRows(rows, orderBy);
        const row = rows[0] ?? null;
        if (row && include && includeResolver) return includeResolver(row, include);
        return row;
      },
      findMany: async ({ where, orderBy, take, skip, include } = {}) => {
        let rows = store.filter((r) => matches(r, where ?? {}));
        if (orderBy) rows = sortRows(rows, orderBy);
        if (skip) rows = rows.slice(skip);
        if (take) rows = rows.slice(0, take);
        if (include && includeResolver) rows = rows.map((r) => includeResolver(r, include));
        return rows;
      },
      count: async ({ where } = {}) => store.filter((r) => matches(r, where ?? {})).length,
      groupBy: async ({ by, where, _sum }) => {
        const rows = store.filter((r) => matches(r, where ?? {}));
        const groups = new Map();
        for (const row of rows) {
          const key = by.map((f) => row[f]).join('|');
          if (!groups.has(key)) groups.set(key, { rows: [] });
          groups.get(key).rows.push(row);
        }
        return [...groups.entries()].map(([key, group]) => {
          const values = key.split('|');
          const out = {
            ...Object.fromEntries(by.map((f, i) => [f, values[i]])),
            _count: { _all: group.rows.length },
          };
          if (_sum) {
            out._sum = {};
            for (const field of Object.keys(_sum)) {
              const total = group.rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
              out._sum[field] = Math.round(total * 100) / 100;
            }
          }
          return out;
        });
      },
      create: async ({ data: input, include }) => {
        if (state.failOn === `${modelName}.create`) {
          state.failOn = null;
          throw new Error(`Simulated failure in ${modelName}.create`);
        }
        const uniqueValue = (v) => (v instanceof Date ? v.toISOString() : v);
        for (const unique of uniques) {
          const clash = store.find((r) =>
            unique.every((f) => uniqueValue(r[f]) === uniqueValue(input[f]) && input[f] !== undefined)
          );
          if (clash) {
            const err = new Error(`Unique constraint failed on ${unique.join(',')}`);
            err.code = 'P2002';
            throw err;
          }
        }
        const row = {
          id: nextId(modelName),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...stripNested(input),
        };
        store.push(row);
        // nested create (shadow journal lines / journal entry lines)
        if (input.lines?.create && modelName === 'acctV2ShadowJournal') {
          for (const line of input.lines.create) {
            data.shadowLines.push({ id: nextId('line'), shadowJournalId: row.id, ...line });
          }
        }
        if (input.lines?.create && modelName === 'journalEntry') {
          for (const line of input.lines.create) {
            data.journalEntryLines.push({ id: nextId('jel'), journalEntryId: row.id, ...line });
          }
        }
        if (include && includeResolver) return includeResolver(row, include);
        return row;
      },
      update: async ({ where, data: patch, include }) => {
        const key = Object.keys(where)[0];
        const row =
          where[key] && typeof where[key] === 'object'
            ? store.find((r) => matches(r, where[key])) // compound unique, e.g. tenantId_scopeKey
            : store.find((r) => r[key] === where[key]);
        if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        for (const [k, v] of Object.entries(patch)) {
          if (v && typeof v === 'object' && 'increment' in v) row[k] = (row[k] ?? 0) + v.increment;
          else if (k === 'lines' && v?.create && modelName === 'journalEntry') {
            for (const line of v.create) {
              data.journalEntryLines.push({ id: nextId('jel'), journalEntryId: row.id, ...line });
            }
          } else row[k] = v;
        }
        row.updatedAt = new Date();
        if (include && includeResolver) return includeResolver(row, include);
        return row;
      },
      deleteMany: async ({ where } = {}) => {
        if (!['journalEntryLine', 'acctV2LedgerBalance', 'acctV2ReportCache'].includes(modelName)) {
          throw new Error(`${modelName}.deleteMany must never be called by V2 accounting code`);
        }
        const keep = store.filter((r) => !matches(r, where ?? {}));
        const count = store.length - keep.length;
        store.length = 0;
        store.push(...keep);
        return { count };
      },
      upsert: async ({ where, create, update }) => {
        const w = where.tenantId_flagKey_moduleKey_eventType ?? where;
        const row = store.find((r) => matches(r, w));
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
          return row;
        }
        const created = { id: nextId(modelName), createdAt: new Date(), updatedAt: new Date(), ...create };
        store.push(created);
        return created;
      },
      delete: async () => {
        throw new Error(`${modelName}.delete must never be called by V2 accounting code`);
      },
    };
  }

  const sortRows = (rows, orderBy) => {
    const [field, dir] = Object.entries(Array.isArray(orderBy) ? orderBy[0] : orderBy)[0];
    if (typeof dir === 'object') return rows; // relation ordering — ignore in stub
    return [...rows].sort((a, b) => (a[field] < b[field] ? -1 : 1) * (dir === 'desc' ? -1 : 1));
  };

  const stripNested = (input) => {
    const { lines, ...rest } = input;
    return rest;
  };

  const shadowInclude = (row, include) => ({
    ...row,
    ...(include?.lines ? { lines: data.shadowLines.filter((l) => l.shadowJournalId === row.id) } : {}),
    ...(include?.comparison
      ? { comparison: data.shadowComparisons.find((c) => c.shadowJournalId === row.id) ?? null }
      : {}),
    ...(include?.eventRegistry
      ? { eventRegistry: data.eventRegistry.find((e) => e.id === row.eventRegistryId) ?? null }
      : {}),
  });

  const legacyTxInclude = (row, include) => ({
    ...row,
    ...(include?.lines
      ? {
          lines: [
            ...(row.lines ?? []),
            ...data.transactionLines.filter((l) => l.transactionId === row.id),
          ],
        }
      : {}),
  });

  const transactionLineInclude = (row, include) => ({
    ...row,
    ...(include?.transaction
      ? { transaction: data.legacyTransactions.find((t) => t.id === row.transactionId) ?? null }
      : {}),
  });

  const journalEntryLineInclude = (row, include) => ({
    ...row,
    ...(include?.journalEntry
      ? { journalEntry: data.legacyJournalEntries.find((j) => j.id === row.journalEntryId) ?? null }
      : {}),
  });

  const journalEntryInclude = (row, include) => ({
    ...row,
    ...(include?.lines
      ? {
          lines: [
            ...(row.lines ?? []),
            ...data.journalEntryLines.filter((l) => l.journalEntryId === row.id),
          ],
        }
      : {}),
  });

  function buildClient() {
    return {
      acctV2EventRegistry: makeDelegate(data.eventRegistry, {
        modelName: 'acctV2EventRegistry',
        uniques: [
          ['idempotencyKey'],
          ['tenantId', 'sourceModule', 'sourceType', 'sourceId', 'eventType', 'eventVersion'],
        ],
      }),
      acctV2PostingAttempt: makeDelegate(data.postingAttempts, {
        modelName: 'acctV2PostingAttempt',
        uniques: [['eventRegistryId', 'attemptNumber']],
      }),
      acctV2Outbox: makeDelegate(data.outbox, { modelName: 'acctV2Outbox' }),
      acctV2ShadowJournal: makeDelegate(data.shadowJournals, {
        modelName: 'acctV2ShadowJournal',
        includeResolver: shadowInclude,
      }),
      acctV2ShadowJournalLine: makeDelegate(data.shadowLines, { modelName: 'acctV2ShadowJournalLine' }),
      acctV2ShadowComparison: makeDelegate(data.shadowComparisons, {
        modelName: 'acctV2ShadowComparison',
        uniques: [['shadowJournalId']],
      }),
      acctV2Configuration: makeDelegate(data.configurations, {
        modelName: 'acctV2Configuration',
        uniques: [['tenantId']],
      }),
      acctV2FeatureFlag: makeDelegate(data.featureFlags, {
        modelName: 'acctV2FeatureFlag',
        uniques: [['tenantId', 'flagKey', 'moduleKey', 'eventType']],
      }),
      transaction: makeDelegate(data.legacyTransactions, {
        modelName: 'transaction',
        includeResolver: legacyTxInclude,
      }),
      transactionLine: makeDelegate(data.transactionLines, {
        modelName: 'transactionLine',
        includeResolver: transactionLineInclude,
      }),
      acctV2LedgerBalance: makeDelegate(data.ledgerBalances, {
        modelName: 'acctV2LedgerBalance',
        uniques: [['tenantId', 'projectionVersion', 'accountId', 'periodKey', 'currency']],
      }),
      journalEntry: makeDelegate(data.legacyJournalEntries, {
        modelName: 'journalEntry',
        includeResolver: journalEntryInclude,
        uniques: [['tenantId', 'journalNumber'], ['accountingEventId']],
      }),
      journalEntryLine: makeDelegate(data.journalEntryLines, {
        modelName: 'journalEntryLine',
        includeResolver: journalEntryLineInclude,
      }),
      acctV2JournalSequence: makeDelegate(data.journalSequences, {
        modelName: 'acctV2JournalSequence',
        uniques: [['tenantId', 'scopeKey']],
      }),
      acctV2OpeningBalanceBatch: makeDelegate(data.openingBalanceBatches, {
        modelName: 'acctV2OpeningBalanceBatch',
        uniques: [['tenantId', 'effectiveDate', 'version']],
      }),
      account: makeDelegate(data.accounts, { modelName: 'account' }),
      accountingPeriod: makeDelegate(data.accountingPeriods, { modelName: 'accountingPeriod' }),
      auditLog: makeDelegate(data.auditLogs, { modelName: 'auditLog' }),
      coaV2AccountMapping: makeDelegate(data.coaV2AccountMappings, { modelName: 'coaV2AccountMapping' }),
      invoice: makeDelegate(data.invoices, { modelName: 'invoice' }),
      acctV2HistoricalAnomaly: makeDelegate(data.anomalies, {
        modelName: 'acctV2HistoricalAnomaly',
        uniques: [['tenantId', 'detectionKey']],
      }),
      acctV2RepairEvidence: makeDelegate(data.repairEvidence, { modelName: 'acctV2RepairEvidence' }),
      acctV2ReportRun: makeDelegate(data.reportRuns, { modelName: 'acctV2ReportRun' }),
      acctV2ReportSnapshotV2: makeDelegate(data.reportSnapshots, { modelName: 'acctV2ReportSnapshotV2' }),
      acctV2ReportCache: makeDelegate(data.reportCaches, {
        modelName: 'acctV2ReportCache',
        uniques: [['tenantId', 'reportType', 'filtersHash', 'definitionVersion']],
      }),
      supplierBill: makeDelegate(data.supplierBills, { modelName: 'supplierBill' }),
      legacyBudgetItem: makeDelegate(data.budgetItems, { modelName: 'legacyBudgetItem' }),
      budgetItem: makeDelegate(data.budgetItems, { modelName: 'budgetItem' }), // alias during cutover
      acctV2RepairBatch: makeDelegate(data.repairBatches, {
        modelName: 'acctV2RepairBatch',
        uniques: [['tenantId', 'batchNumber']],
      }),
      acctV2RepairAction: makeDelegate(data.repairActions, {
        modelName: 'acctV2RepairAction',
        uniques: [['tenantId', 'anomalyId', 'repairType', 'repairVersion']],
      }),
      acctV2RepairSnapshot: makeDelegate(data.repairSnapshots, {
        modelName: 'acctV2RepairSnapshot',
        uniques: [['batchId', 'phase']],
      }),
      acctV2RepairException: makeDelegate(data.repairExceptions, {
        modelName: 'acctV2RepairException',
        uniques: [['anomalyId']],
      }),
      acctV2FinancialCalendarConfig: makeDelegate(data.calendarConfigs, {
        modelName: 'acctV2FinancialCalendarConfig',
        uniques: [['tenantId']],
      }),
      acctV2FinancialYear: makeDelegate(data.financialYears, {
        modelName: 'acctV2FinancialYear',
        uniques: [['tenantId', 'code']],
      }),
      acctV2AccountingPeriod: makeDelegate(data.accountingPeriodsV2, {
        modelName: 'acctV2AccountingPeriod',
        uniques: [['financialYearId', 'periodNumber'], ['tenantId', 'code']],
      }),
      acctV2PeriodStatusHistory: makeDelegate(data.periodStatusHistory, {
        modelName: 'acctV2PeriodStatusHistory',
      }),
      acctV2PeriodCloseRun: makeDelegate(data.periodCloseRuns, {
        modelName: 'acctV2PeriodCloseRun',
        uniques: [['accountingPeriodId', 'closeNumber']],
      }),
      acctV2PeriodCloseTask: makeDelegate(data.periodCloseTasks, {
        modelName: 'acctV2PeriodCloseTask',
        uniques: [['closeRunId', 'taskKey']],
      }),
      acctV2PeriodCloseException: makeDelegate(data.periodCloseExceptions, {
        modelName: 'acctV2PeriodCloseException',
      }),
      acctV2PeriodReopenRequest: makeDelegate(data.periodReopenRequests, {
        modelName: 'acctV2PeriodReopenRequest',
      }),
    };
  }

  const client = buildClient();
  client.$transaction = async (fn) => {
    if (Array.isArray(fn)) return Promise.all(fn); // sequential-promise form
    const snapshot = JSON.parse(
      JSON.stringify(data, (k, v) =>
        v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? `__bigint__${v}` : v
      ),
      (k, v) => (typeof v === 'string' && v.startsWith('__bigint__') ? BigInt(v.slice(10)) : v)
    );
    const tx = buildClient(); // no $transaction on tx client
    try {
      return await fn(tx);
    } catch (err) {
      for (const key of Object.keys(data)) {
        data[key].length = 0;
        data[key].push(...snapshot[key]);
      }
      throw err;
    }
  };

  return { client, data, state };
}
