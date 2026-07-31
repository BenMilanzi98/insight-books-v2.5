-- CreateTable
CREATE TABLE "InvoiceItemTax" (
    "id" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "taxTypeId" TEXT NOT NULL,
    "taxName" TEXT NOT NULL,
    "taxCode" TEXT NOT NULL DEFAULT '',
    "taxRate" DOUBLE PRECISION NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'Percentage',
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItemTax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItemTax" (
    "id" TEXT NOT NULL,
    "quotationItemId" TEXT NOT NULL,
    "taxTypeId" TEXT NOT NULL,
    "taxName" TEXT NOT NULL,
    "taxCode" TEXT NOT NULL DEFAULT '',
    "taxRate" DOUBLE PRECISION NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'Percentage',
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationItemTax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItemTax_invoiceItemId_idx" ON "InvoiceItemTax"("invoiceItemId");

-- CreateIndex
CREATE INDEX "InvoiceItemTax_taxTypeId_idx" ON "InvoiceItemTax"("taxTypeId");

-- CreateIndex
CREATE INDEX "QuotationItemTax_quotationItemId_idx" ON "QuotationItemTax"("quotationItemId");

-- CreateIndex
CREATE INDEX "QuotationItemTax_taxTypeId_idx" ON "QuotationItemTax"("taxTypeId");

-- AddForeignKey
ALTER TABLE "InvoiceItemTax" ADD CONSTRAINT "InvoiceItemTax_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemTax" ADD CONSTRAINT "InvoiceItemTax_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItemTax" ADD CONSTRAINT "QuotationItemTax_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "QuotationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItemTax" ADD CONSTRAINT "QuotationItemTax_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
