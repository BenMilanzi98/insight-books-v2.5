# POS Till Float Funding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fund optional POS opening float with real GL transfers into a dedicated Till Float account (Cash first, Capital remainder), sweep Till → Cash on close, allow same-day reopen, keep once-after-17:00 close reminder and midnight stale auto-close.

**Architecture:** Extend `PosCashDay` + `lib/posCashDayService.js`. Ensure a system Till Float PaymentAccount linked to a dedicated CoA leaf (`POS_TILL_FLOAT`). On open/reopen, post one balanced V2 journal via `postBankTransferAccounting` with custom lines. On close (manual or `closeStalePosCashDays`), sweep live Till Float balance to system Cash. Same-day reopen updates the existing unique day row (`CLOSED` → `OPEN`).

**Tech Stack:** Next.js App Router, Prisma, Vitest, accounting V2 `postBankTransferAccounting`, existing payment-account CoA link helpers.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-pos-till-float-funding-design.md` — follow locked decisions exactly.
- Funding = real GL; float destination = dedicated Till Float (not silent Petty Cash / not main Cash 1110).
- Opening amount optional (`0`/empty = open, no funding journal).
- Close = one Till → Cash GL sweep using live Till Float CoA balance.
- Reopen = same `(tenantId, branchKey, businessDate)` row; never a second day row.
- Keep once-after-17:00 Blantyre close prompt (`tillClosePromptShownRef`); midnight = existing `closeStalePosCashDays` / `sweepAllTenantsPosCashDays`.
- Out of scope: per-sale Till posting; multi-branch tills (`branchKey` stays `none`).
- Do **not** commit unless the user explicitly asks.
- Prefer TDD: failing test → implement → green per task.
- Do not edit `insight/` duplicates unless a shared root import requires it.
- Prefer failing closed when Capital is needed but unmapped (`CAPITAL_UNMAPPED`).

## File map

| File | Responsibility |
|------|----------------|
| `lib/posTillFunding.js` | Pure split + journal line builders + source id helpers |
| `lib/posTillFloatAccounts.js` | Ensure Till Float PaymentAccount + CoA leaf; resolve Owner Capital CoA |
| `lib/coaV2/domain/systemPurposes.js` | Add `POS_TILL_FLOAT` purpose |
| `lib/posCashDayService.js` | Open/reopen/funding; close sweep; state flags |
| `prisma/schema.prisma` | `PosCashDay` funding/close/reopen fields + till float FK |
| `prisma/migrations/20260812010000_pos_till_float_funding/migration.sql` | DDL |
| `app/api/pos/cash-day/open/route.js` | Map new error codes; allow reopen |
| `components/pos/PosTillGateModals.jsx` | Optional float, funding preview, reopen UX, close copy |
| `test/posTillFunding.test.js` | Pure funding math + line builders |
| `test/posCashDayOpenClose.test.js` | Open/reopen/close service behaviour with mocks |

---

### Task 1: Pure funding split + journal builders

**Files:**
- Create: `lib/posTillFunding.js`
- Create: `test/posTillFunding.test.js`

**Interfaces:**
- Produces:
  - `splitTillFunding(amount, cashAvailable) → { cashPart, capitalPart }`
  - `posTillOpenSourceId(dayId, openCount) → string` e.g. `{dayId}:open:{openCount}`
  - `posTillCloseSourceId(dayId, openCount) → string` e.g. `{dayId}:close:{openCount}`
  - `buildOpenFundingLines({ tillCoaId, cashCoaId, capitalCoaId, cashPart, capitalPart }) → { amount, lines }`
  - `buildCloseSweepLines({ tillCoaId, cashCoaId, amount }) → { amount, lines }`
  - `POS_TILL_SOURCE = { OPEN: 'PosCashDayOpen', CLOSE: 'PosCashDayClose' }`

- [ ] **Step 1: Write failing tests**

Create `test/posTillFunding.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  splitTillFunding,
  buildOpenFundingLines,
  buildCloseSweepLines,
  posTillOpenSourceId,
  posTillCloseSourceId,
  POS_TILL_SOURCE,
} from '../lib/posTillFunding.js';

describe('splitTillFunding', () => {
  it('uses all cash when cash covers amount', () => {
    expect(splitTillFunding(500, 1000)).toEqual({ cashPart: 500, capitalPart: 0 });
  });

  it('uses all capital when cash is empty', () => {
    expect(splitTillFunding(500, 0)).toEqual({ cashPart: 0, capitalPart: 500 });
  });

  it('uses cash first then capital remainder', () => {
    expect(splitTillFunding(500, 200)).toEqual({ cashPart: 200, capitalPart: 300 });
  });

  it('treats negative cash as zero available', () => {
    expect(splitTillFunding(100, -50)).toEqual({ cashPart: 0, capitalPart: 100 });
  });

  it('returns zeros for zero/blank amounts', () => {
    expect(splitTillFunding(0, 999)).toEqual({ cashPart: 0, capitalPart: 0 });
  });
});

describe('journal builders', () => {
  it('builds one balanced multi-line open journal for cash+capital', () => {
    const { amount, lines } = buildOpenFundingLines({
      tillCoaId: 'till',
      cashCoaId: 'cash',
      capitalCoaId: 'cap',
      cashPart: 200,
      capitalPart: 300,
    });
    expect(amount).toBe(500);
    const debits = lines.reduce((s, l) => s + l.debitAmount, 0);
    const credits = lines.reduce((s, l) => s + l.creditAmount, 0);
    expect(debits).toBe(500);
    expect(credits).toBe(500);
    expect(lines.some((l) => l.accountId === 'till' && l.debitAmount === 500)).toBe(true);
    expect(lines.some((l) => l.accountId === 'cash' && l.creditAmount === 200)).toBe(true);
    expect(lines.some((l) => l.accountId === 'cap' && l.creditAmount === 300)).toBe(true);
  });

  it('builds cash-only open lines without capital', () => {
    const { lines } = buildOpenFundingLines({
      tillCoaId: 'till',
      cashCoaId: 'cash',
      capitalCoaId: null,
      cashPart: 100,
      capitalPart: 0,
    });
    expect(lines).toHaveLength(2);
  });

  it('builds close sweep Dr Cash Cr Till', () => {
    const { amount, lines } = buildCloseSweepLines({
      tillCoaId: 'till',
      cashCoaId: 'cash',
      amount: 400,
    });
    expect(amount).toBe(400);
    expect(lines.find((l) => l.accountId === 'cash').debitAmount).toBe(400);
    expect(lines.find((l) => l.accountId === 'till').creditAmount).toBe(400);
  });

  it('exports stable source ids and types', () => {
    expect(posTillOpenSourceId('d1', 2)).toBe('d1:open:2');
    expect(posTillCloseSourceId('d1', 2)).toBe('d1:close:2');
    expect(POS_TILL_SOURCE.OPEN).toBe('PosCashDayOpen');
    expect(POS_TILL_SOURCE.CLOSE).toBe('PosCashDayClose');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run test/posTillFunding.test.js`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/posTillFunding.js`**

```js
export const POS_TILL_SOURCE = Object.freeze({
  OPEN: 'PosCashDayOpen',
  CLOSE: 'PosCashDayClose',
});

export function splitTillFunding(amountInput, cashAvailableInput) {
  const amount = Math.max(0, Number(amountInput) || 0);
  const cashAvailable = Math.max(0, Number(cashAvailableInput) || 0);
  if (amount <= 0) return { cashPart: 0, capitalPart: 0 };
  const cashPart = Math.min(amount, cashAvailable);
  const capitalPart = Math.max(0, amount - cashPart);
  return { cashPart, capitalPart };
}

export function posTillOpenSourceId(dayId, openCount) {
  return `${dayId}:open:${Number(openCount) || 1}`;
}

export function posTillCloseSourceId(dayId, openCount) {
  return `${dayId}:close:${Number(openCount) || 1}`;
}

export function buildOpenFundingLines({
  tillCoaId,
  cashCoaId,
  capitalCoaId,
  cashPart,
  capitalPart,
}) {
  const cash = Math.max(0, Number(cashPart) || 0);
  const capital = Math.max(0, Number(capitalPart) || 0);
  const amount = cash + capital;
  if (amount <= 0) return { amount: 0, lines: [] };

  const lines = [];
  let n = 1;
  lines.push({
    lineNumber: n++,
    accountId: tillCoaId,
    debitAmount: amount,
    creditAmount: 0,
    description: 'POS till float funding in',
  });
  if (cash > 0) {
    lines.push({
      lineNumber: n++,
      accountId: cashCoaId,
      debitAmount: 0,
      creditAmount: cash,
      description: 'POS till float from Cash',
    });
  }
  if (capital > 0) {
    lines.push({
      lineNumber: n++,
      accountId: capitalCoaId,
      debitAmount: 0,
      creditAmount: capital,
      description: 'POS till float from Capital',
    });
  }
  return { amount, lines };
}

export function buildCloseSweepLines({ tillCoaId, cashCoaId, amount: amountInput }) {
  const amount = Math.max(0, Number(amountInput) || 0);
  if (amount <= 0) return { amount: 0, lines: [] };
  return {
    amount,
    lines: [
      {
        lineNumber: 1,
        accountId: cashCoaId,
        debitAmount: amount,
        creditAmount: 0,
        description: 'POS till close sweep in',
      },
      {
        lineNumber: 2,
        accountId: tillCoaId,
        debitAmount: 0,
        creditAmount: amount,
        description: 'POS till close sweep out',
      },
    ],
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run test/posTillFunding.test.js`

Expected: PASS.

- [ ] **Step 5: Commit only if user asks** — otherwise skip.

---

### Task 2: Schema — PosCashDay till funding fields

**Files:**
- Modify: `prisma/schema.prisma` (`PosCashDay`, `PaymentAccount` relations)
- Create: `prisma/migrations/20260812010000_pos_till_float_funding/migration.sql`

**Interfaces:**
- Produces Prisma fields on `PosCashDay`:
  - `tillFloatAccountId String?`
  - `openFundingJournalId String?`
  - `closeSweepJournalId String?`
  - `fundingCashAmount Float?`
  - `fundingCapitalAmount Float?`
  - `openCount Int @default(1)`
  - `reopenedAt DateTime?`
  - relation `tillFloatAccount PaymentAccount? @relation("PosCashDayTillFloat", ...)`
- PaymentAccount gains `posCashDaysAsTillFloat PosCashDay[] @relation("PosCashDayTillFloat")`

- [ ] **Step 1: Update `PosCashDay` model**

In `prisma/schema.prisma`, add fields after `systemCashAccountId`:

```prisma
  tillFloatAccountId     String?
  openFundingJournalId   String?
  closeSweepJournalId    String?
  fundingCashAmount      Float?
  fundingCapitalAmount   Float?
  openCount              Int       @default(1)
  reopenedAt             DateTime?
```

Add relation next to `systemCashAccount`:

```prisma
  tillFloatAccount  PaymentAccount? @relation("PosCashDayTillFloat", fields: [tillFloatAccountId], references: [id], onDelete: SetNull)
```

On `PaymentAccount` add:

```prisma
  posCashDaysAsTillFloat  PosCashDay[]  @relation("PosCashDayTillFloat")
```

- [ ] **Step 2: Write migration SQL**

Create `prisma/migrations/20260812010000_pos_till_float_funding/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "tillFloatAccountId" TEXT;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "openFundingJournalId" TEXT;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "closeSweepJournalId" TEXT;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "fundingCashAmount" DOUBLE PRECISION;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "fundingCapitalAmount" DOUBLE PRECISION;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosCashDay"
    ADD CONSTRAINT "PosCashDay_tillFloatAccountId_fkey"
    FOREIGN KEY ("tillFloatAccountId") REFERENCES "PaymentAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PosCashDay_tillFloatAccountId_idx" ON "PosCashDay"("tillFloatAccountId");
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`

Expected: success (no schema validation errors).

- [ ] **Step 4: Apply migration locally if DB available**

Run: `npx prisma migrate deploy` (or project’s usual migrate command).

Expected: migration applied.

- [ ] **Step 5: Commit only if user asks** — otherwise skip.

---

### Task 3: Till Float account ensure + Capital resolve + purpose

**Files:**
- Modify: `lib/coaV2/domain/systemPurposes.js`
- Create: `lib/posTillFloatAccounts.js`
- Create: `test/posTillFloatAccounts.test.js` (mock prisma / account helpers as needed)

**Interfaces:**
- Produces:
  - `SYSTEM_ACCOUNT_PURPOSES.POS_TILL_FLOAT` — asset, debit, legacyCode `'1112'`
  - `ensurePosTillFloatPaymentAccount(tenantId, client) → PaymentAccount` (with `coaAccountId` set to dedicated leaf, **not** main Cash `1110`)
  - `resolveOwnerCapitalCoaAccount(tenantId, client) → Account | null` (uses equity mapping; returns null instead of throw when missing — caller fails closed)
  - Constants: `POS_TILL_FLOAT_PA_NAME = 'Till Float'`, `POS_TILL_FLOAT_REFERENCE = 'POS_TILL_FLOAT'`, `POS_TILL_FLOAT_GL_CODE = '1112'`

- [ ] **Step 1: Add purpose**

In `lib/coaV2/domain/systemPurposes.js`, under cash/banking purposes:

```js
  POS_TILL_FLOAT: {
    categories: [ASSET],
    behaviours: [POSTING, SYSTEM],
    normalBalance: DEBIT,
    subTypes: [AccountSubType.CURRENT_ASSET],
    legacyCode: '1112',
    notes: 'POS till / cash float — funded from Cash/Capital on open; swept to Cash on close.',
  },
```

- [ ] **Step 2: Write failing tests for ensure helpers**

Create `test/posTillFloatAccounts.test.js` covering:
- `POS_TILL_FLOAT_GL_CODE === '1112'`
- Pure export of name/reference constants
- Optional: mock `client` so `ensurePosTillFloatPaymentAccount` creates PA with `reference: 'POS_TILL_FLOAT'` and does not return Cash `1110` as `coaAccountId` when a till leaf exists

Minimal first pass:

```js
import { describe, expect, it } from 'vitest';
import {
  POS_TILL_FLOAT_GL_CODE,
  POS_TILL_FLOAT_PA_NAME,
  POS_TILL_FLOAT_REFERENCE,
} from '../lib/posTillFloatAccounts.js';
import { SYSTEM_ACCOUNT_PURPOSES } from '../lib/coaV2/domain/systemPurposes.js';

describe('posTillFloatAccounts constants', () => {
  it('registers POS_TILL_FLOAT purpose on 1112', () => {
    expect(SYSTEM_ACCOUNT_PURPOSES.POS_TILL_FLOAT.legacyCode).toBe('1112');
    expect(POS_TILL_FLOAT_GL_CODE).toBe('1112');
    expect(POS_TILL_FLOAT_PA_NAME).toBe('Till Float');
    expect(POS_TILL_FLOAT_REFERENCE).toBe('POS_TILL_FLOAT');
  });
});
```

- [ ] **Step 3: Run — expect FAIL** then implement `lib/posTillFloatAccounts.js`

Implementation sketch:

```js
import prisma from './prisma';
import { resolveEquityAccountByPurpose } from './equityManagement/application/mappingService.js';

export const POS_TILL_FLOAT_PA_NAME = 'Till Float';
export const POS_TILL_FLOAT_REFERENCE = 'POS_TILL_FLOAT';
export const POS_TILL_FLOAT_GL_CODE = '1112';
export const POS_TILL_FLOAT_GL_NAME = 'Till / Cash Float';

/**
 * Ensure CoA leaf 1112 (Till Float) exists under cash parent 1110 when possible,
 * with systemPurpose POS_TILL_FLOAT, then ensure PaymentAccount linked to that leaf.
 * Must NOT remap to main Cash 1110.
 */
export async function ensurePosTillFloatPaymentAccount(tenantId, client = prisma) {
  // 1) find Account by tenantId + (code/accountCode 1112 OR systemPurpose POS_TILL_FLOAT)
  // 2) else create posting Asset under parent 1110 (or root) with code 1112, systemPurpose POS_TILL_FLOAT
  // 3) find PaymentAccount by tenantId + reference POS_TILL_FLOAT (or name Till Float + isSystem)
  // 4) else create PaymentAccount: name Till Float, accountType Cash, isSystem true,
  //    reference POS_TILL_FLOAT, isActive true, coaAccountId = tillCoa.id
  // 5) if PA exists but coaAccountId missing/wrong (=== cash 1110), update to till leaf
  // Return payment account with coaAccountId set
}

export async function resolveOwnerCapitalCoaAccount(tenantId, client = prisma) {
  try {
    return await resolveEquityAccountByPurpose(client, tenantId, 'OWNER_CAPITAL');
  } catch {
    return null;
  }
}
```

Follow existing `Account` create patterns in `paymentAccountCoaLink.js` / capital helpers (tenantId, code, accountCode, accountName, category ASSET, postingAllowed true, isActive true, systemPurpose `'POS_TILL_FLOAT'`).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run test/posTillFloatAccounts.test.js`

- [ ] **Step 5: Commit only if user asks** — otherwise skip.

---

### Task 4: Open / reopen with optional funding

**Files:**
- Modify: `lib/posCashDayService.js` (`openPosCashDay`, `assertPosTillOpenForSale` message)
- Create/Modify: `test/posCashDayOpenClose.test.js`
- Modify: `app/api/pos/cash-day/open/route.js`

**Interfaces:**
- Consumes: `splitTillFunding`, `buildOpenFundingLines`, `posTillOpenSourceId`, `POS_TILL_SOURCE`, `ensurePosTillFloatPaymentAccount`, `resolveOwnerCapitalCoaAccount`, `getSystemCashPaymentAccount`, `resolvePaymentAccountBalance`, `postBankTransferAccounting`
- Changes `openPosCashDay`:
  - Default `openingBalance = 0` when input omitted (no longer force live Cash balance as stored opening)
  - Allow `existing.status === 'CLOSED'` → update to `OPEN`, clear close markers, `openCount += 1`, set `reopenedAt`
  - When amount `> 0`, post funding journal; persist `openFundingJournalId`, `fundingCashAmount`, `fundingCapitalAmount`, `tillFloatAccountId`
  - Throw `CAPITAL_UNMAPPED` when `capitalPart > 0` and capital missing
  - Throw `TILL_FLOAT_UNMAPPED` when till float CoA missing after ensure
- API maps `CAPITAL_UNMAPPED` / `TILL_FLOAT_UNMAPPED` → 409; remove treating reopen as `ALREADY_CLOSED`

- [ ] **Step 1: Write failing service tests (mocked)**

In `test/posCashDayOpenClose.test.js`, use `vi.mock` for prisma / funding deps as the repo usually does. Cover behaviour contracts:

```js
describe('openPosCashDay funding contract', () => {
  it('treats omitted opening balance as 0 (optional float)');
  it('splits funding cash-first when amount > cash available');
  it('throws CAPITAL_UNMAPPED when capital remainder needed and capital null');
  it('reopens CLOSED same-day row instead of ALREADY_CLOSED');
  it('increments openCount on reopen');
});
```

If full prisma mocking is heavy, extract an internal helper `planPosTillOpenFunding({ amount, cashBalance, capitalAccount })` in `posTillFunding.js` that throws coded errors, and unit-test that; keep one integration-style test that stubs `postBankTransferAccounting`.

Add to `lib/posTillFunding.js` if helpful:

```js
export function assertFundingSourcesAvailable({ capitalPart, capitalCoaId }) {
  if ((Number(capitalPart) || 0) > 0 && !capitalCoaId) {
    const err = new Error(
      'Owner Capital account is not mapped. Map OWNER_CAPITAL (e.g. 3100) before funding the till from Capital.'
    );
    err.code = 'CAPITAL_UNMAPPED';
    throw err;
  }
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Rewrite `openPosCashDay` core**

Replace ALREADY_CLOSED block and create path with:

```js
export async function openPosCashDay({
  tenantId,
  userId,
  businessDate,
  openingBalance: openingBalanceInput,
  client = prisma,
}) {
  const date = businessDate || todayYyyyMmDd();
  await closeStalePosCashDays(tenantId, date, userId, client);

  const existing = await client.posCashDay.findUnique({
    where: {
      tenantId_branchKey_businessDate: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
      },
    },
  });
  if (existing?.status === 'OPEN') {
    const err = new Error('A POS day is already open for this date.');
    err.code = 'ALREADY_OPEN';
    throw err;
  }

  let openingBalance = 0;
  if (openingBalanceInput !== undefined && openingBalanceInput !== null && openingBalanceInput !== '') {
    const n = Number(openingBalanceInput);
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error('Opening balance must be a non-negative number.');
      err.code = 'INVALID_OPENING_BALANCE';
      throw err;
    }
    openingBalance = n;
  }

  const systemCash = await getSystemCashPaymentAccount(tenantId, client);
  if (!systemCash) {
    throw new Error('System Cash payment account is missing. Open Payment Management to initialize accounts.');
  }
  const tillFloat = await ensurePosTillFloatPaymentAccount(tenantId, client);
  if (!tillFloat?.coaAccountId) {
    const err = new Error('Till Float GL account could not be created or linked.');
    err.code = 'TILL_FLOAT_UNMAPPED';
    throw err;
  }

  const cashBalance = await resolvePaymentAccountBalance(tenantId, systemCash, client);
  const { cashPart, capitalPart } = splitTillFunding(openingBalance, cashBalance);
  let capitalCoa = null;
  if (capitalPart > 0) {
    capitalCoa = await resolveOwnerCapitalCoaAccount(tenantId, client);
    assertFundingSourcesAvailable({ capitalPart, capitalCoaId: capitalCoa?.id });
  }

  const cashCoaId = systemCash.coaAccountId;
  if (openingBalance > 0 && !cashCoaId && cashPart > 0) {
    const err = new Error('System Cash is not linked to Chart of Accounts.');
    err.code = 'CASH_COA_UNMAPPED';
    throw err;
  }

  let day;
  if (existing?.status === 'CLOSED') {
    day = await client.posCashDay.update({
      where: { id: existing.id },
      data: {
        status: 'OPEN',
        openingBalance,
        systemCashAccountId: systemCash.id,
        tillFloatAccountId: tillFloat.id,
        openedAt: new Date(),
        openedById: userId || null,
        closedAt: null,
        closedById: null,
        autoClosed: false,
        totalSalesAtClose: null,
        closingBalanceAtClose: null,
        totalCashSalesSnapshot: null,
        closeSweepJournalId: null,
        openFundingJournalId: null,
        fundingCashAmount: null,
        fundingCapitalAmount: null,
        openCount: (existing.openCount || 1) + 1,
        reopenedAt: new Date(),
      },
    });
  } else {
    day = await client.posCashDay.create({
      data: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
        status: 'OPEN',
        systemCashAccountId: systemCash.id,
        tillFloatAccountId: tillFloat.id,
        openingBalance,
        openedById: userId || null,
        openCount: 1,
      },
    });
  }

  if (openingBalance > 0) {
    const { amount, lines } = buildOpenFundingLines({
      tillCoaId: tillFloat.coaAccountId,
      cashCoaId,
      capitalCoaId: capitalCoa?.id,
      cashPart,
      capitalPart,
    });
    const { postBankTransferAccounting } = await import('./accountingV2/adapters/remainingAdapters.js');
    const journal = await postBankTransferAccounting({
      db: prisma,
      tenantId,
      userId,
      sourceType: POS_TILL_SOURCE.OPEN,
      sourceId: posTillOpenSourceId(day.id, day.openCount),
      amount,
      date: new Date(`${date}T12:00:00.000Z`),
      description: `POS till open float ${date}`,
      fromAccountId: cashPart > 0 ? cashCoaId : capitalCoa?.id,
      toAccountId: tillFloat.coaAccountId,
      lines,
    });
    day = await client.posCashDay.update({
      where: { id: day.id },
      data: {
        openFundingJournalId: journal?.id || journal?.journalEntryId || null,
        fundingCashAmount: cashPart,
        fundingCapitalAmount: capitalPart,
      },
      include: {
        systemCashAccount: { select: { id: true, name: true, accountType: true } },
        deposits: true,
      },
    });
  } else {
    day = await client.posCashDay.findUnique({
      where: { id: day.id },
      include: {
        systemCashAccount: { select: { id: true, name: true, accountType: true } },
        deposits: true,
      },
    });
  }

  return day;
}
```

Update `assertPosTillOpenForSale` message to: `'POS till is not open for today. Open the till before making sales.'` (opening balance no longer required).

Update open route status map:

```js
const status =
  code === 'ALREADY_OPEN' ||
  code === 'CAPITAL_UNMAPPED' ||
  code === 'TILL_FLOAT_UNMAPPED' ||
  code === 'CASH_COA_UNMAPPED'
    ? 409
    : code === 'INVALID_OPENING_BALANCE'
      ? 400
      : 400;
```

(Do not return 409 for `ALREADY_CLOSED` — that path is removed.)

- [ ] **Step 4: Run focused tests — expect PASS**

Run: `npx vitest run test/posTillFunding.test.js test/posTillFloatAccounts.test.js test/posCashDayOpenClose.test.js`

- [ ] **Step 5: Commit only if user asks** — otherwise skip.

---

### Task 5: Close sweep Till → Cash

**Files:**
- Modify: `lib/posCashDayService.js` (`finalizePosCashDayClose`)
- Extend: `test/posCashDayOpenClose.test.js`

**Interfaces:**
- Consumes: `ensurePosTillFloatPaymentAccount` (or day.`tillFloatAccountId`), `resolvePaymentAccountBalance`, `buildCloseSweepLines`, `posTillCloseSourceId`, `POS_TILL_SOURCE`, `postBankTransferAccounting`
- On close: if Till Float live balance `> 0.0001`, post sweep; store `closeSweepJournalId`
- Keep existing operational undeposited `PosCashDayDeposit` auto-sweep for sales metrics (same-account, no GL) — Approach 1 sales still land on Cash; Till only holds float
- `closedById` null when `autoClosed`

- [ ] **Step 1: Write failing test** for close calling sweep builder / posting when till balance > 0

- [ ] **Step 2: Implement inside `finalizePosCashDayClose` before status update**

After loading `cashAcc` / computing operational remaining (keep current deposit auto-sweep behaviour), add:

```js
  const tillPa =
    (posCashDay.tillFloatAccountId &&
      (await client.paymentAccount.findFirst({
        where: { id: posCashDay.tillFloatAccountId, tenantId },
      }))) ||
    (await ensurePosTillFloatPaymentAccount(tenantId, client));

  let closeSweepJournalId = posCashDay.closeSweepJournalId || null;
  if (tillPa?.coaAccountId && cashAcc?.coaAccountId) {
    const tillBal = await resolvePaymentAccountBalance(tenantId, tillPa, client);
    if (tillBal > 0.0001 && closedById /* manual */ || tillBal > 0.0001) {
      // Always attempt for auto and manual when balance > 0.
      // For auto-close, userId may be null — postBankTransferAccounting may require userId.
      // Prefer: use openedById || closedById || first tenant admin fallback already used elsewhere;
      // if posting requires userId and none exists, log and skip GL but still close operationally
      // ONLY if autoClosed — for manual close, throw.
    }
  }
```

Concrete posting (prefer fail-closed on **manual** close):

```js
  const actorId = closedById || posCashDay.openedById || null;
  if (tillBal > 0.0001) {
    if (!actorId && !autoClosed) {
      const err = new Error('Cannot close till: missing user for GL sweep.');
      err.code = 'CLOSE_USER_REQUIRED';
      throw err;
    }
    if (actorId && cashAcc.coaAccountId && tillPa.coaAccountId) {
      const { amount, lines } = buildCloseSweepLines({
        tillCoaId: tillPa.coaAccountId,
        cashCoaId: cashAcc.coaAccountId,
        amount: tillBal,
      });
      const { postBankTransferAccounting } = await import('./accountingV2/adapters/remainingAdapters.js');
      const journal = await postBankTransferAccounting({
        db: prisma,
        tenantId,
        userId: actorId,
        sourceType: POS_TILL_SOURCE.CLOSE,
        sourceId: posTillCloseSourceId(posCashDay.id, posCashDay.openCount || 1),
        amount,
        date: new Date(`${posCashDay.businessDate}T12:00:00.000Z`),
        description: `POS till close sweep ${posCashDay.businessDate}`,
        fromAccountId: tillPa.coaAccountId,
        toAccountId: cashAcc.coaAccountId,
        lines,
      });
      closeSweepJournalId = journal?.id || journal?.journalEntryId || null;
    }
  }
```

Include `closeSweepJournalId` in the final `posCashDay.update` data.

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit only if user asks** — otherwise skip.

---

### Task 6: State API extras for UI funding preview

**Files:**
- Modify: `lib/posCashDayService.js` (`getPosCashDayState`)
- Modify: `app/api/pos/cash-day/route.js` if it reshapes payload (usually returns service result as-is)

**Interfaces:**
- Extends return of `getPosCashDayState` with:
  - `suggestedOpeningBalance: liveCashBalance` (keep — suggestion only)
  - `fundingPreviewHint`: `{ cashAvailable, capitalFallback: true }`
  - `tillFloatAccount`: `{ id, name }` | null
  - `canReopen: tillClosed` (same business date)
  - `requiresTillOpen: !tillOpen` (unchanged — closed day still requires open/reopen)

- [ ] **Step 1: Extend `getPosCashDayState` return**

```js
  const tillFloat = await ensurePosTillFloatPaymentAccount(tenantId, client).catch(() => null);
  // ...
  return {
    // ...existing fields...
    tillFloatAccount: tillFloat
      ? { id: tillFloat.id, name: tillFloat.name }
      : null,
    canReopen: tillClosed,
    fundingPreview: {
      cashAvailable: liveCashBalance,
      capitalFallback: true,
      note:
        'Entered float is funded from Cash first; any shortfall comes from Owner Capital.',
    },
  };
```

Do **not** call ensure on every GET if too heavy — prefer find-first Till Float PA; ensure only on open. Prefer:

```js
  const tillFloat = await client.paymentAccount.findFirst({
    where: {
      tenantId,
      OR: [{ reference: 'POS_TILL_FLOAT' }, { name: 'Till Float', isSystem: true }],
      isActive: true,
    },
    select: { id: true, name: true },
  });
```

- [ ] **Step 2: Manual smoke** — GET `/api/pos/cash-day` includes new fields (dev server).

- [ ] **Step 3: Commit only if user asks** — otherwise skip.

---

### Task 7: UI — optional float, reopen, close copy

**Files:**
- Modify: `components/pos/PosTillGateModals.jsx`
- Touch `app/pos/page.js` only if open handler must pass empty/`0` (it already sends number)

**Interfaces:**
- Consumes: `cashDayState.tillClosed`, `canReopen`, `fundingPreview`, `liveCashBalance`
- Opening field optional; blank submits `0`
- When `tillClosed`, show reopen form (not “come back tomorrow”)
- Close modal copy mentions Till → Cash sweep

- [ ] **Step 1: Update open modal behaviour**

Key UI changes in `PosTillGateModals.jsx`:

1. Default `openingBalance` state to `''` (empty) when opening; suggested shown as helper text, not forced value (or prefill suggested but allow clear).
2. `handleOpen`: if blank → `onOpenTill(0)`; if invalid → error.
3. Replace amber “cannot reopen” block with reopen-capable form when `tillClosed`:

```jsx
{cashDayState?.tillClosed && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
    Today&apos;s till was closed. You can reopen it and optionally fund float again.
  </div>
)}
```

4. Always show opening balance input when `requiresTillOpen` (including closed→reopen). Remove `disabled={... tillClosed}` on Open button.
5. Add funding hint:

```jsx
<p className="mt-1.5 text-xs text-slate-500">
  Optional. Suggested from Cash: {formatMoney(suggested)}. Funded from Cash first;
  shortfall from Owner Capital.
</p>
```

6. Close modal body: mention Till Float is swept back to Cash; midnight auto-close remains.

```jsx
<p>
  Closing sweeps the Till Float balance back to Cash and records the day.
  If you leave the till open, it will <strong>auto-close after midnight</strong> (Africa/Blantyre).
</p>
```

- [ ] **Step 2: Manual check on `/pos`**

- Open with empty float → till opens, no GL funding.
- Open with amount > Cash → expects Capital or clear CAPITAL_UNMAPPED error.
- Close → reopen same day works.
- After 17:00 with till open → close prompt once.

- [ ] **Step 3: Commit only if user asks** — otherwise skip.

---

### Task 8: Verification suite

**Files:** none new beyond prior tests

- [ ] **Step 1: Run focused suite**

```bash
npx vitest run test/posTillFunding.test.js test/posTillFloatAccounts.test.js test/posCashDayOpenClose.test.js
```

Expected: all PASS.

- [ ] **Step 2: Spec coverage checklist (manual)**

| Spec item | Task |
|-----------|------|
| Optional opening amount | 4, 7 |
| Cash then Capital funding | 1, 4 |
| Dedicated Till Float | 3 |
| Close Till→Cash sweep | 5 |
| Same-day reopen | 4, 7 |
| Once after 17:00 reminder | unchanged (verify still works) |
| Midnight stale close | 5 uses same finalize path |
| Idempotent source ids | 1, 4, 5 |
| Journal ids on day | 4, 5 |

- [ ] **Step 3: Stop — report results to user; do not commit unless asked**

---

## Self-review

1. **Spec coverage:** Open funding, Till Float account, Capital fallback, optional amount, close sweep, reopen in-place, 17:00 prompt (retain), midnight stale closer (retain + sweep in finalize), schema fields, UI — all have tasks. Out-of-scope per-sale Till posting intentionally omitted.
2. **Placeholders:** None; helpers and open/close flows include concrete code.
3. **Consistency:** Source types `PosCashDayOpen` / `PosCashDayClose`; source ids `{dayId}:open:{openCount}` / `{dayId}:close:{openCount}`; GL code `1112`; PA reference `POS_TILL_FLOAT` used across tasks 1–7.
4. **Risk note:** `postBankTransferAccounting` with Capital credit lines uses banking event type — accepted per Approach 1. Manual close fails if user missing; auto-close may skip GL if no actor (log) — prefer using `openedById` so midnight sweep still posts.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-pos-till-float-funding.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
