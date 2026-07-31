/**
 * Phase 4 — central posting engine tests.
 *
 * Covers: posting command validation, template registry versioning, journal
 * numbering, period resolution, account validation, approvals, the manual
 * journal pilot end-to-end (NEW_ENGINE), idempotent replay, failure rollback,
 * shadow invoice posting + comparison, the legacy↔new guard, opening balances,
 * and source posting state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { createPostingCommand } from '../lib/accountingV2/engine/postingCommand.js';
import { executePosting, previewPosting, retryPosting } from '../lib/accountingV2/engine/postingEngine.js';
import { allocateJournalNumber } from '../lib/accountingV2/engine/journalNumbering.js';
import { resolvePostingPeriod } from '../lib/accountingV2/engine/periodResolution.js';
import { validateDraftAccounts } from '../lib/accountingV2/engine/accountValidation.js';
import { resolveApprovalRequirement, validateApproval } from '../lib/accountingV2/engine/approvalValidation.js';
import { assertLegacyPostingAllowed, assertNewEnginePostingAllowed } from '../lib/accountingV2/engine/legacyGuard.js';
import { getSourcePostingState, SourcePostingState } from '../lib/accountingV2/engine/sourcePostingState.js';
import { updatePostedJournalAnnotation } from '../lib/accountingV2/engine/journalPersistence.js';
import {
  createManualJournalDraft,
  submitManualJournal,
  approveManualJournal,
  postManualJournal,
} from '../lib/accountingV2/application/manualJournalService.js';
import {
  createOpeningBalanceBatch,
  submitOpeningBalanceBatch,
  approveOpeningBalanceBatch,
  postOpeningBalanceBatch,
} from '../lib/accountingV2/application/openingBalanceService.js';
import { registerTemplate, getActiveTemplate, TemplateStatus } from '../lib/accountingV2/templates/index.js';
import { createJournalDraft } from '../lib/accountingV2/domain/journalDraft.js';
import { createSourceReference } from '../lib/accountingV2/domain/sourceReference.js';
import {
  InvalidPostingCommandError,
  AccountingContextRequiredError,
  AccountingValidationError,
  ApprovalRequiredError,
  ApprovalInvalidError,
  ClosedAccountingPeriodError,
  InvalidAccountingPeriodError,
  InvalidPostingDateError,
  NonPostingAccountError,
  InactiveAccountError,
  DeprecatedAccountError,
  AccountNotFoundError,
  ControlAccountDimensionError,
  LegacyAndNewPostingConflictError,
  PostingTemplateValidationError,
  PostingTemplateNotFoundError,
  JournalImmutableError,
  SourceNotPostableError,
  UnbalancedJournalError,
} from '../lib/accountingV2/domain/errors.js';
import { EventRegistryStatus, PostingMode } from '../lib/accountingV2/domain/enums.js';
import { FLAG } from '../lib/accountingV2/infrastructure/featureFlags.js';

const T1 = 'tenant-1';
const T2 = 'tenant-2';
const CREATOR = 'user-creator';
const APPROVER = 'user-approver';

const allow = () => true;
const deny = () => false;

const ctx = (userId = CREATOR, businessId = T1) =>
  createAccountingContext({ businessId, userId, sourceChannel: 'test' });

/** Configuration + flag rows that resolve to NEW_ENGINE for T1. */
const newEngineSeed = () => ({
  configurations: [
    {
      id: 'cfg1', tenantId: T1, baseCurrency: 'MWK',
      defaultPostingMode: 'NEW_ENGINE', enableShadowAccounting: true,
    },
  ],
  featureFlags: [
    { id: 'f1', tenantId: T1, flagKey: FLAG.V2_ENABLED, moduleKey: '*', eventType: '*', enabled: true },
  ],
});

const shadowSeed = () => ({
  configurations: [
    {
      id: 'cfg1', tenantId: T1, baseCurrency: 'MWK',
      defaultPostingMode: 'SHADOW', enableShadowAccounting: true,
    },
  ],
});

const postingAccounts = () => [
  { id: 'cash', tenantId: T1, accountCode: '1000', accountName: 'Cash', isActive: true },
  { id: 'rev', tenantId: T1, accountCode: '4000', accountName: 'Revenue', isActive: true },
  { id: 'exp', tenantId: T1, accountCode: '5000', accountName: 'Rent Expense', isActive: true },
  { id: 'ar', tenantId: T1, accountCode: '1100', accountName: 'Accounts Receivable', isActive: true, controlAccountPurpose: 'ACCOUNTS_RECEIVABLE' },
  { id: 'obe', tenantId: T1, accountCode: '3900', accountName: 'Opening Balance Equity', isActive: true },
  { id: 'vat', tenantId: T1, accountCode: '2200', accountName: 'VAT Output', isActive: true },
  { id: 'hdr', tenantId: T1, accountCode: '1', accountName: 'Assets', isActive: true, coaV2Behaviour: 'HEADER' },
  { id: 'inact', tenantId: T1, accountCode: '1900', accountName: 'Old Cash', isActive: false },
  { id: 'depr', tenantId: T1, accountCode: '1901', accountName: 'Deprecated', isActive: true, coaV2Status: 'DEPRECATED' },
];

/** Create → submit → approve a balanced two-line manual journal draft. */
async function approvedManualJournal(client, lines) {
  const draft = await createManualJournalDraft(
    ctx(CREATOR),
    {
      description: 'Monthly rent accrual',
      entryDate: '2026-07-15',
      lines: lines ?? [
        { accountId: 'exp', debit: '1500.00' },
        { accountId: 'cash', credit: '1500.00' },
      ],
    },
    { hasPermission: allow },
    client
  );
  await submitManualJournal(ctx(CREATOR), draft.id, { hasPermission: allow }, client);
  await approveManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);
  return draft;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/* ── 47.1 Command validation ─────────────────────────────────────────────── */

describe('posting command validation', () => {
  const validInput = () => ({
    context: ctx(),
    sourceReference: {
      sourceModule: 'MANUAL_JOURNAL',
      sourceType: 'JournalEntry',
      sourceId: 'j1',
      eventType: 'MANUAL_JOURNAL_POSTED',
    },
    transactionDate: '2026-07-15',
  });

  it('accepts a valid command and derives the canonical idempotency key', () => {
    const command = createPostingCommand(validInput());
    expect(command.idempotencyKey).toContain(T1);
    expect(command.idempotencyKey).toContain('MANUAL_JOURNAL_POSTED');
    expect(Object.isFrozen(command)).toBe(true);
  });

  it('rejects a missing business context', () => {
    expect(() => createPostingCommand({ ...validInput(), context: { userId: 'u' } }))
      .toThrow(AccountingContextRequiredError);
  });

  it('rejects a missing source identity', () => {
    expect(() => createPostingCommand({ ...validInput(), sourceReference: {} }))
      .toThrow(InvalidPostingCommandError);
  });

  it('rejects an unsupported event type', () => {
    const input = validInput();
    input.sourceReference.eventType = 'NOT_AN_EVENT';
    expect(() => createPostingCommand(input)).toThrow(InvalidPostingCommandError);
  });

  it('rejects invalid dates and currencies', () => {
    expect(() => createPostingCommand({ ...validInput(), transactionDate: 'yesterday' }))
      .toThrow(InvalidPostingCommandError);
    expect(() => createPostingCommand({ ...validInput(), currency: 'mwk!' }))
      .toThrow(InvalidPostingCommandError);
  });

  it('rejects unsafe float amounts and negative totals', () => {
    expect(() => createPostingCommand({ ...validInput(), totalAmount: 0.1 + 0.2 }))
      .toThrow(InvalidPostingCommandError);
    expect(() => createPostingCommand({ ...validInput(), totalAmount: '-5.00' }))
      .toThrow(InvalidPostingCommandError);
  });

  it('rejects client-supplied server-resolved fields (mode, architecture, idempotency)', () => {
    expect(() => createPostingCommand({ ...validInput(), postingMode: 'NEW_ENGINE' }))
      .toThrow(InvalidPostingCommandError);
    expect(() => createPostingCommand({ ...validInput(), architectureVersion: 'ACCOUNTING_V2' }))
      .toThrow(InvalidPostingCommandError);
    expect(() => createPostingCommand({ ...validInput(), idempotencyKey: 'spoofed' }))
      .toThrow(InvalidPostingCommandError);
  });
});

/* ── §17 Template registry ───────────────────────────────────────────────── */

describe('posting template registry', () => {
  it('published versions are immutable — re-registration is refused', () => {
    expect(() =>
      registerTemplate({
        templateId: 'MANUAL_JOURNAL',
        templateVersion: 1,
        eventType: 'MANUAL_JOURNAL_POSTED',
        status: TemplateStatus.ACTIVE,
        buildDraft: async () => null,
      })
    ).toThrow(PostingTemplateValidationError);
  });

  it('Phase 9 activates LOAN_RECEIVED; unknown events still refused', () => {
    const loan = getActiveTemplate('LOAN_RECEIVED');
    expect(loan.status).toBe(TemplateStatus.ACTIVE);
    expect(loan.templateVersion).toBe(2);
    expect(() => getActiveTemplate('NOT_A_REAL_EVENT_TYPE')).toThrow(PostingTemplateNotFoundError);
  });

  it('resolves the pilot templates as ACTIVE', () => {
    for (const eventType of ['MANUAL_JOURNAL_POSTED', 'ADJUSTMENT_POSTED', 'OPENING_BALANCE_POSTED', 'INVOICE_POSTED']) {
      const t = getActiveTemplate(eventType);
      expect(t.status).toBe(TemplateStatus.ACTIVE);
      expect(typeof t.buildDraft).toBe('function');
    }
  });
});

/* ── §24 Journal numbering ───────────────────────────────────────────────── */

describe('journal numbering', () => {
  it('allocates sequential, prefixed, year-scoped numbers per business', async () => {
    const { client } = makeAcctV2PrismaStub();
    const numbers = [];
    await client.$transaction(async (tx) => {
      numbers.push(await allocateJournalNumber(tx, ctx(), { eventType: 'MANUAL_JOURNAL_POSTED', postingDate: '2026-07-15' }));
      numbers.push(await allocateJournalNumber(tx, ctx(), { eventType: 'MANUAL_JOURNAL_POSTED', postingDate: '2026-07-16' }));
      numbers.push(await allocateJournalNumber(tx, ctx(CREATOR, T2), { eventType: 'MANUAL_JOURNAL_POSTED', postingDate: '2026-07-15' }));
      numbers.push(await allocateJournalNumber(tx, ctx(), { eventType: 'ADJUSTMENT_POSTED', postingDate: '2026-07-15' }));
    });
    expect(numbers[0]).toBe('MJ-2026-000001');
    expect(numbers[1]).toBe('MJ-2026-000002'); // same business increments
    expect(numbers[2]).toBe('MJ-2026-000001'); // other business has its own sequence
    expect(numbers[3]).toBe('ADJ-2026-000001'); // event scope has its own prefix
  });
});

/* ── 47.4 Period resolution ──────────────────────────────────────────────── */

describe('period resolution', () => {
  const periods = (status) => [
    { id: 'p7', tenantId: T1, name: 'Jul 2026', status, startDate: '2026-07-01', endDate: '2026-07-31' },
  ];

  it('resolves an open covering period', async () => {
    const { client } = makeAcctV2PrismaStub({ accountingPeriods: periods('open') });
    const res = await resolvePostingPeriod(client, ctx(), { transactionDate: '2026-07-15', hasPermission: deny });
    expect(res.accountingPeriodId).toBe('p7');
    expect(res.periodStatus).toBe('OPEN');
  });

  it('rejects posting into a closed period', async () => {
    const { client } = makeAcctV2PrismaStub({ accountingPeriods: periods('closed') });
    await expect(
      resolvePostingPeriod(client, ctx(), { transactionDate: '2026-07-15', hasPermission: allow })
    ).rejects.toThrow(ClosedAccountingPeriodError);
  });

  it('rejects a date gap explicitly when periods are configured (no silent pass)', async () => {
    const { client } = makeAcctV2PrismaStub({ accountingPeriods: periods('open') });
    await expect(
      resolvePostingPeriod(client, ctx(), { transactionDate: '2026-05-15', hasPermission: allow })
    ).rejects.toThrow(InvalidAccountingPeriodError);
  });

  it('requires permission for backdated posting into an earlier open period', async () => {
    const { client } = makeAcctV2PrismaStub({
      accountingPeriods: [
        { id: 'p6', tenantId: T1, name: 'Jun', status: 'open', startDate: '2026-06-01', endDate: '2026-06-30' },
        { id: 'p7', tenantId: T1, name: 'Jul', status: 'open', startDate: '2026-07-01', endDate: '2026-07-31' },
      ],
    });
    await expect(
      resolvePostingPeriod(client, ctx(), { transactionDate: '2026-06-10', hasPermission: deny })
    ).rejects.toThrow(InvalidPostingDateError);
    const res = await resolvePostingPeriod(client, ctx(), { transactionDate: '2026-06-10', hasPermission: allow });
    expect(res.backdated).toBe(true);
  });

  it('warns (does not fail) for a business with no periods configured', async () => {
    const { client } = makeAcctV2PrismaStub();
    const res = await resolvePostingPeriod(client, ctx(), { transactionDate: '2026-07-15', hasPermission: deny });
    expect(res.periodStatus).toBe('UNCONFIGURED');
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

/* ── 47.3 Account validation ─────────────────────────────────────────────── */

describe('account validation', () => {
  const draftWith = (lines) =>
    createJournalDraft({
      description: 'test',
      transactionDate: '2026-07-15',
      sourceReference: createSourceReference({
        sourceModule: 'MANUAL_JOURNAL', sourceType: 'JournalEntry', sourceId: 'j', eventType: 'MANUAL_JOURNAL_POSTED',
      }),
      lines,
    });

  const validate = (client, draft, options = {}) =>
    validateDraftAccounts(client, ctx(), draft, { isManual: true, hasPermission: allow, ...options });

  it('accepts valid posting accounts', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    await expect(
      validate(client, draftWith([{ accountId: 'exp', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }]))
    ).resolves.toBeTruthy();
  });

  it('rejects unknown and cross-business accounts', async () => {
    const { client } = makeAcctV2PrismaStub({
      accounts: [...postingAccounts(), { id: 'foreign', tenantId: T2, isActive: true }],
    });
    await expect(
      validate(client, draftWith([{ accountId: 'foreign', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }]))
    ).rejects.toThrow(AccountNotFoundError); // tenant-scoped load: foreign account is invisible
  });

  it('rejects header, inactive and deprecated accounts', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    await expect(
      validate(client, draftWith([{ accountId: 'hdr', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }]))
    ).rejects.toThrow(NonPostingAccountError);
    await expect(
      validate(client, draftWith([{ accountId: 'inact', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }]))
    ).rejects.toThrow(InactiveAccountError);
    await expect(
      validate(client, draftWith([{ accountId: 'depr', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }]))
    ).rejects.toThrow(DeprecatedAccountError);
  });

  it('requires the customer dimension on Accounts Receivable control lines', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    await expect(
      validate(client, draftWith([{ accountId: 'ar', debit: '10.00' }, { accountId: 'rev', credit: '10.00' }]))
    ).rejects.toThrow(ControlAccountDimensionError);
    await expect(
      validate(client, draftWith([
        { accountId: 'ar', debit: '10.00', dimensions: { customerId: 'c1' } },
        { accountId: 'rev', credit: '10.00' },
      ]))
    ).resolves.toBeTruthy();
  });

  it('blocks manual postings to protected system purposes without elevated permission', async () => {
    const { client } = makeAcctV2PrismaStub({
      accounts: [
        ...postingAccounts(),
        { id: 're', tenantId: T1, accountCode: '3800', isActive: true, systemPurpose: 'RETAINED_EARNINGS' },
      ],
    });
    await expect(
      validate(
        client,
        draftWith([{ accountId: 're', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }]),
        { hasPermission: deny }
      )
    ).rejects.toThrow(ApprovalInvalidError);
  });
});

/* ── §13 Approval validation ─────────────────────────────────────────────── */

describe('approval validation', () => {
  it('adjustments and opening balances always require approval', () => {
    for (const eventType of ['ADJUSTMENT_POSTED', 'OPENING_BALANCE_POSTED', 'REVERSAL_POSTED']) {
      expect(resolveApprovalRequirement({ eventType }).required).toBe(true);
    }
  });

  it('rejects a missing approval when required', () => {
    const requirement = resolveApprovalRequirement({ eventType: 'ADJUSTMENT_POSTED' });
    expect(() =>
      validateApproval({ context: ctx(), requirement, approval: null, initiatorId: CREATOR })
    ).toThrow(ApprovalRequiredError);
  });

  it('enforces separation of duties', () => {
    const requirement = resolveApprovalRequirement({ eventType: 'MANUAL_JOURNAL_POSTED', amountMinor: 100 });
    expect(() =>
      validateApproval({
        context: ctx(),
        requirement,
        approval: { approvedById: CREATOR, approvedAt: new Date(), createdById: CREATOR },
        initiatorId: CREATOR,
      })
    ).toThrow(ApprovalInvalidError);
    expect(() =>
      validateApproval({
        context: ctx(),
        requirement,
        approval: { approvedById: APPROVER, approvedAt: new Date(), createdById: CREATOR },
        initiatorId: CREATOR,
      })
    ).not.toThrow();
  });
});

/* ── 47.8 / 48 Manual journal pilot end-to-end ───────────────────────────── */

describe('manual journal pilot (NEW_ENGINE)', () => {
  it('draft → submit → approve → post produces one immutable posted journal with full trace', async () => {
    const { client, data } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const draft = await approvedManualJournal(client);

    const result = await postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);

    expect(result.postingStatus).toBe(EventRegistryStatus.POSTED);
    expect(result.journalNumber).toBe('MJ-2026-000001');
    expect(result.totalDebit).toBe('1500.00');
    expect(result.totalCredit).toBe('1500.00');
    expect(result.wasExistingPosting).toBe(false);

    const journal = data.legacyJournalEntries.find((j) => j.id === draft.id);
    expect(journal.status).toBe('Posted');
    expect(journal.journalNumber).toBe('MJ-2026-000001');
    expect(journal.templateId).toBe('MANUAL_JOURNAL');
    expect(journal.templateVersion).toBe(1);
    expect(journal.architectureVersion).toBe('ACCOUNTING_V2');
    expect(journal.accountingEventId).toBeTruthy();

    const event = data.eventRegistry.find((e) => e.id === journal.accountingEventId);
    expect(event.status).toBe(EventRegistryStatus.POSTED);
    expect(event.templateId).toBe('MANUAL_JOURNAL');

    // audit + outbox written in the same flow
    expect(data.auditLogs.some((a) => a.action === 'acctv2.posting.posted')).toBe(true);
    expect(data.outbox.some((o) => o.eventType === 'JOURNAL_POSTED')).toBe(true);
    expect(data.outbox.some((o) => o.eventType === 'SOURCE_ACCOUNTING_STATUS_CHANGED')).toBe(true);

    // source posting state reads POSTED through the registry
    const state = await getSourcePostingState(client, ctx(), { sourceType: 'JournalEntry', sourceId: draft.id });
    expect(state.state).toBe(SourcePostingState.POSTED);
    expect(state.postedJournalId).toBe(draft.id);
  });

  it('a duplicate post request replays the original result — exactly one journal', async () => {
    const { client, data } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const draft = await approvedManualJournal(client);

    const first = await postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);
    const second = await postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);

    expect(second.wasExistingPosting).toBe(true);
    expect(second.journalEntryId).toBe(first.journalEntryId);
    const postedEvents = data.eventRegistry.filter((e) => e.status === EventRegistryStatus.POSTED);
    expect(postedEvents).toHaveLength(1);
    const postedJournals = data.legacyJournalEntries.filter((j) => j.status === 'Posted');
    expect(postedJournals).toHaveLength(1);
  });

  it('posting an unapproved draft is refused', async () => {
    const { client } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const draft = await createManualJournalDraft(
      ctx(CREATOR),
      {
        description: 'Unapproved',
        entryDate: '2026-07-15',
        lines: [{ accountId: 'exp', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }],
      },
      { hasPermission: allow },
      client
    );
    await expect(
      postManualJournal(ctx(CREATOR), draft.id, { hasPermission: allow }, client)
    ).rejects.toThrow(SourceNotPostableError);
  });

  it('self-approval is refused (separation of duties)', async () => {
    const { client } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const draft = await createManualJournalDraft(
      ctx(CREATOR),
      {
        description: 'Self approve attempt',
        entryDate: '2026-07-15',
        lines: [{ accountId: 'exp', debit: '10.00' }, { accountId: 'cash', credit: '10.00' }],
      },
      { hasPermission: allow },
      client
    );
    await submitManualJournal(ctx(CREATOR), draft.id, { hasPermission: allow }, client);
    await expect(
      approveManualJournal(ctx(CREATOR), draft.id, { hasPermission: allow }, client)
    ).rejects.toThrow(ApprovalInvalidError);
  });

  it('an unbalanced draft cannot even be created', async () => {
    const { client } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    await expect(
      createManualJournalDraft(
        ctx(CREATOR),
        {
          description: 'Unbalanced',
          entryDate: '2026-07-15',
          lines: [{ accountId: 'exp', debit: '10.00' }, { accountId: 'cash', credit: '9.99' }],
        },
        { hasPermission: allow },
        client
      )
    ).rejects.toThrow(UnbalancedJournalError);
  });

  it('failed posting leaves no partial effect and records a durable failure', async () => {
    const { client, data } = makeAcctV2PrismaStub({
      ...newEngineSeed(),
      accounts: postingAccounts(),
      // closed period makes the pipeline reject inside the posting transaction
      accountingPeriods: [
        { id: 'p7', tenantId: T1, name: 'Jul 2026', status: 'closed', startDate: '2026-07-01', endDate: '2026-07-31' },
      ],
    });
    const draft = await approvedManualJournal(client);

    await expect(
      postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client)
    ).rejects.toThrow(ClosedAccountingPeriodError);

    // no journal was posted, no journal number consumed the source row
    const journal = data.legacyJournalEntries.find((j) => j.id === draft.id);
    expect(journal.status).toBe('Approved');
    expect(journal.journalNumber ?? null).toBeNull();

    // the claim settled to FAILED with a sanitized, non-retryable classification
    const event = data.eventRegistry[0];
    expect(event.status).toBe(EventRegistryStatus.FAILED);
    expect(event.failureCode).toBe('CLOSED_ACCOUNTING_PERIOD');
    expect(event.failureRetryable).toBe(false);
    expect(data.postingAttempts.some((a) => a.status === 'FAILED_FATAL')).toBe(true);

    // a non-retryable failure refuses retryPosting
    await expect(
      retryPosting(
        {
          context: ctx(APPROVER),
          sourceReference: {
            sourceModule: 'MANUAL_JOURNAL', sourceType: 'JournalEntry',
            sourceId: draft.id, eventType: 'MANUAL_JOURNAL_POSTED',
          },
          transactionDate: '2026-07-15',
          hasPermission: allow,
        },
        client
      )
    ).rejects.toThrow(AccountingValidationError);
  });

  it('posted journals accept only note annotations — financial fields are frozen', async () => {
    const { client } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const draft = await approvedManualJournal(client);
    await postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);

    await expect(
      updatePostedJournalAnnotation(client, ctx(), draft.id, { totalDebit: '0.00' })
    ).rejects.toThrow(JournalImmutableError);
    await expect(
      updatePostedJournalAnnotation(client, ctx(), draft.id, { notes: 'reviewed by auditor' })
    ).resolves.toBeTruthy();
  });

  it('LEGACY config still posts via NEW_ENGINE', async () => {
    const { client } = makeAcctV2PrismaStub({
      accounts: postingAccounts(),
      configurations: [
        {
          id: 'cfg-legacy',
          tenantId: T1,
          baseCurrency: 'MWK',
          defaultPostingMode: 'LEGACY',
          enableShadowAccounting: false,
        },
      ],
      featureFlags: [
        { id: 'f1', tenantId: T1, flagKey: FLAG.V2_ENABLED, moduleKey: '*', eventType: '*', enabled: true },
      ],
    });
    const draft = await approvedManualJournal(client);
    await expect(
      postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client)
    ).resolves.toBeTruthy();
  });

  it('preview never claims the event or consumes a journal number', async () => {
    const { client, data } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const draft = await approvedManualJournal(client);
    const preview = await previewPosting(
      {
        context: ctx(APPROVER),
        sourceReference: {
          sourceModule: 'MANUAL_JOURNAL', sourceType: 'JournalEntry',
          sourceId: draft.id, eventType: 'MANUAL_JOURNAL_POSTED',
        },
        transactionDate: '2026-07-15',
        hasPermission: allow,
      },
      client
    );
    expect(preview.posted).toBe(false);
    expect(preview.valid).toBe(true);
    expect(preview.totalDebit).toBe('1500.00');
    expect(preview.lines).toHaveLength(2);
    expect(data.eventRegistry).toHaveLength(0); // nothing claimed
    expect(data.journalSequences).toHaveLength(0); // no number consumed
  });
});

/* ── 47.11 Shadow posting ────────────────────────────────────────────────── */

describe.skip('shadow invoice posting (removed in fresh-books)', () => {
  const invoiceSeed = () => ({
    ...shadowSeed(),
    accounts: postingAccounts(),
    invoices: [
      { id: 'INV-1', tenantId: T1, invoiceNumber: 'INV-0001', status: 'sent', total: '115.00', taxAmount: '15.00', clientId: 'c1' },
    ],
    coaV2AccountMappings: [
      { id: 'm1', tenantId: T1, purpose: 'ACCOUNTS_RECEIVABLE', accountId: 'ar', moduleKey: '*', transactionType: '*', currency: '*', branchKey: '*', status: 'ACTIVE', priority: 0 },
      { id: 'm2', tenantId: T1, purpose: 'SALES_REVENUE', accountId: 'rev', moduleKey: '*', transactionType: '*', currency: '*', branchKey: '*', status: 'ACTIVE', priority: 0 },
      { id: 'm3', tenantId: T1, purpose: 'VAT_OUTPUT', accountId: 'vat', moduleKey: '*', transactionType: '*', currency: '*', branchKey: '*', status: 'ACTIVE', priority: 0 },
    ],
    legacyTransactions: [
      {
        id: 'lt1', tenantId: T1, sourceType: 'Invoice', sourceId: 'INV-1', status: 'posted',
        lines: [
          { accountId: 'ar', debitAmount: 115, creditAmount: 0 },
          { accountId: 'rev', debitAmount: 0, creditAmount: 100 },
          { accountId: 'vat', debitAmount: 0, creditAmount: 15 },
        ],
      },
    ],
  });

  const invoiceInput = () => ({
    context: ctx(),
    sourceReference: {
      sourceModule: 'SALES', sourceType: 'Invoice', sourceId: 'INV-1', eventType: 'INVOICE_POSTED',
    },
    transactionDate: '2026-07-15',
    dimensions: { customerId: 'c1' },
    hasPermission: allow,
  });

  it('creates an isolated shadow journal with an EXACT_MATCH comparison and no production effect', async () => {
    const { client, data } = makeAcctV2PrismaStub(invoiceSeed());
    const result = await executePosting(invoiceInput(), client);

    expect(result.postingStatus).toBe(EventRegistryStatus.SHADOWED);
    expect(result.wasShadowPosting).toBe(true);
    expect(result.comparisonStatus).toBe('EXACT_MATCH');
    expect(result.journalEntryId).toBeNull();

    // shadow rows exist; NOTHING was written to the production journal table
    expect(data.shadowJournals).toHaveLength(1);
    expect(data.shadowComparisons).toHaveLength(1);
    expect(data.legacyJournalEntries).toHaveLength(0);
    expect(data.journalSequences).toHaveLength(0); // no journal number consumed
    // invoice source status untouched
    expect(data.invoices[0].status).toBe('sent');
  });

  it('flags an amount difference against the legacy posting', async () => {
    const seed = invoiceSeed();
    seed.legacyTransactions[0].lines[1].creditAmount = 90; // legacy revenue differs
    seed.legacyTransactions[0].lines[2].creditAmount = 25;
    const { client } = makeAcctV2PrismaStub(seed);
    const result = await executePosting(invoiceInput(), client);
    expect(result.comparisonStatus).toBe('AMOUNT_DIFFERENCE');
  });

  it('reports MISSING_LEGACY_POSTING when no legacy journal exists', async () => {
    const seed = invoiceSeed();
    seed.legacyTransactions = [];
    const { client } = makeAcctV2PrismaStub(seed);
    const result = await executePosting(invoiceInput(), client);
    expect(result.comparisonStatus).toBe('MISSING_LEGACY_POSTING');
  });

  it('records an invalid proposal without throwing to the caller', async () => {
    const seed = invoiceSeed();
    seed.coaV2AccountMappings = []; // missing mappings → proposal cannot be generated
    const { client, data } = makeAcctV2PrismaStub(seed);
    const result = await executePosting(invoiceInput(), client);
    expect(result.comparisonStatus).toBe('INVALID_NEW_PROPOSAL');
    expect(result.postingStatus).toBe(EventRegistryStatus.FAILED);
    expect(data.legacyJournalEntries).toHaveLength(0);
  });
});

/* ── §33 Legacy posting guard ────────────────────────────────────────────── */

describe('legacy↔new posting guard', () => {
  it('legacy path refuses events the V2 engine owns (NEW_ENGINE mode)', async () => {
    const { client } = makeAcctV2PrismaStub(newEngineSeed());
    await expect(
      assertLegacyPostingAllowed({ tenantId: T1, sourceType: 'Invoice', sourceId: 'INV-9' }, client)
    ).rejects.toThrow(LegacyAndNewPostingConflictError);
  });

  it('legacy path refuses sources the V2 engine already posted', async () => {
    const { client } = makeAcctV2PrismaStub({
      eventRegistry: [
        {
          id: 'ev1', tenantId: T1, sourceModule: 'SALES', sourceType: 'Invoice', sourceId: 'INV-1',
          eventType: 'INVOICE_POSTED', eventVersion: 1, idempotencyKey: 'k1',
          status: EventRegistryStatus.POSTED, journalEntryId: 'j1',
        },
      ],
    });
    await expect(
      assertLegacyPostingAllowed({ tenantId: T1, sourceType: 'Invoice', sourceId: 'INV-1' }, client)
    ).rejects.toThrow(LegacyAndNewPostingConflictError);
  });

  it('archived Transaction rows do not block NEW_ENGINE posting', async () => {
    const { client } = makeAcctV2PrismaStub({
      legacyTransactions: [
        { id: 'lt1', tenantId: T1, sourceType: 'Invoice', sourceId: 'INV-1', status: 'posted', lines: [] },
      ],
    });
    await client.$transaction(async (tx) => {
      await expect(
        assertNewEnginePostingAllowed(tx, ctx(), { sourceType: 'Invoice', sourceId: 'INV-1' })
      ).resolves.toBeUndefined();
    });
  });

  it('legacy path always refuses when V2 schema is present', async () => {
    const { client } = makeAcctV2PrismaStub();
    await expect(
      assertLegacyPostingAllowed({ tenantId: T1, sourceType: 'Invoice', sourceId: 'INV-1' }, client)
    ).rejects.toThrow(LegacyAndNewPostingConflictError);
  });
});

/* ── 47.10 Opening balances ──────────────────────────────────────────────── */

describe('opening balance framework', () => {
  const balancedInput = () => ({
    effectiveDate: '2026-01-01',
    description: 'Opening as at 1 Jan 2026',
    evidenceReference: 'DOC-2026-001',
    lines: [
      { accountId: 'cash', debit: '5000.00' },
      { accountId: 'obe', credit: '5000.00' },
    ],
  });

  it('creates, approves and posts a balanced batch through the engine', async () => {
    const { client, data } = makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: postingAccounts() });
    const batch = await createOpeningBalanceBatch(ctx(CREATOR), balancedInput(), { hasPermission: allow }, client);
    await submitOpeningBalanceBatch(ctx(CREATOR), batch.id, { hasPermission: allow }, client);
    await approveOpeningBalanceBatch(ctx(APPROVER), batch.id, { hasPermission: allow }, client);

    const result = await postOpeningBalanceBatch(ctx(APPROVER), batch.id, { hasPermission: allow }, client);
    expect(result.postingStatus).toBe(EventRegistryStatus.POSTED);
    expect(result.journalNumber).toBe('OB-2026-000001');

    const stored = data.openingBalanceBatches.find((b) => b.id === batch.id);
    expect(stored.status).toBe('POSTED');
    expect(stored.journalEntryId).toBe(result.journalEntryId);

    const journal = data.legacyJournalEntries.find((j) => j.id === result.journalEntryId);
    expect(journal.entryType).toBe('OpeningBalance');
    expect(journal.status).toBe('Posted');
  });

  it('rejects an unbalanced batch at creation', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    const input = balancedInput();
    input.lines[1].credit = '4000.00';
    await expect(
      createOpeningBalanceBatch(ctx(CREATOR), input, { hasPermission: allow }, client)
    ).rejects.toThrow(UnbalancedJournalError);
  });

  it('rejects a batch without supporting evidence', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    const input = { ...balancedInput(), evidenceReference: '' };
    await expect(
      createOpeningBalanceBatch(ctx(CREATOR), input, { hasPermission: allow }, client)
    ).rejects.toThrow(AccountingValidationError);
  });

  it('refuses a duplicate batch for the same business, date and version', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    await createOpeningBalanceBatch(ctx(CREATOR), balancedInput(), { hasPermission: allow }, client);
    await expect(
      createOpeningBalanceBatch(ctx(CREATOR), balancedInput(), { hasPermission: allow }, client)
    ).rejects.toThrow(/already exists/i);
  });

  it('AR opening lines require the customer dimension', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    const input = balancedInput();
    input.lines = [
      { accountId: 'ar', debit: '5000.00' }, // AR without customerId
      { accountId: 'obe', credit: '5000.00' },
    ];
    await expect(
      createOpeningBalanceBatch(ctx(CREATOR), input, { hasPermission: allow }, client)
    ).rejects.toThrow(ControlAccountDimensionError);
  });

  it('self-approval of a batch is refused', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    const batch = await createOpeningBalanceBatch(ctx(CREATOR), balancedInput(), { hasPermission: allow }, client);
    await submitOpeningBalanceBatch(ctx(CREATOR), batch.id, { hasPermission: allow }, client);
    await expect(
      approveOpeningBalanceBatch(ctx(CREATOR), batch.id, { hasPermission: allow }, client)
    ).rejects.toThrow(ApprovalInvalidError);
  });

  it('cross-business batch access is refused', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: postingAccounts() });
    const batch = await createOpeningBalanceBatch(ctx(CREATOR), balancedInput(), { hasPermission: allow }, client);
    await expect(
      approveOpeningBalanceBatch(ctx(APPROVER, T2), batch.id, { hasPermission: allow }, client)
    ).rejects.toThrow(/does not belong/i);
  });
});
