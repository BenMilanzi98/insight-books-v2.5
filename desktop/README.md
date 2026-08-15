# Insight Books Desktop (Electron)

## Build commands

**You must run `npm run build:standalone` at the repo root before `npm run dist`.** The installer bundles `.next/standalone` as the local Next server and `lib/desktop` for SQLite/sync in the Electron main process.

From the repo root:

```bash
npm run build:standalone
cd desktop
npm install
npm run dist
```

Output: `desktop/dist/InsightBooks-desktop-setup.exe`

Copy the installer to `public/downloads/InsightBooks-desktop-setup.exe` for the download page.

### Native module (better-sqlite3)

The main process uses `better-sqlite3` from the repo root `node_modules`. Before shipping a Windows installer, rebuild it for the Electron ABI (match the `electron` version in `desktop/package.json`), for example:

```bash
cd desktop
npx electron-rebuild -f -w better-sqlite3 -m ..
```

If sync or setup fails with a native module error in a packaged build, rerun the rebuild step after `npm install` in both the repo root and `desktop/`.

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
