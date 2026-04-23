-- Optional grace: minutes-from-publish, or fixed grace end datetime

ALTER TABLE "MobileAppConfig" ADD COLUMN IF NOT EXISTS "gracePeriodMinutes" INTEGER;
ALTER TABLE "MobileAppConfig" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);
