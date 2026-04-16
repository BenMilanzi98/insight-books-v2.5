-- System-wide chart definition (admin); per-tenant Account.logical merge pointer.

CREATE TABLE "system_coa_definition" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "system_coa_definition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Account" ADD COLUMN "mergedIntoAccountId" TEXT;

CREATE INDEX "Account_mergedIntoAccountId_idx" ON "Account"("mergedIntoAccountId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_mergedIntoAccountId_fkey" FOREIGN KEY ("mergedIntoAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
