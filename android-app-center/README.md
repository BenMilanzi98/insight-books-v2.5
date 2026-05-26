# InsightBooks Android App Management Center

Standalone PHP 8.1+ / MySQL application for managing InsightBooks Android APK distribution, version enforcement, locks, reviews, and analytics. Designed for **cPanel** hosting.

## Features

- Public Play Store–style download page with glassmorphism UI
- Secure admin dashboard (APK upload, versions, screenshots, settings, locks, revoked access, reviews, analytics, audit/sync logs)
- Mobile update check API (`/api/check-update.php`)
- Signed sync to main InsightBooks Next.js app (`/api/mobile-app/external-sync`)
- Download tracking, ratings/comments with moderation, rate limiting, CSRF, prepared statements

## Requirements

- PHP 8.1+ with extensions: `pdo_mysql`, `curl`, `fileinfo`, `json`, `mbstring`
- MySQL 8.0+ or MariaDB 10.4+
- Apache with `mod_rewrite` (or nginx equivalent)
- HTTPS in production

## cPanel Installation

1. **Upload** the entire `android-app-center` folder to your subdomain document root (e.g. `public_html/apps`).

2. **Create MySQL database** in cPanel, then open that database in phpMyAdmin and import:
   - `database/database.sql`
   - `database/seed.sql`

   Do not run `CREATE DATABASE` manually on shared cPanel hosting. cPanel creates
   account-prefixed names such as `cpses_ins8xafc57` or
   `yourcpaneluser_insightbooks_apk_center`; use the exact database name shown
   in cPanel as `DB_DATABASE`.

3. **Configure** copy `.env.example` values into cPanel **Environment Variables**, or create `.env` with your real cPanel database credentials:

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_DATABASE=yourcpaneluser_insightbooks_apk_center
   DB_USERNAME=yourcpaneluser_dbuser
   DB_PASSWORD=your-cpanel-db-password
   ```

   The bundled APK `public/uploads/apks/insightbooks-v1.0.0.9.apk` is seeded
   as the first active public release. If your database was imported before this
   APK was bundled, import `database/release-v1.0.0.9.sql` into the selected
   database to publish it.

4. **Set document root** to the project folder, or ensure `.htaccess` routes `public/`, `admin/`, and `api/`.

5. **Permissions** (writable):
   - `public/uploads/apks/`
   - `public/uploads/screenshots/`
   - `public/uploads/logos/`
   - `storage/logs/`

6. **Default admin login** (change immediately):
   - Email: `admin@insightbooksafrica.com`
   - Password: `ChangeMe123!`

## Main InsightBooks Integration

On the **Next.js** app (`.env`):

```env
MOBILE_APP_CENTER_API_KEY=your-shared-api-key
MOBILE_APP_CENTER_SHARED_SECRET=your-shared-hmac-secret
NEXT_PUBLIC_APK_CENTER_ADMIN_URL=https://app.insightinnovationsltd.com/admin/dashboard.php
```

On the **PHP center** (`config/app.php` or env):

```env
MAIN_SYSTEM_SYNC_URL=https://your-domain.com/api/mobile-app/external-sync
MAIN_SYSTEM_API_KEY=your-shared-api-key
MAIN_SYSTEM_SHARED_SECRET=your-shared-hmac-secret
```

When you publish an APK or change locks, the PHP center POSTs a signed payload. The Next app updates `MobileAppConfig` so existing Android clients using `/api/mobile-app/version` stay in sync.

`/insightbooks/mobile-app` in the main app redirects to the PHP admin URL.

## Android App Update Check

**Endpoint:** `GET` or `POST` `{APP_URL}/api/check-update.php`

**Parameters (GET or JSON body):**

| Field | Description |
|-------|-------------|
| `version_code` | Installed build number |
| `version_name` | Installed version name (optional) |
| `user_id` | Optional |
| `device_id` | Optional |
| `business_id` / `tenant_id` | Optional |
| `email`, `phone` | Optional (revocation checks) |

**Example response:**

```json
{
  "success": true,
  "status": "update_required",
  "latest_version_name": "1.0.5",
  "latest_version_code": 105,
  "current_version_allowed": false,
  "mandatory_update": true,
  "app_locked": true,
  "lock_reason": "A new version is available. Please update to continue.",
  "download_url": "https://app.insightinnovationsltd.com/download.php?id=1",
  "release_notes": "...",
  "maintenance_mode": false
}
```

**Status values:** `ok`, `optional_update`, `update_required`, `locked`, `maintenance`, `revoked`

Point the Flutter app `version` API base URL to this PHP endpoint for new installs; legacy clients can continue using Next until migrated.

## Public URLs

| URL | Purpose |
|-----|---------|
| `/` | Download landing page |
| `/download.php` | APK file download |
| `/admin/login.php` | Admin login |
| `/api/check-update.php` | Update enforcement API |
| `/api/latest-version.php` | Latest version metadata |

## Security Notes

- Change default admin password and API secrets before production.
- Use HTTPS only.
- Keep `config/`, `database/`, `storage/`, `app/`, `includes/` blocked via `.htaccess`.
- APK uploads validate extension, MIME, and ZIP signature.
- Reviews use a honeypot field, IP rate limits, validation, and admin approval.
- All admin forms use CSRF tokens.

## Testing Checklist

- [ ] Admin login / logout
- [ ] Upload valid APK; reject non-APK
- [ ] Reject duplicate version codes
- [ ] Activate version; public page shows latest
- [ ] Download increments analytics
- [ ] Mandatory update locks old clients via API
- [ ] Global / maintenance / security locks
- [ ] Version-specific lock
- [ ] Revoke by device_id / email; restore
- [ ] Submit review; approve in admin
- [ ] Sync to main system (check sync logs)
- [ ] `/insightbooks/mobile-app` redirects to PHP admin
- [ ] Mobile responsive UI
- [ ] No PHP warnings on public pages

## Folder Structure

```
android-app-center/
  app/Helpers, app/Services
  admin/          Admin UI
  api/            Public APIs
  config/         App & DB config
  database/       SQL install scripts
  includes/       Auth, CSRF, layouts
  public/         Public site & uploads
  storage/logs/   Error logs
```
