-- Default admin: admin@insightbooksafrica.com / ChangeMe123!
INSERT INTO admins (name, email, password_hash, role, is_active, created_at, updated_at) VALUES
('System Administrator', 'admin@insightbooksafrica.com',
 '$2y$10$HFXTFv8kJscTVgFlL3fO3uJdmbLY8tqv/PaV48vMb13AWwmyu3Y5.',
 'super_admin', 1, NOW(), NOW());

INSERT INTO app_settings (
  id, app_title, app_tagline, short_description, full_description, developer_name,
  support_email, privacy_url, terms_url, min_android_version, install_instructions, feature_list
) VALUES (
  1,
  'InsightBooks',
  'Business Management Simplified.',
  'Cloud accounting and business management for African companies.',
  'InsightBooks helps businesses manage accounting, inventory, sales, purchases, payroll, and reporting from one secure platform. Download the official Android app to run your business on the go.',
  'InsightBooks Africa',
  'support@insightbooksafrica.com',
  'https://insightbooksafrica.com/privacy',
  'https://insightbooksafrica.com/terms',
  '8.0',
  '1. Download the APK.\n2. Open the file on your Android device.\n3. Allow installation from this source if prompted.\n4. Open InsightBooks and sign in.',
  JSON_ARRAY(
    'Accounting & bookkeeping',
    'Inventory & stock control',
    'Sales & invoicing',
    'Purchases & expenses',
    'Payroll & HR tools',
    'Reports & analytics',
    'Multi-business support',
    'Secure cloud sync'
  )
);

-- Bundled public release.
-- Upload/copy the APK file to: public/uploads/apks/insightbooks-v1.0.1.1.apk
-- The app will resolve downloads from file_name at runtime, so this works after
-- deployment even though cPanel paths differ from local Windows paths.
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
  '1.0.1.1',
  11,
  'InsightBooks Android release v1.0.1.1 with strengthened App Center lock and update enforcement.',
  'Automatic lock for outdated builds, faster live admin lock polling, and improved update gate.',
  'insightbooks-v1.0.1.1.apk',
  'public/uploads/apks/insightbooks-v1.0.1.1.apk',
  80259171,
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
);
