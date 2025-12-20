-- CreateTable
CREATE TABLE "AccountSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "txRef" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountSubscription_txRef_key" ON "AccountSubscription"("txRef");

-- CreateIndex
CREATE INDEX "AccountSubscription_tenantId_idx" ON "AccountSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "AccountSubscription_status_idx" ON "AccountSubscription"("status");

-- CreateIndex
CREATE INDEX "AccountSubscription_isActive_idx" ON "AccountSubscription"("isActive");

-- CreateIndex
CREATE INDEX "AccountSubscription_expiresAt_idx" ON "AccountSubscription"("expiresAt");

-- AddForeignKey
ALTER TABLE "AccountSubscription" ADD CONSTRAINT "AccountSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
