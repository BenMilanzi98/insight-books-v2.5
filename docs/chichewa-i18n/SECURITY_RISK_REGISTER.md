# Security Risk Register

| ID | Risk | Mitigation |
|----|------|------------|
| SR-01 | Invalid locale injection | Allowlist en/ny only |
| SR-02 | Cross-user preference write | Own-user API only |
| SR-03 | Interpolation XSS | Escape untrusted params |
| SR-04 | Cache locale leakage | Locale in cache keys when caching translated content |
