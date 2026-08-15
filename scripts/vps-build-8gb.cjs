#!/usr/bin/env node
/**
 * Production build for ~8 GB RAM VPS hosts.
 *
 * Do NOT use build:clean / --max-old-space-size=14336 on 8 GB — the kernel
 * OOM-kills Node with no Next.js error (stops at "Creating an optimized…").
 *
 * Usage on VPS:
 *   sudo ./scripts/vps-ensure-swap.sh 2   # once
 *   pm2 stop all || true                   # free RAM during build
 *   npm run build:vps-8gb
 */
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const totalMb = Math.round(os.totalmem() / (1024 * 1024));
const freeMb = Math.round(os.freemem() / (1024 * 1024));

console.log(`==> Host memory: ${totalMb} MB total, ${freeMb} MB free`);

if (totalMb > 0 && totalMb < 7000) {
  console.warn(
    '==> WARNING: under ~8 GB RAM. Prefer npm run build:vps-2gb (+ swap) or CI release apply.'
  );
}

if (freeMb > 0 && freeMb < 2500) {
  console.warn(
    '==> WARNING: less than 2.5 GB free. Stop the app/DB load first (pm2 stop …).'
  );
}

// Heap must stay under physical RAM. 4 GB leaves room for OS + webpack natives.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  UV_THREADPOOL_SIZE: '2',
  NEXT_BUILD_CPUS: process.env.NEXT_BUILD_CPUS || '2',
  NEXT_BUILD_PARALLELISM: process.env.NEXT_BUILD_PARALLELISM || '2',
  NODE_OPTIONS: '--max-old-space-size=4096',
};

console.log('==> Building with NODE_OPTIONS=--max-old-space-size=4096 (safe for 8 GB)');
console.log('    If this exits with no error, check: dmesg -T | grep -i oom');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const shell = process.platform === 'win32';

const rimraf = spawnSync(npm, ['exec', '--', 'rimraf', '.next'], {
  stdio: 'inherit',
  env,
  shell,
});
if (rimraf.status !== 0) process.exit(rimraf.status == null ? 1 : rimraf.status);

const prisma = spawnSync(npm, ['exec', '--', 'prisma', 'generate'], {
  stdio: 'inherit',
  env,
  shell,
});
if (prisma.status !== 0) process.exit(prisma.status == null ? 1 : prisma.status);

const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const build = spawnSync(process.execPath, [nextBin, 'build', '--webpack'], {
  stdio: 'inherit',
  env,
});
const code = build.status == null ? 1 : build.status;
if (code === 137 || code === 9) {
  console.error(
    '\n==> Process was KILLED (likely OOM). Add swap and retry:\n' +
      '    sudo ./scripts/vps-ensure-swap.sh 2\n' +
      '    pm2 stop all\n' +
      '    npm run build:vps-8gb\n'
  );
}
process.exit(code);
