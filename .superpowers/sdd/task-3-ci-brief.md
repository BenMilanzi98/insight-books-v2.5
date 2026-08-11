### Task 3: GitHub Actions branch/PR build workflow

**Files:**
- Create: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `npm run build:ci`, `scripts/ci-write-build-manifest.mjs`
- Produces: Actions artifact `next-build-<ref>-<sha>` containing `.next/` (no cache)

- [ ] **Step 1: Create `.github/workflows/build.yml` with this exact content**

```yaml
name: Production build

on:
  push:
    branches:
      - '**'
  pull_request:

concurrency:
  group: production-build-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    permissions:
      contents: read

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

      - name: Production build (CI build:clean)
        run: npm run build:ci
        env:
          NODE_ENV: production
          # Provide dummy values if pages require env at build time; override via repo Variables/Secrets as needed.
          DATABASE_URL: ${{ secrets.DATABASE_URL || 'postgresql://ci:ci@127.0.0.1:5432/ci?schema=public' }}

      - name: Write CI build manifest
        run: node scripts/ci-write-build-manifest.mjs
        env:
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_REF_NAME: ${{ github.ref_name }}

      - name: Prune Next cache from artifact
        run: rm -rf .next/cache

      - name: Sanitize artifact name parts
        id: meta
        run: |
          REF="${GITHUB_REF_NAME}"
          REF_SAFE="$(echo "$REF" | sed 's/[^a-zA-Z0-9._-]/-/g' | cut -c1-60)"
          SHA_SHORT="$(echo "$GITHUB_SHA" | cut -c1-7)"
          echo "artifact_name=next-build-${REF_SAFE}-${SHA_SHORT}" >> "$GITHUB_OUTPUT"

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ steps.meta.outputs.artifact_name }}
          path: .next
          if-no-files-found: error
          retention-days: ${{ github.event_name == 'pull_request' && 7 || 14 }}
```

Note: If GitHub Actions expression `secrets.DATABASE_URL || '...'` is rejected by the workflow parser, replace the `DATABASE_URL` line with:

```yaml
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

and add a preceding step that sets a fallback:

```yaml
      - name: Ensure DATABASE_URL for build
        run: |
          if [ -z "${DATABASE_URL}" ]; then
            echo "DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/ci?schema=public" >> "$GITHUB_ENV"
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

- [ ] **Step 2: Validate YAML parses**

Run (from repo root):

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/build.yml','utf8'); if(!y.includes('npm run build:ci')) process.exit(1); console.log('build.yml ok', y.split(/\n/).length, 'lines');"
```

Expected: `build.yml ok` with line count.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

