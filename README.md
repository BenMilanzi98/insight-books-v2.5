# Insight Books - Financial Management Platform

A comprehensive financial management platform built with Next.js, featuring accounting, inventory, HR, and business management tools.

## 🗄️ Database Setup

The project includes a database backup file that needs to be imported:

- Backup file: `db/insightbooks_backup_12202025_2.dump`
- Database name: `insightbooks`
- Username: `henmik`
- Password: `Password2030`

### Importing the Database

1. Using Docker Compose (recommended):
   ```bash
   # Start only the database service
   docker-compose up -d db
   
   # Wait for database to be ready (about 30 seconds)
   # Then import the backup using one of these methods:
   
   # Method 1: If it's a SQL dump
   cat db/insightbooks_backup_12202025_2.dump | docker exec -i postgres_db psql -U henmik -d insightbooks
   
   # Method 2: If it's a custom format dump
   docker exec -i postgres_db pg_restore -U henmik -d insightbooks --verbose --clean --no-acl --no-owner -h localhost /path/to/dump
   ```

2. Using local PostgreSQL tools:
   ```bash
   # Make sure PostgreSQL is running locally
   psql -h localhost -U henmik -d insightbooks -f db/insightbooks_backup_12202025_2.dump
   ```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL database

### Environment Variables
Create a `.env` file based on the provided `env.example`:

```bash
cp env.example .env
```

Then update the values according to your environment.

### Running with Docker (Recommended)

The application is configured for secure containerized deployment. On systems where Docker Compose is not available as a plugin, you have several options:

**Option 1: Install Docker Compose (Recommended)**
```bash
# Install Docker Compose plugin (if available)
sudo apt-get install docker-compose-plugin

# Then run:
docker compose up --build
```

**Option 2: Use docker-compose standalone**
```bash
# Install docker-compose standalone
sudo apt-get install docker-compose

# Then run:
docker-compose up --build
```

**Option 3: Build and run manually**
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

# Wait for database to be ready, then start the application
docker run -d \
  --name insight-books-app \
  -p 3000:3000 \
  --link insight-books-db \
  -e DATABASE_URL=postgresql://henmik:Password2030@insight-books-db:5432/insightbooks?schema=public \
  -e NODE_ENV=production \
  -e APP_URL=http://localhost:3000 \
  -e SESSION_SECRET=your-secure-session-secret-key-change-this-in-production \
  -e JWT_SECRET=your-secure-jwt-secret-key-change-this-in-production \
  insight-books
```

The application will be available at `http://localhost:3000`

### Local Testing Steps

1. **Install Docker Compose plugin or standalone version:**
   ```bash
   # For Docker Compose plugin:
   sudo apt-get install docker-compose-plugin
   
   # Or for standalone:
   sudo apt-get install docker-compose
   ```

2. **Build and run the application:**
   ```bash
   docker compose up --build
   # Or: docker-compose up --build
   ```

3. **Wait for the database to initialize:**
   - The database container will start first
   - The backup file will be automatically restored
   - Wait for messages indicating database initialization is complete

4. **Access the application:**
   - Once both services are running, visit `http://localhost:3000`
   - The application should connect to the initialized database

5. **Check logs for any issues:**
   ```bash
   docker compose logs -f
   # Or: docker-compose logs -f
   ```

6. **To stop the application:**
   ```bash
   docker compose down
   # Or: docker-compose down
   ```

### Running Locally

```bash
# Install dependencies
npm install

# Setup database (if using Prisma)
npm run db:push

# Run development server
npm run dev
```

## 🐳 Docker Setup

This project includes a comprehensive Docker setup for secure, production-ready deployment:

### Features
- **Multi-stage build**: Minimized attack surface with separate build and runtime stages
- **Non-root execution**: Application runs as non-root user for enhanced security
- **Alpine Linux base**: Minimal base image for reduced vulnerabilities
- **Standalone output**: Next.js standalone build for minimal dependencies
- **Health checks**: Built-in health monitoring
- **Environment isolation**: Proper environment variable handling

### Docker Components
- `Dockerfile`: Multi-stage build configuration with security best practices
- `.dockerignore`: Security-focused file exclusion
- `docker-compose.yml`: Local development configuration with PostgreSQL
- `docker-compose.prod.yml`: Production-ready configuration with security enhancements
- `scripts/init-db.sh`: Database initialization script for restoring backup
- `DOCKER_SETUP.md`: Complete documentation for the Docker setup

### Production Deployment
For production deployments, use the Docker setup which provides:
- Isolated runtime environment
- Reduced attack surface
- Consistent deployment across environments
- Proper dependency management
- Security hardening

## 🔐 Security Features

- Authentication and authorization middleware
- JWT token-based sessions
- Secure environment variable handling
- Input validation and sanitization
- SQL injection prevention (via Prisma ORM)
- Containerized runtime environment

## 🛠️ Project Structure

- `app/` - Next.js 13+ App Router pages and API routes
- `components/` - React components
- `prisma/` - Database schema and migrations
- `public/` - Static assets
- `scripts/` - Utility scripts

## 📋 API Routes

The application provides extensive API functionality:
- Authentication and user management
- Financial accounting (charts of accounts, journal entries, transactions)
- Inventory management
- HR and payroll
- Asset and liability tracking
- Invoice and quotation management
- Subscription and billing
- Affiliate management

## 🚢 Deployment

### Docker-based Deployment
The recommended approach for production deployment is using Docker:

```bash
# Build production image
docker build -t insight-books .

# Run with environment variables
docker run -d \
  --name insight-books \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="your-secret" \
  -e JWT_SECRET="your-jwt-secret" \
  insight-books
```

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `JWT_SECRET`: Secret for JWT token signing
- `NODE_ENV`: Set to "production" for production environments
- `APP_URL`: Base URL of your application
## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Make your changes
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🚀 Running the Application

The application has been successfully configured with Docker and is ready to run:

1. **Install Docker Compose plugin:**
   ```bash
   sudo apt-get install docker-compose-plugin
   ```

2. **Start the application with the exact database configuration:**
   ```bash
   docker compose up --build
   ```
   
   The application will:
   - Start PostgreSQL with the database name `insightbooks`, user `henmik`, and password `Password2030`
   - Automatically restore data from `db/insightbooks_backup_12202025_2.dump`
   - Start the Next.js application connected to the database
   - Be available at `http://localhost:3000`

3. **For production deployment:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## 🔐 Authentication and Login Issues

If you're experiencing login issues where the login button shows "logging in" but doesn't redirect, this is likely due to a build-time vs runtime environment mismatch. This happens because:

- During Next.js build, the app tries to call `fetch('/api/auth/me')` with a relative URL
- At build time, there's no base URL context, causing the request to fail
- The app statically renders auth-dependent pages without proper authentication context

### Solution:

1. **Ensure APP_URL is consistent** in your docker-compose.yml:
   ```yaml
   environment:
     - APP_URL=http://213.165.230.139:3000  # Match the IP you're accessing
     - NEXT_PUBLIC_APP_URL=http://213.165.230.139:3000
   ```

2. **Rebuild the application** after making environment changes:
   ```bash
   docker compose down
   docker compose build app --no-cache
   docker compose up -d
   ```

3. **For developers**: The next.config.mjs has been updated to prevent static generation of auth-dependent pages during build time.

## � License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Security Considerations


This Docker setup was specifically designed after a previous server compromise to ensure:
- Isolated application runtime
- Minimal attack surface
- Non-root execution
- Proper dependency management
- Secure environment handling
- Network isolation