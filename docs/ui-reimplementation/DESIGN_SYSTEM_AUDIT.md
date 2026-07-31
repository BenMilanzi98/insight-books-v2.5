# Design System Audit

**Date:** 2026-07-25

## Finding

**No formal design system.** Tailwind v4 CSS-first (`@import "tailwindcss"`), PostCSS only, no `tailwind.config.js`, no shadcn `components.json`.

## Tokens today

`:root` in `app/globals.css`: `--primary-color`, `--dark-bg*`, `--sidebar-width`, `--background`, `--foreground`.

Gaps: no semantic `--surface-*`, `--text-*`, `--status-*`, `--z-*`, spacing scale, shadow scale.

## Fonts

- Next Geist + Geist Mono on layout — KEEP
- `body { font-family: Arial }` — INCONSISTENT → fix
- HR CSS references Inter (not loaded) — INCONSISTENT

## Icons

- lucide-react — KEEP (standardise)
- @heroicons/react, react-icons — STANDARDISE away

## Theme

Light content + dark sidebar chrome only. No `next-themes`. Classification: KEEP light.
