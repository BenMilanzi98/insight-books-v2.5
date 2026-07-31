# Docker Setup Documentation

This document explains the Docker setup for the Next.js application, focusing on security and production readiness.

## Database Setup with Backup

This project includes a database backup file (`db/insightbooks_backup_12202025_2.dump`) that should be imported into the PostgreSQL database. The database configuration uses:

- Database name: `insightbooks`
- Username: `henmik`
- Password: `Password2030`
- Port: `5432`

### Importing the Database Backup

When running the application with Docker Compose, you can import the backup using these steps:

1. Start the database service:
   ```bash
   docker-compose up -d db
   ```

2. Wait for the database to be ready, then import the backup:
   ```bash
   docker exec -i db psql -U henmik -d insightbooks -f /path/to/backup/dump/file
   ```

3. Or using pg_restore if it's a custom format dump:
   ```bash
   docker exec -i db pg_restore -U henmik -d insightbooks --verbose --clean --no-acl --no-owner -h localhost /path/to/backup/dump/file
   ```

## Overview

The Docker setup consists of:
- A multi-stage Dockerfile for optimized builds
- A `.dockerignore` file for security
- A `docker-compose.yml` file for local development
- Comprehensive documentation for deployment

## Security Measures Implemented

### 1. Multi-Stage Build Process
- Dependencies are installed in a separate stage to minimize attack surface
- Build artifacts are separated from runtime environment
- Final image contains only necessary files

### 2. Non-Root User Execution
- Application runs as `nextjs` user (UID 1001) instead of root
- Reduces potential damage from container breakout attacks

### 3. Minimal Base Image
- Using `node:20-alpine` for smaller footprint and fewer vulnerabilities
- Alpine Linux is specifically designed for containers

### 4. Environment Variable Handling
- Sensitive data should be passed via environment variables
- `.env` files are excluded from Docker image via `.dockerignore`
- Default fallback values provided in code

### 5. Health Checks
- Built-in health checks to monitor application status
- Automatic restart policies for improved reliability

## Dockerfile Architecture

### Stages Explained:
1. **deps**: Installs production dependencies only
2. **builder**: Builds the application and generates Prisma client
3. **runner**: Production runtime with minimal footprint

### Key Features:
- Uses Next.js standalone output for minimal dependencies
- Disables telemetry during build
- Proper file permissions with `--chown`
- Correctly exposes port 300

## Environment Variables

The application expects the following environment variables:

### Required Variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `JWT_SECRET`: Secret for JWT token signing
- `NODE_ENV`: Set to "production" for production environments

### Optional Variables:
- `APP_URL`: Base URL of your application
- `CRON_SECRET`: Secret for cron job authentication
- Email configuration variables (SMTP settings)
- Google OAuth credentials
- Payment gateway credentials (PayChangu)

## Building and Running

### Local Development
```bash
# Build and run with docker-compose
docker-compose up --build

# Run just the app (assuming external database)
docker build -t insight-books:latest .
docker run -p 3000:3000 -e DATABASE_URL="..." insight-books:latest
```

### Production Deployment
```bash
# Build the image
docker build -t insight-books:latest .

# Run with production environment variables
docker run -d \
  --name insight-books \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="your-secret" \
  insight-books:latest
```

## Docker Compose Services

### App Service:
- Built from the Dockerfile (runner stage)
- Exposes port 300
- Includes health checks
- Connects to the database service

### Database Service:
- PostgreSQL 15 for compatibility
- Persistent volume for data
- Health checks to ensure readiness
- Proper environment variables

## Deployment Considerations

### Production Security:
- Use secrets management for sensitive variables (HashiCorp Vault, AWS Secrets Manager, etc.)
- Enable HTTPS/TLS termination at reverse proxy level
- Implement rate limiting and DDoS protection
- Regular image vulnerability scanning

### Performance:
- Use external PostgreSQL instance in production
- Implement caching layers (Redis) if needed
- Optimize database connection pooling
- Monitor resource usage

### Monitoring:
- Collect application logs via structured logging
- Monitor container metrics (CPU, memory, disk)
- Set up alerts for health check failures
- Track application performance metrics

## Next.js Specific Notes

### Standalone Output:
- Uses Next.js standalone output feature for minimal image size
- Includes only necessary dependencies
- Faster startup times

### Middleware Support:
- The application includes authentication middleware
- Ensure environment variables are properly configured
- Session handling works with containerized setup

### API Routes:
- All API routes are preserved in the Docker build
- Database connections are handled via environment variables
- Authentication flows work as expected

## Troubleshooting

### Common Issues:
1. **Database Connection**: Ensure `DATABASE_URL` is properly configured
2. **Environment Variables**: Verify all required variables are set
3. **Port Binding**: Make sure port 3000 is available
4. **Prisma Client**: The build process generates the client automatically

### Debugging Tips:
- Check container logs: `docker logs <container-name>`
- Verify environment: `docker exec -it <container-name> env`
- Test connectivity: `docker exec -it <container-name> ping <database-host>`

## Security Recommendations

### Post-Deployment:
1. Scan images for vulnerabilities regularly
2. Rotate secrets periodically
3. Implement network segmentation
4. Use read-only root filesystem where possible
5. Apply least-privilege principles

### For Previous Compromise Mitigation:
1. Fresh certificates and keys
2. Updated secrets and passwords
3. Isolated runtime environment (achieved with Docker)
4. Reduced attack surface (achieved with multi-stage builds)
5. Network restrictions and monitoring