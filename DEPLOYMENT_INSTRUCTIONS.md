# Deployment Instructions for Insight Books

## Overview
This document provides comprehensive instructions for deploying the Insight Books application with Docker. The application has been configured with security best practices and includes automatic database initialization.

## Prerequisites
- Docker and Docker Compose installed
- Git installed for cloning the repository

## Deployment Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd insight-books
```

### 2. Environment Configuration
The repository includes a `.env` file with all necessary environment variables. You may need to adjust the values for your specific environment:

```bash
# Review and modify the environment variables if needed
cat .env
```

### 3. Build and Run with Docker Compose (Recommended)
```bash
# Install Docker Compose plugin if not already installed
sudo apt-get install docker-compose-plugin

# Build and run the application
docker compose up --build
```

### 4. Alternative: Using Standalone Docker Compose
```bash
# Install standalone docker-compose if not already installed
sudo apt-get install docker-compose

# Build and run the application
docker-compose up --build
```

### 5. Manual Docker Commands (If Compose is not available)
```bash
# Build the application image
docker build -t insight-books .

# Start the database container
docker run -d \
  --name insight-books-db \
  -e POSTGRES_DB=insightbooks \
  -e POSTGRES_USER=henmik \
  -e POSTGRES_PASSWORD=Password2030 \
  -p 5432:5432 \
  -v insight-books-postgres-data:/var/lib/postgresql/data \
  postgres:15-alpine

# Wait for database to be ready, then import the database backup
sleep 30
docker exec -i insight-books-db pg_restore -U henmik -d insightbooks --verbose --clean --no-acl --no-owner -h localhost /path/to/db/insightbooks_backup_12202025_2.dump

# Start the application container
docker run -d \
  --name insight-books-app \
  --link insight-books-db \
  -p 3000:300 \
  -e DATABASE_URL=postgresql://henmik:Password2030@insight-books-db:5432/insightbooks?schema=public \
  -e NODE_ENV=production \
  -e APP_URL=http://localhost:3000 \
 -e SESSION_SECRET=your-secure-session-secret-key-change-this-in-production \
  -e JWT_SECRET=your-secure-jwt-secret-key-change-this-in-production \
  -e CRON_SECRET=3213d4730a2acb95bc05bc9a939cdce21f3afc440ebabc34ad8d1a56af10174b \
  -e EMAIL_HOST=smtp.hostinger.com \
  -e EMAIL_PORT=465 \
  -e EMAIL_USER=noreply@insightbooksafrica.com \
  -e EMAIL_PASSWORD=5lI0HGXatVMZ2pdy-M7h \
  -e EMAIL_FROM="InsightBooks <noreply@insightbooksafrica.com>" \
  -e EMAIL_SECURE=true \
  -e GOOGLE_CLIENT_ID=1046153543055-0r8p9sjbmkp3g7o3ddh4v9740s9arit0.apps.googleusercontent.com \
  -e GOOGLE_CLIENT_SECRET=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 \
  -e GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback \
  -e PAYCHANGU_SECRET_KEY=sec-live-5wSwiszxsHU4FGui10R4LxkKEzWiqHi6 \
  insight-books
```

## Database Initialization
The application includes automatic database initialization:
- Database backup file: `db/insightbooks_backup_12202025_2.dump`
- Database name: `insightbooks`
- Username: `henmik`
- Password: `Password2030`

When using Docker Compose, the database will be automatically initialized from the backup file during the first startup.

## Accessing the Application
- Frontend: http://localhost:3000
- Database: localhost:5432 (for external connections if needed)

## Production Deployment
For production deployment, use the production Docker Compose file:

```bash
docker compose -f docker-compose.prod.yml up -d
```

This configuration includes additional security measures such as:
- No new privileges
- Read-only filesystem for the application
- Temporary filesystem for sensitive directories

## Management Commands
- View logs: `docker compose logs -f`
- Stop services: `docker compose down`
- Restart services: `docker compose restart`
- Check running containers: `docker ps`

## Security Features
- Multi-stage Docker build with minimal attack surface
- Application runs as non-root user
- Production-only dependencies in final image
- Environment variables properly managed
- Network isolation between services
- Secure database initialization

## Troubleshooting
1. If the application fails to start, check the logs:
   ```bash
   docker compose logs
   ```

2. If the database fails to initialize, ensure the backup file exists and has correct permissions.

3. If you encounter permission issues, ensure Docker is properly installed and your user has Docker access.

## Updating the Application
1. Pull the latest changes:
   ```bash
   git pull
   ```

2. Rebuild and restart:
   ```bash
   docker compose up --build