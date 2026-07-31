# Troubleshooting Guide for Insight Books Docker Deployment

This guide provides solutions for common issues encountered when running the Dockerized Insight Books application.

## Common Issues and Solutions

### 1. API 500 Errors (e.g., login API returning 500)

#### Issue: `POST http://[your-ip]:3000/api/auth/login 500 (Internal Server Error)`

#### Possible Causes and Solutions:

**A. Database not fully initialized**
- The database backup import may still be in progress when the application starts
- Solution: Wait for the database initialization to complete (can take 1-5 minutes for large databases)
- Check logs: `docker compose logs db` and `docker compose logs app`

**B. Database connection issues**
- The application may not be able to connect to the database
- Solution: Verify the database credentials in your .env file match the docker-compose.yml
- Ensure the database service name in DATABASE_URL matches the service name in docker-compose.yml

**C. Database schema not applied**
- The database may be initialized but the schema not properly applied
- Solution: Check if the Prisma schema has been properly applied during initialization

### 2. How to Check Service Status

```bash
# Check if all services are running
docker compose ps

# Check application logs
docker compose logs app

# Check database logs
docker compose logs db

# Check specific service logs in real-time
docker compose logs -f app
```

### 3. Database Initialization Verification

To verify the database has been properly initialized:

```bash
# Connect to the database container
docker exec -it insight-books-v2.0-db-1 psql -U henmik -d insightbooks

# Or if the container name is different, find it first:
docker ps
docker exec -it [container-name] psql -U henmik -d insightbooks

# List tables to verify data import
\dt
\q
```

### 4. Force Rebuild and Restart

If issues persist, try rebuilding:

```bash
# Stop all services
docker compose down

# Remove volumes to start fresh (WARNING: This will delete all data)
docker compose down -v

# Rebuild and start
docker compose up --build
```

### 5. Check Environment Variables

Verify that your .env file has the correct database URL:

```
DATABASE_URL="postgresql://henmik:Password2030@db:5432/insightbooks?schema=public"
```

Note: The hostname should be `db` (matching the service name in docker-compose.yml), not `localhost`.

### 6. Alternative Database Connection

If using the production compose file, make sure the database service name matches in the environment variables.

### 7. Manual Database Schema Application

If the schema wasn't applied during initialization:

```bash
# Enter the application container
docker exec -it [app-container-name] /bin/sh

# Run database migrations if needed
npx prisma db push
# or
npm run db:push
```

### 8. Health Check

Wait for both services to be healthy before testing:

```bash
# Check service health
docker compose ps

# Wait for status to show "healthy" for both services before accessing the application
```

### 9. Network Issues

If the application cannot connect to the database:

```bash
# Check if services can communicate
docker compose exec app ping db

# Check the network configuration in docker-compose.yml
```

## Debugging Steps

1. Check the logs for both services: `docker compose logs`
2. Verify the database is running and accessible
3. Confirm environment variables are correctly set
4. Wait for proper initialization (especially for large database imports)
5. Check if the application can reach the database: `docker compose exec app ping db`

## For the Login Error Specifically

The login error could be due to:

1. **Database not ready**: Wait for database initialization to complete
2. **Schema issues**: The authentication tables might not be properly created
3. **Connection pool**: Database connection might not be established yet
4. **URL mismatch**: APP_URL configuration doesn't match the actual access URL
5. **OAuth configuration**: Google OAuth redirect URIs don't match
6. **Relative API calls during build**: During build time, relative URLs like `/api/auth/me` fail because there's no base URL context
7. **Static rendering of dynamic pages**: Pages that depend on authentication state are being statically generated

### Specific Fix for the ERR_INVALID_URL Issue

The build logs show an error: `TypeError: Failed to parse URL from /api/auth/me` with `code: 'ERR_INVALID_URL'` and `input: '/api/auth/me'`.

This occurs because:
- During Next.js build (SSG/prerendering), the app tries to call `fetch('/api/auth/me')`
- At build time, there is no browser, no origin, no request context
- Relative URLs break during static generation

### Required Fixes:

1. **Ensure APP_URL consistency**: Make sure APP_URL in docker-compose.yml matches the actual domain/IP you're accessing
   ```yaml
   # In docker-compose.yml
   environment:
     - APP_URL=http://213.165.230.139:3000  # Match the IP you're accessing
     - NEXT_PUBLIC_APP_URL=http://213.165.230.139:3000
   ```

2. **Make auth-dependent pages dynamic**: Add these exports to any page that checks auth state:
   ```javascript
   export const dynamic = 'force-dynamic'
   export const revalidate = 0
   ```

3. **Fix API calls to use absolute URLs**: Wherever you fetch the current user, use:
   ```javascript
   import { headers } from 'next/headers'
   
   const baseUrl = process.env.APP_URL
   const res = await fetch(`${baseUrl}/api/auth/me`, {
     cache: 'no-store',
     headers: {
       cookie: headers().get('cookie') ?? ''
     }
   })
   ```

4. **Rebuild the containers** after updating environment variables:
   ```bash
   docker compose down
   docker compose build app --no-cache
   docker compose up -d
   ```

Check the application logs specifically for database connection messages and authentication-related errors.