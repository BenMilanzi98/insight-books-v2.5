# VPS Deployment Guide for Insight Books

This guide provides step-by-step instructions for deploying the Insight Books application on a VPS using Docker.

## Prerequisites

Before starting the deployment, ensure your VPS meets these requirements:
- Ubuntu 20.04 LTS or higher (or equivalent Linux distribution)
- At least 2GB RAM and 20GB disk space (2 GB: **do not** run `next build` on the VPS — see [VPS_2GB_BUILD.md](./VPS_2GB_BUILD.md))
- Root or sudo access
- Internet connection

## Step 1: Update System and Install Dependencies

First, update your system packages:

```bash
sudo apt update && sudo apt upgrade -y
```

Install necessary dependencies:

```bash
sudo apt install -y curl wget git unzip
```

## Step 2: Install Docker

Install Docker using the official script:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Add your user to the docker group to run Docker without sudo:

```bash
sudo usermod -aG docker $USER
```

**Note:** You'll need to log out and log back in for this change to take effect.

## Step 3: Install Docker Compose

Install Docker Compose plugin:

```bash
sudo apt install docker-compose-plugin
```

## Step 4: Clone the Repository

Clone the Insight Books repository:

```bash
git clone https://github.com/[your-username]/insight-books.git
cd insight-books
```

**Note:** Replace `[your-username]` with your actual GitHub username or repository URL.

## Step 5: Verify and Update the Environment Configuration

The repository includes a `.env` file with all necessary environment variables. Review and update it to ensure it matches your VPS requirements:

```bash
cat .env
```

The database configuration should look like this:
- Database URL: `postgresql://henmik:Password2030@localhost:5432/insightbooks?schema=public`
- Database name: `insightbooks`
- Username: `henmik`
- Password: `Password2030`

**Important**: Before building the application, you need to update the APP_URL in the docker-compose.yml file to match your VPS IP address:

```bash
# Edit docker-compose.yml and change:
# APP_URL=http://localhost:3000
# to:
# APP_URL=http://YOUR_VPS_IP:3000
```

This is critical for the authentication flow to work properly.

## Step 6: Build and Run the Application

Build and start the application with Docker Compose:

```bash
docker compose up --build
```

This command will:
1. Build the Docker images for the application
2. Start the PostgreSQL database container
3. Automatically initialize the database from the backup file `db/insightbooks_backup_12202025_2.dump`
4. Start the Next.js application container
5. Connect both services together

## Step 7: Verify the Deployment

Wait for the containers to start completely. You can monitor the logs with:

```bash
docker compose logs -f
```

The application should be accessible at:
- `http://YOUR_VPS_IP:3000` (replace YOUR_VPS_IP with your actual VPS IP address)

## Step 8: Run in Background (Production)

To run the application in the background, use:

```bash
docker compose up --build -d
```

## Step 9: Database Import Process (Automatic)

The database import happens automatically during the first startup:

1. PostgreSQL container starts and initializes
2. The backup file `db/insightbooks_backup_12202025_2.dump` is automatically imported
3. The initialization script `scripts/init-db.sh` runs to restore the data
4. Once the database is ready, the application container starts
5. The application connects to the initialized database

## Step 10: Management Commands

### Check running containers:
```bash
docker compose ps
```

### View logs:
```bash
docker compose logs -f
```

### Stop the application:
```bash
docker compose down
```

### Restart the application:
```bash
docker compose restart
```

### Update the application:
```bash
git pull
docker compose down
docker compose up --build -d
```

## Production Deployment

For production use, consider using the production Docker Compose file:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This configuration includes additional security measures such as:
- No new privileges for containers
- Read-only filesystem for the application
- Temporary filesystem for sensitive directories

## Troubleshooting

### If the application fails to start:
1. Check the logs: `docker compose logs`
2. Verify Docker is running: `sudo systemctl status docker`
3. Ensure sufficient disk space: `df -h`

### If the database doesn't initialize:
1. Check if the backup file exists: `ls -la db/`
2. Verify database logs: `docker compose logs db`
3. Make sure the init script has proper permissions

### If you can't access the application:
1. Check firewall settings: `sudo ufw status`
2. Verify the port is open: `netstat -tlnp | grep 3000`
3. Confirm the application is running: `docker compose ps`

## Security Considerations

1. **Environment Variables**: The `.env` file contains sensitive information. Ensure proper file permissions.
2. **Database**: The database runs in a container with the credentials specified in the `.env` file.
3. **Network**: Docker Compose creates an isolated network for the services.
4. **Updates**: Regularly update the system and Docker images.

## Backup and Maintenance

### Database Backup
To create a backup of your database:
```bash
docker exec -t insight-books-db pg_dump -U henmik insightbooks > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Docker Cleanup
To free up space from unused Docker objects:
```bash
docker system prune -a
```

## Next Steps

1. Configure a reverse proxy (like Nginx) to serve the application on standard ports (80/443)
2. Set up SSL certificates using Let's Encrypt
3. Configure firewall rules to restrict access
4. Set up monitoring and alerting
5. Implement regular backup procedures

## Support

If you encounter any issues during the deployment process, please check:
- The logs using `docker compose logs`
- The documentation files in the repository
- Docker and system documentation

This deployment provides a secure, containerized version of Insight Books with automatic database initialization from the provided backup file.