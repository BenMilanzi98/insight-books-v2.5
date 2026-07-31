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
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Strip console.* from production client/server bundles unless explicitly enabled via .env
  compiler: {
    removeConsole: isClientConsoleEnabledAtBuild() ? false : true,
  },
  output: 'standalone',
  transpilePackages: ['qrcode.react'],
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
  serverExternalPackages: ["pg", "bcryptjs", "prisma", "puppeteer", "jspdf", "jspdf-autotable"],
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
    ];
  },
};

export default nextConfig;
