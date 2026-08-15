# Insight Books Desktop (Electron)

## Build commands

From the repo root:

```bash
npm run build:standalone
cd desktop
npm install
npm run dist
```

Output: `desktop/dist/InsightBooks-desktop-setup.exe`

Copy the installer to `public/downloads/InsightBooks-desktop-setup.exe` for the download page.

## Development

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Electron shell
npm run desktop:dev
```

Environment variables:

- `DESKTOP_CLOUD_URL` — cloud origin for login/setup (default: production)
- `DESKTOP_STANDALONE_PATH` — path to `.next/standalone` when testing bound mode locally
