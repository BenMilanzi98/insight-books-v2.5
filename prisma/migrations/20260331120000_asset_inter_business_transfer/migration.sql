-- Asset transfers between businesses (tenants) with immutable audit rows.

CREATE TABLE "AssetInterBusinessTransfer" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromTenantId" TEXT NOT NULL,
    "toTenantId" TEXT NOT NULL,
    "fromTenantName" TEXT NOT NULL,
    "toTenantName" TEXT NOT NULL,
    "fromCategoryId" TEXT NOT NULL,
    "toCategoryId" TEXT NOT NULL,
    "fromCategoryName" TEXT NOT NULL,
    "toCategoryName" TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "snapshotJson" TEXT NOT NULL,

    CONSTRAINT "AssetInterBusinessTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetInterBusinessTransfer_assetId_idx" ON "AssetInterBusinessTransfer"("assetId");
CREATE INDEX "AssetInterBusinessTransfer_fromTenantId_idx" ON "AssetInterBusinessTransfer"("fromTenantId");
CREATE INDEX "AssetInterBusinessTransfer_toTenantId_idx" ON "AssetInterBusinessTransfer"("toTenantId");
CREATE INDEX "AssetInterBusinessTransfer_transferredAt_idx" ON "AssetInterBusinessTransfer"("transferredAt");

ALTER TABLE "AssetInterBusinessTransfer" ADD CONSTRAINT "AssetInterBusinessTransfer_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInterBusinessTransfer" ADD CONSTRAINT "AssetInterBusinessTransfer_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInterBusinessTransfer" ADD CONSTRAINT "AssetInterBusinessTransfer_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInterBusinessTransfer" ADD CONSTRAINT "AssetInterBusinessTransfer_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
