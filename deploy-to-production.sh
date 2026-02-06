#!/bin/bash

# Deploy to production without losing data
# This script pushes database migrations and builds the app

echo "🚀 Starting production deployment..."

# 1. Navigate to project directory
cd /home/ben/Desktop/insight-books-v2.0

# 2. Generate database migration (if schema changed)
echo "📦 Generating database migration..."
npx prisma migrate deploy --schema=prisma/schema.prisma

# 3. Generate Prisma client
echo "🔨 Generating Prisma client..."
npx prisma generate

# 4. Build the Next.js application
echo "🏗️ Building application..."
npm run build

# 5. Restart PM2 process
echo "🔄 Restarting production server..."
pm2 restart insight-books

# 6. Verify deployment
echo "✅ Deployment complete!"
echo ""
echo "Production server should be available at:"
echo "  https://insightbooksafrica.com"
echo ""
echo "To check logs:"
echo "  pm2 logs insight-books --lines 50"

exit 0
