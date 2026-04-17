-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "serviceBillingType" TEXT,
ADD COLUMN     "serviceDefaultQty" DECIMAL(12,4),
ADD COLUMN     "incomeAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
