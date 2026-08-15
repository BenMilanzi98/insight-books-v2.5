### Task 4: Prisma `DesktopDevice` + `DesktopOutboxReceipt`

**Files:**
- Modify: `prisma/schema.prisma` (Tenant relations + two new models)
- Create: `prisma/migrations/20260815120000_desktop_device/migration.sql`

**Interfaces:**
- Produces Prisma models:

```prisma
model DesktopDevice {
  id              String    @id @default(cuid())
  tenantId        String
  deviceId        String
  name            String
  numberPrefix    String
  boundAt         DateTime  @default(now())
  unboundAt       DateTime?
  lastHeartbeatAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  receipts        DesktopOutboxReceipt[]

  @@unique([deviceId])
  @@index([tenantId, unboundAt])
  @@index([tenantId, numberPrefix])
}

model DesktopOutboxReceipt {
  id             String   @id
  tenantId       String
  deviceId       String
  kind           String
  serverEntityId String?
  resultJson     Json
  createdAt      DateTime @default(now())
  device         DesktopDevice @relation(fields: [deviceId], references: [deviceId], onDelete: Cascade)

  @@unique([tenantId, id])
  @@index([tenantId])
}
```

Add `desktopDevices DesktopDevice[]` on `Tenant`.

One-active-device is **application-enforced** (query `unboundAt: null`), not a unique constraint, so a tenant can re-bind after unbind and reuse `TILL1`.

- [ ] **Step 1: Write a schema smoke test**

Create `test/desktop/schemaModels.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('DesktopDevice schema', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  it('declares DesktopDevice and DesktopOutboxReceipt', () => {
    expect(schema).toMatch(/model DesktopDevice/);
    expect(schema).toMatch(/model DesktopOutboxReceipt/);
    expect(schema).toMatch(/desktopDevices\s+DesktopDevice\[\]/);
  });
});
```

- [ ] **Step 2: Run test (fail), then add models + SQL, then pass**

Migration SQL:

```sql
CREATE TABLE "DesktopDevice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "numberPrefix" TEXT NOT NULL,
  "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unboundAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopDevice_deviceId_key" ON "DesktopDevice"("deviceId");
CREATE INDEX "DesktopDevice_tenantId_unboundAt_idx" ON "DesktopDevice"("tenantId", "unboundAt");
CREATE INDEX "DesktopDevice_tenantId_numberPrefix_idx" ON "DesktopDevice"("tenantId", "numberPrefix");
ALTER TABLE "DesktopDevice" ADD CONSTRAINT "DesktopDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DesktopOutboxReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "serverEntityId" TEXT,
  "resultJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesktopOutboxReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopOutboxReceipt_tenantId_id_key" ON "DesktopOutboxReceipt"("tenantId", "id");
CREATE INDEX "DesktopOutboxReceipt_tenantId_idx" ON "DesktopOutboxReceipt"("tenantId");
ALTER TABLE "DesktopOutboxReceipt" ADD CONSTRAINT "DesktopOutboxReceipt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`

Expected: client includes `desktopDevice` / `desktopOutboxReceipt`.

- [ ] **Step 4: Commit** (skip unless asked)

---

