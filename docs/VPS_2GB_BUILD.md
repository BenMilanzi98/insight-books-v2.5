# Deploying Insight Books on a 2 GB RAM VPS

This app’s production `next build` typically needs **3–6+ GB peak RAM**. A **2 GB VPS cannot reliably compile** the app unless you add swap — and even then it is slow and fragile.

## Recommended path (build elsewhere, run on VPS)

Build on GitHub Actions, ship a release tarball, apply it on the VPS **without** running `next build`.

### 1. Tag a release (from your laptop / CI)

```bash
git tag v2.5.x
git push origin v2.5.x
```

That triggers `.github/workflows/release.yml`, which uploads `insight-books-v2.5.x.tar.gz`.

### 2. One-time VPS prep

```bash
sudo apt update && sudo apt install -y curl nodejs npm
# Node 20+: use nodesource or nvm if your distro is older

cd /var/www/insight-books   # or your app dir
# clone once, keep .env + uploads here
```

Optional but strongly recommended if you ever build on the box:

```bash
sudo ./scripts/vps-ensure-swap.sh 2
```

### 3. Apply a release (no compile)

```bash
export GITHUB_REPO=your-org/insight-books-v2.5
export RELEASE_TAG=v2.5.x
export PM2_APP=insight-books   # or SYSTEMD_UNIT=insight-books.service

chmod +x scripts/vps-apply-release.sh
./scripts/vps-apply-release.sh
```

Runtime start (if not using PM2 in the script):

```bash
npm run start:vps
# or: pm2 start npm --name insight-books -- run start:vps
```

`start:vps` caps the Node heap at **512 MB** so Postgres + Node can share 2 GB.

---

## Last resort: build on the 2 GB VPS

Only if CI/release is unavailable.

```bash
sudo ./scripts/vps-ensure-swap.sh 2   # required
pm2 stop all || true                  # free RAM
npm ci
npm run build:vps-2gb                 # 1280 MB heap, webpack serialised
npm run start:vps
```

Config already tuned for this path in `next.config.mjs`:

- `experimental.cpus: 1`
- `webpackMemoryOptimizations`
- webpack `parallelism: 1`, cache off
- no `standalone` unless `NEXT_STANDALONE=1`
- heavy trees excluded from file tracing

`build:vps` uses `NODE_OPTIONS=--max-old-space-size=1280` (not 6–8 GB).

If the OOM killer still wins: add **4 GB swap**, or upgrade to **4 GB RAM**, or stick to the release-apply path.

---

## Docker on 2 GB

Do **not** run `docker compose build` on the 2 GB box if you can avoid it (build stage + Node heap + Docker layer cache will thrash).

Preferred:

1. Build the image on a larger machine / CI
2. `docker push` / load the image on the VPS
3. `docker compose -f docker-compose.prod.yml up -d` **without** `--build`

The `Dockerfile` uses the same low-heap build and `next start` (not standalone).

---

## Quick checklist

| Item | 2 GB VPS |
|------|----------|
| Run `next build` on VPS | Avoid; use release tarball |
| Swap | 2 GB minimum if building on-box |
| Runtime Node heap | `npm run start:vps` (512 MB) |
| Standalone output | Off by default (too heavy at build) |
| Postgres on same box | OK at runtime if Node heap is capped |
