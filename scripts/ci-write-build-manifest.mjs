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
