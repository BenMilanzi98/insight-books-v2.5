-- AlterTable
ALTER TABLE "PaymentAccount" ADD COLUMN "coaAccountId" TEXT;

-- CreateIndex
CREATE INDEX "PaymentAccount_coaAccountId_idx" ON "PaymentAccount"("coaAccountId");

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_coaAccountId_fkey" FOREIGN KEY ("coaAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
