#!/usr/bin/env node
/**
 * Last-resort production build for ~2 GB RAM VPS hosts.
 * Prefer CI release + scripts/vps-apply-release.sh instead of building on the VPS.
 *
 * Prerequisites (Linux VPS):
 *   sudo ./scripts/vps-ensure-swap.sh 2
 *   stop heavy services (pm2 stop …) before running
 *
 * Usage: npm run build:vps-2gb
 */
const { spawnSync } = require('child_process');
const os = require('os');

const totalMb = Math.round(os.totalmem() / (1024 * 1024));
const freeMb = Math.round(os.freemem() / (1024 * 1024));

console.log(`==> Host memory: ${totalMb} MB total, ${freeMb} MB free`);
if (totalMb > 0 && totalMb < 2800) {
  console.log('==> 2 GB-class host detected.');
  console.log('    Recommended: build on GitHub Actions, then:');
  console.log('      GITHUB_REPO=owner/repo RELEASE_TAG=vX.Y.Z ./scripts/vps-apply-release.sh');
  console.log('    If you must build here: ensure 2G+ swap (sudo ./scripts/vps-ensure-swap.sh 2)');
  console.log('    and stop the app/DB load first (pm2 stop …).');
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  UV_THREADPOOL_SIZE: '1',
  // Keep Node heap under physical RAM so the OS + Prisma still fit (~2G box).
  NODE_OPTIONS: '--max-old-space-size=1280',
};

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build:vps'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

process.exit(result.status == null ? 1 : result.status);
