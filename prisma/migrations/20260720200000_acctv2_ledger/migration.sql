-- Phase 5 — Journal Entry and General Ledger reimplementation (additive only).
--
-- 1. Reversal linkage + source number columns on JournalEntry.
-- 2. AcctV2LedgerBalance summary projection table (non-authoritative, rebuildable).
-- 3. Database-level immutability protections:
--    a. Posted journal entries can never be hard-deleted.
--    b. Financial columns of posted V2 journals (and their lines) are immutable.
--    Legacy (LEGACY_V1) posted-journal UPDATE protection is intentionally NOT
--    enforced at the database level yet: the live account-merge flow remaps
--    line accountIds on legacy journals. Deferred to Phase 6 with that flow.

-- ── 1. JournalEntry additive columns ─────────────────────────────────────────
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "sourceNumber" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reversalStatus" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "originalJournalId" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reversedByJournalId" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

CREATE INDEX IF NOT EXISTS "JournalEntry_originalJournalId_idx" ON "JournalEntry"("originalJournalId");
CREATE INDEX IF NOT EXISTS "JournalEntry_reversedByJournalId_idx" ON "JournalEntry"("reversedByJournalId");
CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_entryType_idx" ON "JournalEntry"("tenantId", "entryType");

-- ── 2. Ledger summary projection ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AcctV2LedgerBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "projectionVersion" INTEGER NOT NULL,
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2LedgerBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcctV2LedgerBalance_tenantId_projectionVersion_accountId_pe_key"
    ON "AcctV2LedgerBalance"("tenantId", "projectionVersion", "accountId", "periodKey", "currency");
CREATE INDEX IF NOT EXISTS "AcctV2LedgerBalance_tenantId_accountId_idx"
    ON "AcctV2LedgerBalance"("tenantId", "accountId");
CREATE INDEX IF NOT EXISTS "AcctV2LedgerBalance_tenantId_projectionVersion_idx"
    ON "AcctV2LedgerBalance"("tenantId", "projectionVersion");

-- ── 3a. Posted journals can never be hard-deleted ────────────────────────────
CREATE OR REPLACE FUNCTION acctv2_block_posted_journal_delete() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('Posted', 'Reversed', 'PartiallyReversed') THEN
        RAISE EXCEPTION 'ACCTV2_IMMUTABLE: posted journal entries cannot be deleted (id=%)', OLD.id
            USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS je_block_posted_delete ON "JournalEntry";
CREATE TRIGGER je_block_posted_delete
    BEFORE DELETE ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION acctv2_block_posted_journal_delete();

-- ── 3b. Financial columns of posted V2 journals are immutable ────────────────
-- Allowed on a posted V2 journal: notes/metadata annotations, approval echoes,
-- reversal linkage fields, and forward-only status transitions
-- (Posted -> Reversed / PartiallyReversed).
CREATE OR REPLACE FUNCTION acctv2_block_posted_v2_journal_update() RETURNS trigger AS $$
BEGIN
    IF OLD."architectureVersion" = 'ACCOUNTING_V2'
       AND OLD.status IN ('Posted', 'Reversed', 'PartiallyReversed') THEN
        IF NEW."journalNumber"       IS DISTINCT FROM OLD."journalNumber"
        OR NEW."totalDebit"          IS DISTINCT FROM OLD."totalDebit"
        OR NEW."totalCredit"         IS DISTINCT FROM OLD."totalCredit"
        OR NEW."currency"            IS DISTINCT FROM OLD."currency"
        OR NEW."exchangeRate"        IS DISTINCT FROM OLD."exchangeRate"
        OR NEW."baseCurrency"        IS DISTINCT FROM OLD."baseCurrency"
        OR NEW."postingDate"         IS DISTINCT FROM OLD."postingDate"
        OR NEW."entryDate"           IS DISTINCT FROM OLD."entryDate"
        OR NEW."accountingPeriodId"  IS DISTINCT FROM OLD."accountingPeriodId"
        OR NEW."sourceType"          IS DISTINCT FROM OLD."sourceType"
        OR NEW."sourceId"            IS DISTINCT FROM OLD."sourceId"
        OR NEW."accountingEventId"   IS DISTINCT FROM OLD."accountingEventId"
        OR NEW."templateId"          IS DISTINCT FROM OLD."templateId"
        OR NEW."templateVersion"     IS DISTINCT FROM OLD."templateVersion"
        OR NEW."architectureVersion" IS DISTINCT FROM OLD."architectureVersion"
        OR NEW."tenantId"            IS DISTINCT FROM OLD."tenantId"
        OR NEW."entryType"           IS DISTINCT FROM OLD."entryType"
        THEN
            RAISE EXCEPTION 'ACCTV2_IMMUTABLE: financial fields of posted V2 journal % are immutable', OLD.id
                USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status NOT IN ('Posted', 'Reversed', 'PartiallyReversed') THEN
            RAISE EXCEPTION 'ACCTV2_IMMUTABLE: posted V2 journal % status cannot regress to %', OLD.id, NEW.status
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS je_v2_block_posted_update ON "JournalEntry";
CREATE TRIGGER je_v2_block_posted_update
    BEFORE UPDATE ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION acctv2_block_posted_v2_journal_update();

-- ── 3c. Lines of posted V2 journals are immutable ────────────────────────────
CREATE OR REPLACE FUNCTION acctv2_block_posted_v2_line_change() RETURNS trigger AS $$
DECLARE
    parent RECORD;
BEGIN
    SELECT status, "architectureVersion" INTO parent
    FROM "JournalEntry"
    WHERE id = COALESCE(OLD."journalEntryId", NEW."journalEntryId");

    IF parent."architectureVersion" = 'ACCOUNTING_V2'
       AND parent.status IN ('Posted', 'Reversed', 'PartiallyReversed') THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'ACCTV2_IMMUTABLE: lines of posted V2 journal % cannot be deleted', OLD."journalEntryId"
                USING ERRCODE = 'P0001';
        END IF;
        IF NEW."accountId"    IS DISTINCT FROM OLD."accountId"
        OR NEW."debitAmount"  IS DISTINCT FROM OLD."debitAmount"
        OR NEW."creditAmount" IS DISTINCT FROM OLD."creditAmount"
        OR NEW."baseDebit"    IS DISTINCT FROM OLD."baseDebit"
        OR NEW."baseCredit"   IS DISTINCT FROM OLD."baseCredit"
        OR NEW."currency"     IS DISTINCT FROM OLD."currency"
        OR NEW."lineNumber"   IS DISTINCT FROM OLD."lineNumber"
        THEN
            RAISE EXCEPTION 'ACCTV2_IMMUTABLE: financial fields of posted V2 journal line % are immutable', OLD.id
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jel_v2_block_posted_change ON "JournalEntryLine";
CREATE TRIGGER jel_v2_block_posted_change
    BEFORE UPDATE OR DELETE ON "JournalEntryLine"
    FOR EACH ROW EXECUTE FUNCTION acctv2_block_posted_v2_line_change();
