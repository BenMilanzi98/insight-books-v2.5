import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { postAccountingEvent } from '../lib/accountingV2/application/accountingPostingService.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { createSourceReference, deriveIdempotencyKey } from '../lib/accountingV2/domain/sourceReference.js';
import { createJournalDraft } from '../lib/accountingV2/domain/journalDraft.js';
import { registerEvent } from '../lib/accountingV2/infrastructure/eventRegistryRepository.js';
import { runInAccountingTransaction, assertTransactionClient } from '../lib/accountingV2/infrastructure/transactionBoundary.js';
import { resolvePostingMode, isFlagEnabled, setFlag, FLAG } from '../lib/accountingV2/infrastructure/featureFlags.js';
import {
  DuplicateAccountingEventError,
  ConflictingIdempotencyKeyError,
  PostingDisabledError,
  AccountingValidationError,
  CrossTenantAccountingError,
} from '../lib/accountingV2/domain/errors.js';
import { PostingMode, EventRegistryStatus, ShadowComparisonStatus } from '../lib/accountingV2/domain/enums.js';
import { compareProposalWithLegacy } from '../lib/accountingV2/shadow/shadowAccounting.js';
import { resolveLegacyPeriod } from '../lib/accountingV2/infrastructure/legacy/legacyPeriodResolver.js';

const T1 = 'tenant-1';
const T2 = 'tenant-2';

const ctx = (businessId = T1) =>
  createAccountingContext({ businessId, userId: 'user-1', sourceChannel: 'test' });

const invoiceRef = (overrides = {}) =>
  createSourceReference({
    sourceModule: 'SALES',
    sourceType: 'Invoice',
    sourceId: 'INV-1',
    eventType: 'INVOICE_POSTED',
    ...overrides,
  });

const draft = (overrides = {}) =>
  createJournalDraft({
    description: 'Invoice INV-1',
    transactionDate: '2026-07-20',
    sourceReference: invoiceRef(),
    dimensions: { customerId: 'c1' },
    lines: [
      { accountId: 'ar', debit: '115.00' },
      { accountId: 'rev', credit: '100.00' },
      { accountId: 'vat', credit: '15.00' },
    ],
    ...overrides,
  });

const shadowConfigured = () => ({
  configurations: [
    {
      id: 'cfg1',
      tenantId: T1,
      baseCurrency: 'MWK',
      accountingArchitectureVersion: 'TRANSITION_V2',
      defaultPostingMode: 'SHADOW',
      enableShadowAccounting: true,
      enableIntegrityMonitoring: true,
    },
  ],
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('posting mode resolution (server-side)', () => {
  it('defaults to NEW_ENGINE when no configuration exists', async () => {
    const { client } = makeAcctV2PrismaStub();
    expect(await resolvePostingMode(client, { tenantId: T1 })).toBe(PostingMode.NEW_ENGINE);
  });

  it('SHADOW/LEGACY baselines collapse to NEW_ENGINE', async () => {
    const { client } = makeAcctV2PrismaStub({
      configurations: [{ id: 'c', tenantId: T1, defaultPostingMode: 'SHADOW', enableShadowAccounting: true }],
    });
    expect(await resolvePostingMode(client, { tenantId: T1 })).toBe(PostingMode.NEW_ENGINE);
  });

  it('NEW_ENGINE stays authoritative', async () => {
    const { client } = makeAcctV2PrismaStub({
      configurations: [{ id: 'c', tenantId: T1, defaultPostingMode: 'NEW_ENGINE', enableShadowAccounting: true }],
    });
    expect(await resolvePostingMode(client, { tenantId: T1 })).toBe(PostingMode.NEW_ENGINE);
  });

  it('DISABLED blocks posting', async () => {
    const { client } = makeAcctV2PrismaStub({
      configurations: [{ id: 'c', tenantId: T1, defaultPostingMode: 'DISABLED' }],
    });
    expect(await resolvePostingMode(client, { tenantId: T1 })).toBe(PostingMode.DISABLED);
    await expect(
      postAccountingEvent(
        { context: ctx(), sourceReference: invoiceRef(), transactionDate: '2026-07-20', dimensions: { customerId: 'c1' } },
        client
      )
    ).rejects.toThrow(PostingDisabledError);
  });

  it('flags are business-scoped with specificity precedence', async () => {
    const { client } = makeAcctV2PrismaStub({
      featureFlags: [
        { id: 'f1', tenantId: '*', flagKey: FLAG.SHADOW_MODE, moduleKey: '*', eventType: '*', enabled: true },
        { id: 'f2', tenantId: T1, flagKey: FLAG.SHADOW_MODE, moduleKey: '*', eventType: '*', enabled: false },
      ],
    });
    expect(await isFlagEnabled(client, FLAG.SHADOW_MODE, { tenantId: T1 })).toBe(false);
    expect(await isFlagEnabled(client, FLAG.SHADOW_MODE, { tenantId: T2 })).toBe(true);
  });

  it('setFlag rejects unknown flag keys', async () => {
    const { client } = makeAcctV2PrismaStub();
    await expect(setFlag(client, { flagKey: 'notAFlag', enabled: true })).rejects.toThrow(RangeError);
  });
});

describe.skip('idempotency and duplicate prevention (retired postAccountingEvent)', () => {
  it('double submission replays the first registration', async () => {
    const { client } = makeAcctV2PrismaStub(shadowConfigured());
    const command = {
      context: ctx(),
      sourceReference: invoiceRef(),
      transactionDate: '2026-07-20',
      dimensions: { customerId: 'c1' },
      draft: draft(),
    };
    const first = await postAccountingEvent(command, client);
    const second = await postAccountingEvent(command, client);
    expect(first.existingPosting).toBe(false);
    expect(second.existingPosting).toBe(true);
    expect(second.accountingEventId).toBe(first.accountingEventId);
  });

  it('concurrent duplicate loses at the database constraint', async () => {
    const { client, state } = makeAcctV2PrismaStub(shadowConfigured());
    const command = {
      context: ctx(),
      sourceReference: invoiceRef(),
      transactionDate: '2026-07-20',
      dimensions: { customerId: 'c1' },
      draft: draft(),
    };
    await postAccountingEvent(command, client);
    state.simulateRaceOnce = true; // second request misses the pre-check like a real race
    await expect(postAccountingEvent(command, client)).rejects.toThrow(DuplicateAccountingEventError);
  });

  it('same key with materially different content is rejected', async () => {
    const { client } = makeAcctV2PrismaStub(shadowConfigured());
    const base = {
      context: ctx(),
      sourceReference: invoiceRef(),
      transactionDate: '2026-07-20',
      dimensions: { customerId: 'c1' },
    };
    await postAccountingEvent({ ...base, draft: draft() }, client);
    const differentDraft = createJournalDraft({
      description: 'Invoice INV-1',
      transactionDate: '2026-07-20',
      sourceReference: invoiceRef(),
      lines: [
        { accountId: 'ar', debit: '999.00' },
        { accountId: 'rev', credit: '999.00' },
      ],
    });
    await expect(postAccountingEvent({ ...base, draft: differentDraft }, client)).rejects.toThrow(
      ConflictingIdempotencyKeyError
    );
  });

  it('same source with a different legitimate event type registers separately', async () => {
    const { client, data } = makeAcctV2PrismaStub(shadowConfigured());
    const base = { context: ctx(), transactionDate: '2026-07-20' };
    await postAccountingEvent({ ...base, sourceReference: invoiceRef(), dimensions: { customerId: 'c1' }, draft: draft() }, client);
    await postAccountingEvent(
      {
        ...base,
        sourceReference: invoiceRef({ eventType: 'CUSTOMER_PAYMENT_POSTED', sourceType: 'Payment', sourceId: 'PAY-1' }),
        dimensions: { customerId: 'c1' },
      },
      client
    );
    expect(data.eventRegistry).toHaveLength(2);
  });

  it('failed registration can be retried with the same key', async () => {
    const { client, data } = makeAcctV2PrismaStub(shadowConfigured());
    const context = ctx();
    const ref = invoiceRef();
    const key = deriveIdempotencyKey(T1, ref);
    data.eventRegistry.push({
      id: 'evt_failed',
      tenantId: T1,
      sourceModule: ref.sourceModule,
      sourceType: ref.sourceType,
      sourceId: ref.sourceId,
      eventType: ref.eventType,
      eventVersion: 1,
      idempotencyKey: key,
      commandHash: null,
      status: EventRegistryStatus.FAILED,
      postingMode: 'SHADOW',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await postAccountingEvent(
      { context, sourceReference: ref, transactionDate: '2026-07-20', dimensions: { customerId: 'c1' }, draft: draft() },
      client
    );
    expect(result.existingPosting).toBe(false);
    expect(result.status).toBe(EventRegistryStatus.SHADOWED);
    expect(data.eventRegistry).toHaveLength(1); // reused, not duplicated
  });
});

describe.skip('transaction boundary (retired postAccountingEvent)', () => {
  it('rolls back every write when a later step fails', async () => {
    const { client, data, state } = makeAcctV2PrismaStub(shadowConfigured());
    state.failOn = 'acctV2ShadowComparison.create';
    await expect(
      postAccountingEvent(
        { context: ctx(), sourceReference: invoiceRef(), transactionDate: '2026-07-20', dimensions: { customerId: 'c1' }, draft: draft() },
        client
      )
    ).rejects.toThrow('Simulated failure');
    expect(data.eventRegistry).toHaveLength(0);
    expect(data.shadowJournals).toHaveLength(0);
    expect(data.outbox).toHaveLength(0);
    expect(data.postingAttempts).toHaveLength(0);
  });

  it('does not retry business validation failures', async () => {
    const { client } = makeAcctV2PrismaStub();
    let calls = 0;
    await expect(
      runInAccountingTransaction(client, ctx(), async () => {
        calls += 1;
        throw new AccountingValidationError('bad input');
      })
    ).rejects.toThrow(AccountingValidationError);
    expect(calls).toBe(1);
  });

  it('retries classified transient failures with the same work', async () => {
    const { client } = makeAcctV2PrismaStub();
    let calls = 0;
    const result = await runInAccountingTransaction(client, ctx(), async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('deadlock'), { code: 'P2034' });
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('repositories reject the root client', () => {
    const { client } = makeAcctV2PrismaStub();
    expect(() => assertTransactionClient(client)).toThrow(TypeError);
  });
});

describe.skip('tenant isolation (retired postAccountingEvent)', () => {
  it('replay of another business\'s idempotency key is blocked', async () => {
    const { client } = makeAcctV2PrismaStub(shadowConfigured());
    await postAccountingEvent(
      { context: ctx(T1), sourceReference: invoiceRef(), transactionDate: '2026-07-20', dimensions: { customerId: 'c1' }, draft: draft() },
      client
    );
    // Same source identity claimed from tenant-2 → different key, fine. But direct
    // registry access with T2 context against T1's row must be blocked:
    const ref = invoiceRef();
    await expect(
      client.$transaction((tx) =>
        registerEvent(tx, ctx(T2), {
          sourceReference: ref,
          idempotencyKey: deriveIdempotencyKey(T1, ref), // forged key of another business
          commandHash: null,
          transactionDate: '2026-07-20',
          currency: 'MWK',
          postingMode: 'SHADOW',
        })
      )
    ).rejects.toThrow(CrossTenantAccountingError);
  });

  it('shadow journals stay scoped to their business', async () => {
    const { client, data } = makeAcctV2PrismaStub(shadowConfigured());
    await postAccountingEvent(
      { context: ctx(T1), sourceReference: invoiceRef(), transactionDate: '2026-07-20', dimensions: { customerId: 'c1' }, draft: draft() },
      client
    );
    expect(data.shadowJournals.every((s) => s.tenantId === T1)).toBe(true);
  });
});

describe.skip('shadow accounting (removed in fresh-books)', () => {
  const legacyPosting = (lines) => ({
    transactions: [{ id: 'lt1', lines }],
    journalEntries: [],
  });

  it('persists proposal + EXACT_MATCH comparison without touching legacy tables', async () => {
    const { client, data } = makeAcctV2PrismaStub({
      ...shadowConfigured(),
      legacyTransactions: [
        {
          id: 'lt1',
          tenantId: T1,
          sourceType: 'Invoice',
          sourceId: 'INV-1',
          status: 'posted',
          lines: [
            { accountId: 'ar', debitAmount: 115, creditAmount: 0 },
            { accountId: 'rev', debitAmount: 0, creditAmount: 100 },
            { accountId: 'vat', debitAmount: 0, creditAmount: 15 },
          ],
        },
      ],
    });
    const legacyCountBefore = data.legacyTransactions.length;
    const result = await postAccountingEvent(
      { context: ctx(), sourceReference: invoiceRef(), transactionDate: '2026-07-20', dimensions: { customerId: 'c1' }, draft: draft() },
      client
    );
    expect(result.status).toBe(EventRegistryStatus.SHADOWED);
    expect(result.comparisonStatus).toBe(ShadowComparisonStatus.EXACT_MATCH);
    expect(result.journalId).toBeNull(); // no financial impact
    expect(data.legacyTransactions).toHaveLength(legacyCountBefore); // legacy untouched
    expect(data.shadowJournals).toHaveLength(1);
    expect(data.shadowComparisons).toHaveLength(1);
  });

  it('detects account differences', () => {
    const result = compareProposalWithLegacy(draft(), legacyPosting([
      { accountId: 'ar', debitAmount: 115, creditAmount: 0 },
      { accountId: 'WRONG', debitAmount: 0, creditAmount: 100 },
      { accountId: 'vat', debitAmount: 0, creditAmount: 15 },
    ]));
    expect(result.status).toBe(ShadowComparisonStatus.ACCOUNT_DIFFERENCE);
  });

  it('detects amount differences', () => {
    const result = compareProposalWithLegacy(draft(), legacyPosting([
      { accountId: 'ar', debitAmount: 115, creditAmount: 0 },
      { accountId: 'rev', debitAmount: 0, creditAmount: 90 },
      { accountId: 'vat', debitAmount: 0, creditAmount: 25 },
    ]));
    expect(result.status).toBe(ShadowComparisonStatus.AMOUNT_DIFFERENCE);
  });

  it('detects duplicate legacy postings', () => {
    const result = compareProposalWithLegacy(draft(), {
      transactions: [{ id: 'a', lines: [] }, { id: 'b', lines: [] }],
      journalEntries: [],
    });
    expect(result.status).toBe(ShadowComparisonStatus.DUPLICATE_LEGACY_POSTING);
    expect(result.severity).toBe('CRITICAL');
  });

  it('detects missing legacy posting and unbalanced legacy', () => {
    expect(
      compareProposalWithLegacy(draft(), { transactions: [], journalEntries: [] }).status
    ).toBe(ShadowComparisonStatus.MISSING_LEGACY_POSTING);
    expect(
      compareProposalWithLegacy(draft(), legacyPosting([{ accountId: 'ar', debitAmount: 115, creditAmount: 0 }])).status
    ).toBe(ShadowComparisonStatus.UNBALANCED_LEGACY);
  });
});

describe('legacy period resolver (deny-by-default)', () => {
  it('denies when no period covers the date, recording that legacy would allow', async () => {
    const { client } = makeAcctV2PrismaStub();
    const resolution = await resolveLegacyPeriod(ctx(), '2026-07-20', client);
    expect(resolution.decision).toBe('NO_PERIOD');
    expect(resolution.postingAllowed).toBe(false);
    expect(resolution.legacyWouldAllow).toBe(true); // zero-periods fail-open documented
  });

  it('denies closed periods and flags overlapping open periods as ambiguous', async () => {
    const { client } = makeAcctV2PrismaStub({
      accountingPeriods: [
        { id: 'p1', tenantId: T1, startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31'), status: 'closed' },
      ],
    });
    const closed = await resolveLegacyPeriod(ctx(), '2026-07-20', client);
    expect(closed.decision).toBe('CLOSED');
    expect(closed.postingAllowed).toBe(false);

    const { client: c2 } = makeAcctV2PrismaStub({
      accountingPeriods: [
        { id: 'p1', tenantId: T1, startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31'), status: 'open' },
        { id: 'p2', tenantId: T1, startDate: new Date('2026-07-15'), endDate: new Date('2026-08-15'), status: 'open' },
      ],
    });
    const ambiguous = await resolveLegacyPeriod(ctx(), '2026-07-20', c2);
    expect(ambiguous.decision).toBe('AMBIGUOUS');
    expect(ambiguous.postingAllowed).toBe(false);
  });
});
