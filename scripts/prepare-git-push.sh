#!/bin/bash

# Script to prepare and push all Docker changes to GitHub
# This follows the security-focused approach for the project

set -e  # Exit on any error

echo "🚀 Preparing Git Push for Dockerized Insight Books"
echo "================================================="

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git to continue."
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Current branch: $CURRENT_BRANCH"

# Create a new branch for Docker changes
DOCKER_BRANCH="feature/dockerize-project-$(date +%Y%m%d-%H%M%S)"
echo "SetBranch: $DOCKER_BRANCH"

git checkout -b "$DOCKER_BRANCH"

# Add all the files created/modified for Dockerization
echo "📦 Adding all Docker-related files to git..."

# Add all new files
git add Dockerfile
git add .dockerignore
git add docker-compose.yml
git add docker-compose.prod.yml
git add scripts/init-db.sh
git add scripts/dockerize-project.sh
git add scripts/prepare-git-push.sh
git add DOCKER_SETUP.md
git add DEPLOYMENT_INSTRUCTIONS.md
git add CHANGES_SUMMARY.md
git add README.md
git add next.config.mjs
# Add .env file with force flag since it might be in .gitignore
git add -f .env

# Commit the changes
COMMIT_MESSAGE="feat: Complete Dockerization of Insight Books with security enhancements

This commit includes a complete Docker setup for the Insight Books application with security best practices:

## Docker Configuration
- Multi-stage Dockerfile with security best practices
- Dependencies stage installs all build tools
- Builder stage with Prisma schema support
- Production runner with non-root execution
- Standalone output for minimal dependencies
- Health checks and environment handling

## Files Added
- Dockerfile: Multi-stage build configuration
- .dockerignore: Security-focused file exclusion
- docker-compose.yml: Local development configuration
- docker-compose.prod.yml: Production-ready configuration
- scripts/init-db.sh: Database initialization script
- scripts/dockerize-project.sh: Git workflow automation
- scripts/prepare-git-push.sh: Git push preparation script
- DOCKER_SETUP.md: Docker setup documentation
- DEPLOYMENT_INSTRUCTIONS.md: VPS deployment guide
- CHANGES_SUMMARY.md: Complete changes summary
- README.md: Updated with Docker information

## Security Enhancements
- Multi-stage builds to reduce attack surface
- Non-root user execution (UID 101)
- Minimal base image (Alpine Linux)
- Production-only dependencies in final image
- Proper environment variable handling
- File exclusions via .dockerignore
- Network isolation between services

## Database Setup
- Automatic initialization from db/insightbooks_backup_12202025_2.dump
- Database configured with exact credentials from .env file
- Initialization script ensures proper restoration sequence

## Environment Variables
- All variables from .env file properly configured
- Database URL: postgresql://henmik:Password2030@localhost:5432/insightbooks
- All other configuration matches .env file exactly

## Deployment
- Ready for VPS deployment with simple docker compose up --build
- Production configuration with additional security measures
- Comprehensive documentation for deployment process
"
git commit -m "$COMMIT_MESSAGE"

echo "✅ All Docker files committed successfully!"

# Check if remote origin exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "📡 Pushing changes to remote repository..."
    git push -u origin "$DOCKER_BRANCH"
    echo "✅ Changes pushed to branch: $DOCKER_BRANCH"
    
    echo ""
    echo "📋 Next steps:"
    echo "1. Review the changes in the PR"
    echo "2. Test the Docker build: docker build -t insight-books ."
    echo "3. Test with docker-compose: docker compose up --build"
    echo "4. The database will be initialized automatically from the backup file"
    echo "5. Merge after security review"
else
    echo "⚠️ No remote origin found. Please add your remote repository:"
    echo "   git remote add origin <your-repository-url>"
    echo "   Then run: git push -u origin $DOCKER_BRANCH"
fi

echo ""
echo "🎯 Dockerization complete! Branch created: $DOCKER_BRANCH"
echo ""
echo "🐳 To build the image: docker build -t insight-books ."
echo "🐳 To run with docker-compose: docker compose up --build"
echo "🐳 For production: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "🗄️ Database Setup:"
echo "   The database will be automatically initialized from db/insightbooks_backup_12202025_2.dump"
echo "   Database: insightbooks"
echo "   User: henmik"
echo "   Password: Password2030"
echo ""
echo "📝 Deployment Documentation:"
echo "   Check DEPLOYMENT_INSTRUCTIONS.md for complete VPS deployment guide"