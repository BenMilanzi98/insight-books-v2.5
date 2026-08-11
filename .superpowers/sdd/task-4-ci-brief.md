### Task 4: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: same build path as Task 3
- Produces: GitHub Release for tag `v*` with asset `insight-books-<tag>.tar.gz`

- [ ] **Step 1: Create `.github/workflows/release.yml` with this exact content**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 90

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Ensure DATABASE_URL for build
        run: |
          if [ -z "${DATABASE_URL}" ]; then
            echo "DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/ci?schema=public" >> "$GITHUB_ENV"
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Production build (CI build:clean)
        run: npm run build:ci
        env:
          NODE_ENV: production

      - name: Write CI build manifest
        run: node scripts/ci-write-build-manifest.mjs
        env:
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_REF_NAME: ${{ github.ref_name }}

      - name: Prune Next cache
        run: rm -rf .next/cache

      - name: Pack release tarball
        id: pack
        run: |
          TAG="${GITHUB_REF_NAME}"
          ARCHIVE="insight-books-${TAG}.tar.gz"
          tar -czf "${ARCHIVE}" \
            --exclude='.next/cache' \
            .next \
            public \
            package.json \
            package-lock.json \
            prisma \
            next.config.mjs \
            scripts/vps-apply-release.sh \
            scripts/ci-write-build-manifest.mjs
          echo "archive=${ARCHIVE}" >> "$GITHUB_OUTPUT"
          ls -lh "${ARCHIVE}"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ steps.pack.outputs.archive }}
          generate_release_notes: true
          fail_on_unmatched_files: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Important: Task 5 must create `scripts/vps-apply-release.sh` **before** the first tag release, or temporarily remove that path from the `tar` list until Task 5 lands. Implement Task 5 in the same PR as Task 4 so the pack step succeeds.

- [ ] **Step 2: Validate YAML contains tag trigger and release action**

Run:

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/release.yml','utf8'); if(!y.includes(\"tags:\")||!y.includes('softprops/action-gh-release')) process.exit(1); console.log('release.yml ok');"
```

Expected: `release.yml ok`.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

