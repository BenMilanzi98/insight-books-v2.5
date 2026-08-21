-- Guided bank recon: requireSeparateApprover is opt-in (product default false).
-- Existing configs are flipped to false when a guided recon is opened (createReconciliation).
ALTER TABLE "BankRecConfiguration" ALTER COLUMN "requireSeparateApprover" SET DEFAULT false;
