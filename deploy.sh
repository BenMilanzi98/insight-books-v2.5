#!/bin/bash

# Deployment script for Insight Books
echo "🚀 Starting deployment..."

cd /home/ben/Desktop/insight-books-v2.0

# Clear Next.js cache
echo "🧹 Clearing cache..."
rm -rf .next

# Build the application
echo "🔨 Building application..."
npm run build

# Restart PM2 process
echo "🔄 Restarting PM2..."
pm2 restart insight-books

echo "✅ Deployment complete!"
echo "🌐 Access: https://insightbooksafrica.com"
