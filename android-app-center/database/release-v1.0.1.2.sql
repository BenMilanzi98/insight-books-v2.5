-- InsightBooks Android release v1.0.1.2
-- Import this into the already-selected App Center database after copying
-- the APK to public/uploads/apks/insightbooks-v1.0.1.2.apk.

SET NAMES utf8mb4;

START TRANSACTION;

UPDATE apk_versions SET is_latest = 0;

INSERT INTO apk_versions (
  version_name,
  version_code,
  release_notes,
  whats_new,
  file_name,
  file_path,
  file_size,
  min_android_version,
  status,
  is_latest,
  mandatory_update,
  optional_update,
  is_locked,
  uploaded_by,
  release_date,
  published_at,
  created_at,
  updated_at
) VALUES (
  '1.0.1.2',
  12,
  'InsightBooks Android release v1.0.1.2 with improved financial amount accuracy and refreshed POS/reporting fixes.',
  'Improved decimal money handling across sales, invoices, reports, dashboard totals, taxes, stock, and receipts.',
  'insightbooks-v1.0.1.2.apk',
  'public/uploads/apks/insightbooks-v1.0.1.2.apk',
  80341091,
  '8.0',
  'active',
  1,
  1,
  0,
  0,
  1,
  NOW(),
  NOW(),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  version_name = VALUES(version_name),
  release_notes = VALUES(release_notes),
  whats_new = VALUES(whats_new),
  file_name = VALUES(file_name),
  file_path = VALUES(file_path),
  file_size = VALUES(file_size),
  min_android_version = VALUES(min_android_version),
  status = 'active',
  is_latest = 1,
  mandatory_update = 1,
  optional_update = 0,
  is_locked = 0,
  release_date = COALESCE(release_date, NOW()),
  published_at = COALESCE(published_at, NOW()),
  updated_at = NOW();

COMMIT;
