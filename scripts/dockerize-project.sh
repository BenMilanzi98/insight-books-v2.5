#!/bin/bash

#!/bin/bash

# Script to create a new git branch and push Docker changes
# This follows the security-focused approach for the project

set -e # Exit on any error

echo "🚀 Dockerizing Next.js Project - Security-Focused Setup"
echo "====================================================="

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git to continue."
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. Please install Docker to build the image."
    echo "   You can still commit the Docker files for others to use."
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Current branch: $CURRENT_BRANCH"

# Create a new branch for Docker changes
DOCKER_BRANCH="feature/dockerize-project-$(date +%Y%m%d-%H%M%S)"
echo "SetBranch: $DOCKER_BRANCH"

git checkout -b "$DOCKER_BRANCH"

# Add all Docker-related files
echo "📦 Adding Docker files to git..."
git add Dockerfile .dockerignore docker-compose.yml docker-compose.prod.yml DOCKER_SETUP.md next.config.mjs README.md scripts/dockerize-project.sh scripts/init-db.sh

# Commit the changes
COMMIT_MESSAGE="feat: Add Docker configuration for secure containerization

- Implement multi-stage Dockerfile with security best practices
- Add .dockerignore for sensitive file exclusion
- Create docker-compose.yml for local development
- Add standalone output configuration to Next.js
- Include Prisma schema in build process
- Run application as non-root user
- Add health checks and proper environment handling
- Include database backup initialization in docker-compose
- Update documentation with database setup instructions

Security measures implemented:
- Multi-stage build to reduce attack surface
- Non-root user execution
- Minimal base image (Alpine)
- Proper environment variable handling
- Excluded sensitive files via .dockerignore
- Standalone output for minimal dependencies
- Database backup import for initial setup
"
git commit -m "$COMMIT_MESSAGE"

echo "✅ Docker files committed successfully!"

# Check if remote origin exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "📡 Pushing changes to remote repository..."
    git push -u origin "$DOCKER_BRANCH"
    echo "✅ Changes pushed to branch: $DOCKER_BRANCH"
    
    echo ""
    echo "📋 Next steps:"
    echo "1. Review the changes in the PR"
    echo "2. Test the Docker build: docker build -t insight-books ."
    echo "3. Install Docker Compose: sudo apt-get install docker-compose-plugin"
    echo "4. Test with docker-compose: docker compose up --build"
    echo "5. The database will be initialized automatically from the backup file"
    echo "6. Merge after security review"
else
    echo "⚠️  No remote origin found. Please add your remote repository:"
    echo "   git remote add origin <your-repository-url>"
    echo "   Then run: git push -u origin $DOCKER_BRANCH"
fi

echo ""
echo "🎯 Dockerization complete! Branch created: $DOCKER_BRANCH"
echo ""
echo "🐳 To build the image: docker build -t insight-books ."
echo "🐳 To run with docker-compose: docker compose up --build (after installing docker-compose-plugin)"
echo "🐳 Alternative: docker-compose up --build (if using standalone docker-compose)"
echo "🐳 For production: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "🗄️ Database Setup:"
echo "   The database will be automatically initialized from db/insightbooks_backup_12202025_2.dump"
echo "   Database: insightbooks"
echo "   User: henmik"
echo "   Password: Password2030"