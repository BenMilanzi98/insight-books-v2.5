-- Phase 4: PlanningForecastAiSuggestion (review-only AI / heuristic suggestions)
CREATE TABLE IF NOT EXISTS "PlanningForecastAiSuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "forecastId" TEXT,
    "category" TEXT NOT NULL,
    "suggestionKey" TEXT NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "reason" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "sourceDataRange" JSONB,
    "modelProvider" TEXT DEFAULT 'DETERMINISTIC_HEURISTIC_V1',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningForecastAiSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlanningForecastAiSuggestion_tenantId_status_idx"
  ON "PlanningForecastAiSuggestion"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PlanningForecastAiSuggestion_forecastId_idx"
  ON "PlanningForecastAiSuggestion"("forecastId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecastAiSuggestion_tenantId_fkey') THEN
    ALTER TABLE "PlanningForecastAiSuggestion" ADD CONSTRAINT "PlanningForecastAiSuggestion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecastAiSuggestion_forecastId_fkey') THEN
    ALTER TABLE "PlanningForecastAiSuggestion" ADD CONSTRAINT "PlanningForecastAiSuggestion_forecastId_fkey"
      FOREIGN KEY ("forecastId") REFERENCES "PlanningForecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecastAiSuggestion_reviewedById_fkey') THEN
    ALTER TABLE "PlanningForecastAiSuggestion" ADD CONSTRAINT "PlanningForecastAiSuggestion_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
