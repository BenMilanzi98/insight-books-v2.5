### Task 2: Add `build:ci` script + build manifest helper

**Files:**
- Modify: `package.json` (scripts section)
- Create: `scripts/ci-write-build-manifest.mjs`

**Interfaces:**
- Consumes: env `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_REF` (optional locally)
- Produces: `npm run build:ci`; writes `.next/ci-build-manifest.json` after build when invoked

- [ ] **Step 1: Add `build:ci` next to `build:clean` in `package.json`**

Locate the existing script:

```json
"build:clean": "rimraf .next && prisma generate && cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=8192 next build --webpack",
```

Immediately after it, add:

```json
"build:ci": "rimraf .next && prisma generate && cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=6144 next build --webpack",
```

Do not change `build:clean` behavior (local/high-RAM still 8192). CI workflows must call `build:ci` (CI-tuned equivalent of `build:clean`).

- [ ] **Step 2: Create `scripts/ci-write-build-manifest.mjs`**

```js
import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), '.next');
if (!fs.existsSync(outDir)) {
  console.error('ci-write-build-manifest: .next missing — run build first');
  process.exit(1);
}

const sha = process.env.GITHUB_SHA || process.env.GIT_SHA || '';
const ref = process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || '';
const manifest = {
  gitSha: sha,
  gitRef: ref,
  nodeVersion: process.version,
  builtAt: new Date().toISOString(),
  nextBuildId: 'build',
};

const dest = path.join(outDir, 'ci-build-manifest.json');
fs.writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
console.log('Wrote', dest);
```

- [ ] **Step 3: Smoke the manifest script without a full build**

Run:

```bash
mkdir -p .next && node scripts/ci-write-build-manifest.mjs && type .next\ci-build-manifest.json
```

(On bash: `cat .next/ci-build-manifest.json`.)

Expected: JSON with `builtAt` and `nodeVersion`.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

