#!/usr/bin/env node
/**
 * Production build for ~8 GB RAM VPS hosts.
 *
 * This app's webpack compile peaks above 4 GB RSS. Use ~6.5 GB heap + swap +
 * a single webpack worker. Never use build:clean (14 GB heap) on 8 GB RAM.
 *
 * Usage:
 *   pm2 stop all || true
 *   npm run build:vps-8gb
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const totalMb = Math.round(os.totalmem() / (1024 * 1024));
const freeMb = Math.round(os.freemem() / (1024 * 1024));

console.log(`==> Host memory: ${totalMb} MB total, ${freeMb} MB free`);
console.log(`==> Node ${process.version}`);

function swapActiveBytes() {
  try {
    const txt = fs.readFileSync('/proc/swaps', 'utf8');
    const lines = txt.trim().split('\n').slice(1);
    return lines.reduce((sum, line) => {
      const parts = line.split(/\s+/);
      const sizeKb = Number(parts[2] || 0);
      return sum + sizeKb * 1024;
    }, 0);
  } catch {
    return 0;
  }
}

function ensureSwapLinux() {
  if (process.platform !== 'linux') return;
  if (swapActiveBytes() >= 1.5 * 1024 * 1024 * 1024) {
    console.log('==> Swap already present');
    return;
  }
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.warn(
      '==> No/low swap and not root. Run as root or:\n' +
        '    fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile'
    );
    return;
  }

  const swapfile = process.env.SWAPFILE_PATH || '/swapfile';
  console.log(`==> Creating/enabling 4G swap at ${swapfile} (webpack peaks >4G)`);

  if (!fs.existsSync(swapfile)) {
    let r = spawnSync('fallocate', ['-l', '4G', swapfile], { stdio: 'inherit' });
    if (r.status !== 0) {
      r = spawnSync(
        'dd',
        ['if=/dev/zero', `of=${swapfile}`, 'bs=1M', 'count=4096', 'status=progress'],
        { stdio: 'inherit' }
      );
      if (r.status !== 0) {
        console.warn('==> Could not create swap file');
        return;
      }
    }
  }

  spawnSync('chmod', ['600', swapfile], { stdio: 'inherit' });
  spawnSync('mkswap', [swapfile], { stdio: 'inherit' });
  const swapon = spawnSync('swapon', [swapfile], { stdio: 'inherit' });
  if (swapon.status !== 0) {
    console.warn('==> swapon failed (may already be active)');
  }

  try {
    const fstab = fs.readFileSync('/etc/fstab', 'utf8');
    if (!fstab.includes(swapfile)) {
      fs.appendFileSync('/etc/fstab', `${swapfile} none swap sw 0 0\n`);
    }
  } catch {
    /* ignore */
  }

  spawnSync('sysctl', ['-w', 'vm.swappiness=60'], { stdio: 'ignore' });
  console.log('==> Swap ready');
}

ensureSwapLinux();

if (freeMb > 0 && freeMb < 3000) {
  console.warn('==> WARNING: <3 GB free. Stop PM2/app first: pm2 stop all');
}

// Webpack for this repo peaks past 4 GB. Cap under 8 GB physical + use swap.
// Single worker keeps peak lower than cpus=2.
const heapMb = String(process.env.VPS_BUILD_HEAP_MB || '6656');
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  UV_THREADPOOL_SIZE: '1',
  NEXT_BUILD_CPUS: '1',
  NEXT_BUILD_PARALLELISM: '1',
  NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
};

console.log(`==> Building with heap ${heapMb} MB, cpus=1, parallelism=1`);
console.log('    Prefer Node 20 LTS if this still OOMs on Node 24.');

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

if (code !== 0) {
  console.error(`\n==> Build failed (exit ${code}).`);
  if (code === 137 || code === 9) {
    console.error('    Kernel OOM — ensure 4G swap and pm2 stop all.');
  }
  console.error('    Retry with more heap: VPS_BUILD_HEAP_MB=7200 npm run build:vps-8gb');
  console.error('    Or build on GitHub Actions and use scripts/vps-apply-release.sh');
  console.error('    Or try: npx next build --turbopack  (sometimes lower peak RAM)');
}

process.exit(code);
