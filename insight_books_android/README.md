# InsightBooks Android

Flutter Android client for InsightBooks.

## App Center Update Checks

The app is aligned with the standalone PHP Android App Management Center.
Update enforcement is handled by `lib/core/update/app_update_provider.dart`,
which calls:

```text
{APP_CENTER_BASE_URL}/api/check-update.php
```

Build release APKs with both the main API URL and the App Center URL:

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://insightbooksafrica.com \
  --dart-define=APP_CENTER_BASE_URL=https://app.insightinnovationsltd.com
```

The update gate understands these App Center states:

- `ok` — continue normally
- `optional_update` — show update banner
- `update_required` — lock outdated builds and show download prompt
- `locked` — block access immediately
- `maintenance` — show maintenance message
- `revoked` — block the specific user/device/business identifier

The app sends `version_code`, `version_name`, `device_id`, `platform`, and
legacy aliases to the PHP endpoint. The App Center response supplies the latest
version, lock reason, maintenance message, and APK download URL.
