# Validation Message Audit

**Date:** 2026-07-26

Client forms use inline English strings and some zod messages. No shared i18n validation map yet.

**Action:** `locales/*/validation.json` + map zod issues via messageKey (Wave 1+).

**Priority messages:** required, invalid email, amount > 0, period closed, permission denied, passwords mismatch.
