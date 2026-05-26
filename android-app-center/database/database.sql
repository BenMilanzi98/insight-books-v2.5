-- InsightBooks Android App Management Center
-- MySQL 8.0+ / MariaDB 10.4+
-- cPanel/phpMyAdmin import:
-- 1. Create the database in cPanel first.
-- 2. Open that database in phpMyAdmin.
-- 3. Import this file while the target database is selected.
-- Do not run CREATE DATABASE on cPanel shared hosting; the cPanel user
-- usually does not have that privilege and the database name is account-prefixed.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS api_sync_logs;
DROP TABLE IF EXISTS download_logs;
DROP TABLE IF EXISTS app_reviews;
DROP TABLE IF EXISTS apk_screenshots;
DROP TABLE IF EXISTS revoked_access;
DROP TABLE IF EXISTS app_locks;
DROP TABLE IF EXISTS apk_versions;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS admins;

CREATE TABLE admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE app_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  app_title VARCHAR(160) NOT NULL DEFAULT 'InsightBooks',
  app_tagline VARCHAR(255) NULL,
  short_description VARCHAR(500) NULL,
  full_description TEXT NULL,
  developer_name VARCHAR(160) NULL,
  support_email VARCHAR(190) NULL,
  privacy_url VARCHAR(500) NULL,
  terms_url VARCHAR(500) NULL,
  logo_path VARCHAR(255) NULL,
  min_android_version VARCHAR(32) NULL DEFAULT '8.0',
  install_instructions TEXT NULL,
  feature_list JSON NULL,
  global_app_lock TINYINT(1) NOT NULL DEFAULT 0,
  maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
  security_lock TINYINT(1) NOT NULL DEFAULT 0,
  global_lock_message TEXT NULL,
  maintenance_message TEXT NULL,
  update_prompt_message TEXT NULL,
  emergency_notice TEXT NULL,
  website_download_locked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE apk_versions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version_name VARCHAR(32) NOT NULL,
  version_code INT UNSIGNED NOT NULL,
  release_notes TEXT NULL,
  whats_new TEXT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  min_android_version VARCHAR(32) NULL,
  status ENUM('draft','active','deprecated') NOT NULL DEFAULT 'draft',
  is_latest TINYINT(1) NOT NULL DEFAULT 0,
  mandatory_update TINYINT(1) NOT NULL DEFAULT 0,
  optional_update TINYINT(1) NOT NULL DEFAULT 1,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  lock_message TEXT NULL,
  download_count INT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by INT UNSIGNED NULL,
  release_date DATETIME NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_version_code (version_code),
  KEY idx_status_latest (status, is_latest),
  KEY idx_version_name (version_name),
  CONSTRAINT fk_apk_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE apk_screenshots (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  caption VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sort (sort_order, is_active)
) ENGINE=InnoDB;

CREATE TABLE app_reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reviewer_name VARCHAR(120) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  device_model VARCHAR(120) NULL,
  app_version_used VARCHAR(32) NULL,
  ip_address VARCHAR(45) NULL,
  status ENUM('pending','approved','hidden','deleted') NOT NULL DEFAULT 'pending',
  admin_reply TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status_created (status, created_at),
  KEY idx_rating (rating)
) ENGINE=InnoDB;

CREATE TABLE download_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  apk_version_id INT UNSIGNED NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  device_type VARCHAR(64) NULL,
  browser VARCHAR(64) NULL,
  referrer VARCHAR(500) NULL,
  country VARCHAR(64) NULL,
  success TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_apk_created (apk_version_id, created_at),
  KEY idx_created (created_at),
  CONSTRAINT fk_download_apk FOREIGN KEY (apk_version_id) REFERENCES apk_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE app_locks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lock_type ENUM('global','version','security','maintenance') NOT NULL,
  apk_version_id INT UNSIGNED NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  message TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lock_type (lock_type, is_enabled),
  CONSTRAINT fk_lock_version FOREIGN KEY (apk_version_id) REFERENCES apk_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lock_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE revoked_access (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  revoke_type ENUM('user_id','email','phone','device_id','business_id','tenant_id') NOT NULL,
  identifier VARCHAR(190) NOT NULL,
  reason TEXT NULL,
  expires_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  revoked_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_revoke (revoke_type, identifier),
  KEY idx_active (is_active, expires_at),
  CONSTRAINT fk_revoked_by FOREIGN KEY (revoked_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE api_sync_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  direction ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  endpoint VARCHAR(500) NOT NULL,
  payload JSON NULL,
  response_code INT NULL,
  response_body TEXT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_created (created_at),
  KEY idx_success (success, created_at)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  resource VARCHAR(190) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_created (admin_id, created_at),
  KEY idx_action (action, created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE login_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  email VARCHAR(190) NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_created (created_at),
  CONSTRAINT fk_login_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  limit_key VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  window_start DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_limit_ip (limit_key, ip_address, window_start)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
