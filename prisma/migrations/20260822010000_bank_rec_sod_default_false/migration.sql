-- Guided bank recon: requireSeparateApprover is opt-in (product default false).
-- Flip leftover true rows so existing tenants match the product default.
ALTER TABLE "BankRecConfiguration" ALTER COLUMN "requireSeparateApprover" SET DEFAULT false;
UPDATE "BankRecConfiguration" SET "requireSeparateApprover" = false WHERE "requireSeparateApprover" = true;
