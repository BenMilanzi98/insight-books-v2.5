# Task 1 Report: next.config tracing + optimizePackageImports

**Date:** 2026-08-11  
**Scope:** Phase 1 low-RAM CI/release — `next.config.mjs` only  
**Status:** Complete

---

## Summary

Updated `outputFileTracingExcludes` with additional directory and artifact globs, and added `experimental.optimizePackageImports` for `lucide-react` and `recharts`. Standalone output was not enabled. No workflow files were modified.

---

## Changes Made

**File:** `next.config.mjs`

### `outputFileTracingExcludes`

Added excludes for:

| Path | Purpose |
|------|---------|
| `./insight/**/*` | Legacy/duplicate app tree |
| `./android-app-center/**/*` | Android tooling |
| `./insight_books_android/**/*` | Android project |
| `./starter-for-nextjs/**/*` | Starter template |
| `./test/**/*` | Test directory |
| `./tests/**/*` | Tests directory |
| `./artifacts/**/*` | Build/CI artifacts |
| `./backups/**/*` | Backup files |

Existing excludes retained: `uploads`, `tmp`, `.cursor`, `docs`, `storage`, `@swc/core`, squoosh, and `*.docx` / `*.pdf` / `*.xlsx`.

### `experimental`

Added:

```js
optimizePackageImports: ['lucide-react', 'recharts'],
```

Existing keys unchanged: `webpackMemoryOptimizations: true`, `cpus: 1`.

### Unchanged (per brief)

- `turbopack`, `compiler`, standalone conditional spread (`NEXT_STANDALONE=1`)
- `webpack`, `images`, `headers`, `serverExternalPackages`, `generateBuildId`, `redirects`
- `transpilePackages`, `productionBrowserSourceMaps`

---

## Verification

### Syntax check

```bash
node --check next.config.mjs
```

**Result:** Exit code 0, no output.

---

## Commits

None (per task instructions).

---

## Concerns / Notes

1. **Tracing excludes** — New globs assume those directories exist at repo root during build; harmless if absent (no-op).
2. **`optimizePackageImports`** — Requires Next.js support for listed packages; standard for `lucide-react` and `recharts` in recent Next versions.
3. **Standalone** — Still opt-in via `NEXT_STANDALONE=1` only; not enabled in this task.
4. **Full build** — Not run in this task; recommend `npm run build` on CI or locally to validate tracing and import optimization under real load.

---

## Next Steps (out of scope for Task 1)

- Workflow/RAM tuning (later tasks)
- Production build smoke test after merge
