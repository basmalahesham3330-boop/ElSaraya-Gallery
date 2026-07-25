# ERP Backend - Deployment Guide

This guide covers deploying the ERP Backend system using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Installation](#installation)
- [Database Migrations](#database-migrations)
- [Health Checks](#health-checks)
- [Backup and Restore](#backup-and-restore)
- [Updates and Maintenance](#updates-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Prerequisites

### Required Software

- **Docker Engine**: 20.10.0 or later
- **Docker Compose**: 2.0.0 or later (V2 syntax)
- **Git**: For cloning the repository
- **Minimum System Requirements**:
  - CPU: 2 cores
  - RAM: 4GB
  - Disk: 20GB available space

### Verify Installation

```bash
docker --version
docker compose version
```

---

## Quick Start

For a rapid production deployment:

```bash
# 1. Clone the repository
git clone <repository-url>
cd backend

# 2. Create environment file
cp .env.example .env

# 3. Edit .env with production values
# IMPORTANT: Change POSTGRES_PASSWORD and update DATABASE_URL/DATABASE_URL_SYNC
nano .env

# 4. Build and start services
docker compose up -d

# 5. Verify health
docker compose ps
curl http://localhost:8000/api/v1/health
```

---

## Environment Configuration

### Creating Production .env

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. **CRITICAL**: Update these values in `.env`:

   ```bash
   # Change environment to production
   APP_ENV=production
   APP_DEBUG=false

   # Set a strong database password (minimum 16 characters)
   POSTGRES_PASSWORD=YourSecurePasswordHere123456

   # Update database URLs with the new password
   DATABASE_URL=postgresql+asyncpg://erp_user:YourSecurePasswordHere123456@db:5432/erp_db
   DATABASE_URL_SYNC=postgresql+psycopg://erp_user:YourSecurePasswordHere123456@db:5432/erp_db

   # Configure CORS for your frontend domain
   CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
   ```

3. **Optional**: Customize ports if needed:
   ```bash
   PORT=8000
   POSTGRES_PORT=5432
   ```

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `APP_NAME` | Application name | ERP Backend | No |
| `APP_ENV` | Environment (development/production) | production | Yes |
| `APP_DEBUG` | Debug mode | false | Yes |
| `API_V1_PREFIX` | API route prefix | /api/v1 | No |
| `POSTGRES_USER` | Database username | erp_user | Yes |
| `POSTGRES_PASSWORD` | Database password | - | **Yes** |
| `POSTGRES_DB` | Database name | erp_db | Yes |
| `POSTGRES_HOST` | Database host | db | Yes |
| `POSTGRES_PORT` | Database port | 5432 | Yes |
| `DATABASE_URL` | Async connection string | - | Yes |
| `DATABASE_URL_SYNC` | Sync connection string (migrations) | - | Yes |
| `HOST` | Server bind address | 0.0.0.0 | No |
| `PORT` | Server port | 8000 | No |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | http://localhost:3000 | No |

---

## Installation

### Production Deployment

```bash
# Clean build from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d

# View logs
docker compose logs -f
```

### Development Deployment

For local development with hot-reload:

```bash
# Use development override
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker compose logs -f backend
```

### Verify Services

```bash
# Check container status
docker compose ps

# Should show:
# - erp_postgres (healthy)
# - erp_backend (healthy)
```

### Check Health Endpoints

```bash
# Backend health check
curl http://localhost:8000/api/v1/health

# Expected response:
# {"status":"ok","environment":"production","debug":false}
```

---

## Database Migrations

Migrations run automatically on container startup via the `entrypoint.sh` script.

### Manual Migration Commands

If you need to run migrations manually:

```bash
# Enter backend container
docker compose exec backend bash

# Run migrations
alembic upgrade head

# Check current migration version
alembic current

# Create new migration (for development)
alembic revision --autogenerate -m "Description of changes"
```

### Migration Troubleshooting

```bash
# View migration history
docker compose exec backend alembic history

# Rollback one migration
docker compose exec backend alembic downgrade -1

# Rollback to specific version
docker compose exec backend alembic downgrade <revision_id>
```

---

## Health Checks

### Service Health Status

```bash
# Check all services
docker compose ps

# Check backend health
docker compose exec backend curl -f http://localhost:8000/api/v1/health

# Check database health
docker compose exec db pg_isready -U erp_user -d erp_db
```

### Health Check Configuration

- **Database**: Checks every 10 seconds
- **Backend**: Checks every 30 seconds with 40-second startup grace period

---

## Backup and Restore

### Database Backup

#### Create Backup

```bash
# Backup to file with timestamp
docker compose exec db pg_dump -U erp_user -d erp_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose exec db pg_dump -U erp_user -d erp_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/erp_backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR
docker compose exec -T db pg_dump -U erp_user -d erp_db | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "erp_backup_*.sql.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
```

Make it executable:
```bash
chmod +x backup.sh
```

#### Schedule with Cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/backend && ./backup.sh >> ./backups/backup.log 2>&1
```

### Database Restore

#### Restore from Backup

```bash
# Stop the backend to prevent connections
docker compose stop backend

# Restore uncompressed backup
cat backup_20260723.sql | docker compose exec -T db psql -U erp_user -d erp_db

# Restore compressed backup
gunzip -c backup_20260723.sql.gz | docker compose exec -T db psql -U erp_user -d erp_db

# Start the backend
docker compose start backend
```

#### Restore to Clean Database

```bash
# Complete reset and restore
docker compose down
docker volume rm backend_erp_postgres_data
docker compose up -d db

# Wait for database to be ready
sleep 10

# Restore backup
gunzip -c backup_20260723.sql.gz | docker compose exec -T db psql -U erp_user -d erp_db

# Start backend
docker compose up -d backend
```

---

## Updates and Maintenance

### Application Updates

```bash
# 1. Pull latest code
git pull origin main

# 2. Stop services
docker compose down

# 3. Rebuild with latest changes
docker compose build --no-cache

# 4. Start services (migrations run automatically)
docker compose up -d

# 5. Verify health
docker compose ps
curl http://localhost:8000/api/v1/health
```

### Update Docker Images

```bash
# Update base images
docker compose pull

# Rebuild and restart
docker compose up -d --build
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f db

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
```

### Clean Up

```bash
# Remove stopped containers
docker compose down

# Remove containers and volumes (WARNING: deletes data)
docker compose down -v

# Remove unused images
docker image prune -a
```

---

## Troubleshooting

### Backend Won't Start

**Symptom**: Backend container exits immediately

**Solutions**:

1. Check logs:
   ```bash
   docker compose logs backend
   ```

2. Verify environment variables:
   ```bash
   docker compose exec backend env | grep -E '(DATABASE_URL|APP_)'
   ```

3. Check database connectivity:
   ```bash
   docker compose exec backend python -c "from app.core.config import settings; print(settings.DATABASE_URL)"
   ```

4. Test database connection manually:
   ```bash
   docker compose exec db psql -U erp_user -d erp_db -c "SELECT version();"
   ```

### Database Connection Errors

**Symptom**: "could not connect to server" or "password authentication failed"

**Solutions**:

1. Verify DATABASE_URL matches POSTGRES_PASSWORD:
   ```bash
   cat .env | grep -E '(POSTGRES_PASSWORD|DATABASE_URL)'
   ```

2. Recreate database container:
   ```bash
   docker compose stop db
   docker volume rm backend_erp_postgres_data
   docker compose up -d db
   ```

3. Check database is healthy:
   ```bash
   docker compose exec db pg_isready -U erp_user
   ```

### Migration Failures

**Symptom**: "Target database is not up to date" or migration errors

**Solutions**:

1. Check current migration status:
   ```bash
   docker compose exec backend alembic current
   docker compose exec backend alembic history
   ```

2. Try upgrading manually:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

3. If migrations are corrupted, stamp current version:
   ```bash
   docker compose exec backend alembic stamp head
   ```

### Port Already in Use

**Symptom**: "port is already allocated"

**Solutions**:

1. Find process using the port:
   ```bash
   # Linux/Mac
   lsof -i :8000
   
   # Windows
   netstat -ano | findstr :8000
   ```

2. Stop conflicting service or change port in `.env`:
   ```bash
   PORT=8001
   ```

3. Restart with new port:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Container Health Check Failing

**Symptom**: Container shows "unhealthy" status

**Solutions**:

1. Check health endpoint manually:
   ```bash
   docker compose exec backend curl -v http://localhost:8000/api/v1/health
   ```

2. Increase health check timeout in `docker-compose.yml`:
   ```yaml
   healthcheck:
     start_period: 60s  # Give more time for startup
   ```

3. View detailed logs:
   ```bash
   docker compose logs --tail=200 backend
   ```

### Out of Disk Space

**Symptom**: "no space left on device"

**Solutions**:

1. Check Docker disk usage:
   ```bash
   docker system df
   ```

2. Clean up unused resources:
   ```bash
   docker system prune -a --volumes
   ```

3. Remove old images:
   ```bash
   docker image prune -a --filter "until=720h"
   ```

---

## Security Considerations

### Production Checklist

- [ ] Set strong `POSTGRES_PASSWORD` (minimum 16 characters, mixed case, numbers, symbols)
- [ ] Set `APP_DEBUG=false` in production
- [ ] Set `APP_ENV=production`
- [ ] Configure `CORS_ORIGINS` with actual frontend domain(s)
- [ ] Never commit `.env` file to version control
- [ ] Use Docker secrets or vault for sensitive data in production
- [ ] Enable firewall and restrict ports (only 8000 publicly accessible)
- [ ] Use HTTPS/TLS with reverse proxy (nginx, traefik)
- [ ] Regularly update Docker images and dependencies
- [ ] Enable log rotation to prevent disk filling
- [ ] Set up monitoring and alerting
- [ ] Implement automated backups with off-site storage
- [ ] Review and rotate credentials regularly

### Network Security

```yaml
# Recommended: External reverse proxy setup
# Don't expose PostgreSQL port externally
services:
  db:
    ports: [] # Remove port mapping in production
```

### Using Docker Secrets (Optional)

For enhanced security, use Docker secrets:

```yaml
# docker-compose.yml
services:
  db:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
```

---

## Monitoring and Logs

### Log Management

```bash
# Configure log rotation in docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Health Monitoring

Set up external monitoring to check:
- `http://your-domain.com/api/v1/health` returns 200 OK
- Database connectivity
- Container health status

---

## Support

For issues and questions:
- Check logs: `docker compose logs`
- Review this troubleshooting guide
- Check application documentation
- Contact system administrator

---

**Last Updated**: 2026-07-23
**Version**: 1.0.0
