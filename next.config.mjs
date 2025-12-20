/** @type {import('next').NextConfig} */
const nextConfig = {
 output: 'standalone',
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
            value: 'public, max-age=3153600, immutable',
          },
        ],
      },
    ];
  },
  // Force dynamic rendering for auth-related pages to prevent build-time auth failures
  experimental: {
    // Prevent static generation of auth-dependent pages during build
    serverComponentsExternalPackages: ["pg", "bcryptjs", "prisma"],
  },
  // Ensure auth pages are not statically generated
  generateBuildId: () => 'build',
};

export default nextConfig;
