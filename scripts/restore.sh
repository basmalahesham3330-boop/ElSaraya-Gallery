#!/bin/bash
# ================================================================
# ERP Backend - Database Restore Script
# ================================================================
# Usage: ./scripts/restore.sh <backup_file>
# 
# Restores the PostgreSQL database from a backup file.
# WARNING: This will stop the backend service during restoration.
# ================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}ERROR: No backup file specified!${NC}"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/erp_backup_*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}ERP Database Restore${NC}"
echo -e "${YELLOW}======================================${NC}"
echo -e "${RED}WARNING: This will replace all current data!${NC}"
echo -e "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Restore cancelled.${NC}"
    exit 0
fi

# Check if Docker Compose services are running
if ! docker compose ps | grep -q "erp_postgres.*running"; then
    echo -e "${RED}ERROR: PostgreSQL container is not running!${NC}"
    echo "Start it with: docker compose up -d db"
    exit 1
fi

# Stop backend to prevent connections
echo -e "${YELLOW}Stopping backend service...${NC}"
docker compose stop backend

# Restore database
echo -e "${YELLOW}Restoring database...${NC}"
if gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U erp_user -d erp_db > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Restore failed!${NC}"
    echo -e "${YELLOW}Starting backend service...${NC}"
    docker compose start backend
    exit 1
fi

# Start backend
echo -e "${YELLOW}Starting backend service...${NC}"
docker compose start backend

# Wait for backend to be healthy
echo -e "${YELLOW}Waiting for backend to be healthy...${NC}"
sleep 5

MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}Warning: Backend health check timed out${NC}"
    echo "Check logs with: docker compose logs backend"
fi

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Restore completed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
