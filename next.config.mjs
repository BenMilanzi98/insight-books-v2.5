import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isClientConsoleEnabledAtBuild() {
  const raw = process.env.NEXT_PUBLIC_CLIENT_CONSOLE_LOGS;
  if (raw != null && String(raw).trim() !== '') {
    const v = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
  }
  return process.env.NODE_ENV !== 'production';
}

const buildCpus = Math.max(1, Number(process.env.NEXT_BUILD_CPUS || 1) || 1);
const buildParallelism = Math.max(1, Number(process.env.NEXT_BUILD_PARALLELISM || 1) || 1);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack can resolve bare CSS @import "tailwindcss" from the parent of this
  // project (C:\\laragon\\www) instead of the package root — common on Windows
  // when the folder name contains a dot (insight-books-v2.5). Pin the alias.
  turbopack: {
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, 'node_modules/tailwindcss'),
    },
  },
  // Strip console.* from production client/server bundles unless explicitly enabled via .env
  compiler: {
    removeConsole: isClientConsoleEnabledAtBuild() ? false : true,
  },
  // Standalone tracing is very RAM-heavy on small VPSs. Opt in explicitly:
  // NEXT_STANDALONE=1 npm run build
  ...(process.env.NEXT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  // Keep upload/tmp/docs out of file tracing (cuts VPS build RAM).
  outputFileTracingExcludes: {
    '*': [
      './uploads/**/*',
      './tmp/**/*',
      './.cursor/**/*',
      './docs/**/*',
      './storage/**/*',
      './insight/**/*',
      './android-app-center/**/*',
      './insight_books_android/**/*',
      './starter-for-nextjs/**/*',
      './test/**/*',
      './tests/**/*',
      './artifacts/**/*',
      './backups/**/*',
      './node_modules/@swc/core*/**/*',
      './node_modules/next/dist/server/lib/squoosh/**/*',
      './**/*.docx',
      './**/*.pdf',
      './**/*.xlsx',
    ],
  },
  transpilePackages: ['qrcode.react'],
  productionBrowserSourceMaps: false,
  experimental: {
    // Cap webpack workers. Override on larger hosts: NEXT_BUILD_CPUS=2
    webpackMemoryOptimizations: true,
    cpus: buildCpus,
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  webpack: (config, { isServer }) => {
    // Serialize by default; raise with NEXT_BUILD_PARALLELISM on 8GB+ hosts.
    config.parallelism = buildParallelism;
    config.cache = false;
    config.devtool = false;
    // Desktop-only native addon — never bundle; optional on web/VPS hosts.
    if (isServer) {
      const prev = config.externals;
      config.externals = [
        ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
        ({ request }, callback) => {
          if (request === 'better-sqlite3') {
            return callback(null, `commonjs ${request}`);
          }
          return callback();
        },
      ];
    }
    return config;
  },
  images: {
    // Disable image optimization for uploaded files to prevent thumbnail generation
    // Allow images from uploads directory
    remotePatterns: [],
    // Don't optimize images that come from our own domain/uploads
    unoptimized: false,
  },
  // Ensure static files are served correctly
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Force dynamic rendering for auth-related pages to prevent build-time auth failures
  // Use the supported `serverExternalPackages` key to mark packages that should remain external on the server
  serverExternalPackages: [
    'pg',
    'bcryptjs',
    'prisma',
    '@prisma/client',
    'puppeteer',
    'jspdf',
    'jspdf-autotable',
    'exceljs',
    'jsqr',
    'pngjs',
    'qrcode',
    'better-sqlite3',
  ],
  // Ensure auth pages are not statically generated
  generateBuildId: () => 'build',
  async redirects() {
    return [
      {
        source: '/tax-types',
        destination: '/tax-management',
        permanent: true,
      },
      {
        source: '/tax-accounts',
        destination: '/tax-management/accounts',
        permanent: true,
      },
      {
        source: '/tax-accounts/:id',
        destination: '/tax-management/accounts/:id',
        permanent: true,
      },
      {
        source: '/tax',
        destination: '/tax-management',
        permanent: true,
      },
      {
        source: '/rentals/hiring',
        destination: '/rentals/hirings?tab=customer',
        permanent: false,
      },
      {
        source: '/rentals/inbound-hiring',
        destination: '/rentals/hirings?tab=supplier',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
