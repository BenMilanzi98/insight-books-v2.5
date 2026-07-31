# Asset Integration Audit

## Finding

`RentalAsset` is a **standalone catalogue** with no FK to Fixed Asset / Asset Register (`/assets-liabilities`).

Dispatch does not exist → no custody tracking against Asset Register. Depreciation is unaffected (good), but utilisation, maintenance blocks, disposed-asset blocking, and serial uniqueness vs Asset are missing.

**Disposition:** `DISCONNECTED` → `EXTEND` with optional `assetId` on RentalUnit; maintenance/disposal must set units unavailable; rental billing must never post depreciation.
