/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
