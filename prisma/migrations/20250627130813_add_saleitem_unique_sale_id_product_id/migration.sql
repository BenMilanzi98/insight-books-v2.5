/*
  Warnings:

  - A unique constraint covering the columns `[saleId,productId]` on the table `SaleItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_saleId_productId_key" ON "SaleItem"("saleId", "productId");
