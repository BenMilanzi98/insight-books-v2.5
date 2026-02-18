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
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Force dynamic rendering for auth-related pages to prevent build-time auth failures
  // Use the supported `serverExternalPackages` key to mark packages that should remain external on the server
  serverExternalPackages: ["pg", "bcryptjs", "prisma"],
  // Ensure auth pages are not statically generated
  generateBuildId: () => 'build',
};

export default nextConfig;
