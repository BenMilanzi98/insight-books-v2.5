-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "faviconUrl" TEXT,
ADD COLUMN     "secondaryColor" TEXT;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "dailyReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailFooter" TEXT,
ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "invoiceReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monthlyReports" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymentReceipts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyReports" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "InvoiceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceTemplate_tenantId_idx" ON "InvoiceTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceTemplate_tenantId_name_key" ON "InvoiceTemplate"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
