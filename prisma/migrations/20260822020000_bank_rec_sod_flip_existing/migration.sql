-- Follow-up for databases that already applied 20260822010000 (default-only).
-- Idempotent: only remaining true rows are flipped.
UPDATE "BankRecConfiguration" SET "requireSeparateApprover" = false WHERE "requireSeparateApprover" = true;
