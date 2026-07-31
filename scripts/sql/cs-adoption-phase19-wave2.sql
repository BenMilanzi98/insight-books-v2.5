-- Phase 19 Wave 2 — Milestones, evidence snapshots, value outcomes (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Gate fail / missing analytics → UNKNOWN + UNAVAILABLE (never invent MET).
-- Plan COMPLETED requires critical milestones MET|WAIVED + value review sign-off.

CREATE TABLE IF NOT EXISTS "CustomerAdoptionMilestone" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "planTemplateVersionId" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "roleTarget" TEXT,
  "evidenceMode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "critical" BOOLEAN NOT NULL DEFAULT FALSE,
  "dueAt" TIMESTAMP(3),
  "definitionJson" JSONB,
  "attestedByAdminId" TEXT,
  "attestedAt" TIMESTAMP(3),
  "attestationReason" TEXT,
  "waivedByAdminId" TEXT,
  "waivedAt" TIMESTAMP(3),
  "waiverReason" TEXT,
  "evidenceSnapshotId" TEXT,
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionMilestone_planId_templateKey_key"
  ON "CustomerAdoptionMilestone"("planId", "templateKey");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionMilestone_planId_status_idx"
  ON "CustomerAdoptionMilestone"("planId", "status");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionMilestone_planTemplateVersionId_idx"
  ON "CustomerAdoptionMilestone"("planTemplateVersionId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionMilestone_evidenceMode_idx"
  ON "CustomerAdoptionMilestone"("evidenceMode");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionMilestone_critical_status_idx"
  ON "CustomerAdoptionMilestone"("critical", "status");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionEvidenceSnapshot" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "evidenceMode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "sourceSystem" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshotJson" JSONB,
  "reasonCode" TEXT,
  "reasonMessage" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionEvidenceSnapshot_idempotencyKey_key"
  ON "CustomerAdoptionEvidenceSnapshot"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionEvidenceSnapshot_planId_observedAt_idx"
  ON "CustomerAdoptionEvidenceSnapshot"("planId", "observedAt");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionEvidenceSnapshot_milestoneId_idx"
  ON "CustomerAdoptionEvidenceSnapshot"("milestoneId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionEvidenceSnapshot_status_idx"
  ON "CustomerAdoptionEvidenceSnapshot"("status");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionValueOutcome" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "outcomeType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "value" JSONB,
  "sourceSystem" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lineageJson" JSONB,
  "reasonCode" TEXT,
  "reasonMessage" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionValueOutcome_idempotencyKey_key"
  ON "CustomerAdoptionValueOutcome"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionValueOutcome_planId_outcomeType_idx"
  ON "CustomerAdoptionValueOutcome"("planId", "outcomeType");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionValueOutcome_status_idx"
  ON "CustomerAdoptionValueOutcome"("status");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionValueOutcome_observedAt_idx"
  ON "CustomerAdoptionValueOutcome"("observedAt");

-- Refresh default template content with Wave 2 milestone defs (idempotent upsert of JSON).
UPDATE "CustomerAdoptionPlanTemplateVersion"
SET
  "contentJson" = jsonb_build_object(
    'wave', 2,
    'milestonesDeferred', false,
    'valueOutcomesDeferred', false,
    'milestones', jsonb_build_array(
      jsonb_build_object(
        'key', 'first_value_analytics',
        'roleTarget', 'OWNER',
        'evidenceMode', 'PRODUCT_ANALYTICS',
        'critical', true,
        'featureCode', 'books.invoice.create',
        'metricCode', 'product.feature.books.invoice.create.count'
      ),
      jsonb_build_object(
        'key', 'training_cert_complete',
        'roleTarget', 'ADMIN',
        'evidenceMode', 'TRAINING_CERT',
        'critical', true,
        'requireProgramCompleted', true
      ),
      jsonb_build_object(
        'key', 'cs_attestation_champion',
        'roleTarget', 'CHAMPION',
        'evidenceMode', 'CS_ATTESTATION',
        'critical', true
      ),
      jsonb_build_object(
        'key', 'mixed_activation',
        'roleTarget', 'ACCOUNTANT',
        'evidenceMode', 'MIXED',
        'critical', false,
        'requiredModes', jsonb_build_array('PRODUCT_ANALYTICS', 'CS_ATTESTATION'),
        'featureCode', 'books.invoice.create'
      )
    )
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "templateCode" = 'CUSTOMER_ADOPTION_DEFAULT_WAVE1'
  AND "versionNumber" = 1;
