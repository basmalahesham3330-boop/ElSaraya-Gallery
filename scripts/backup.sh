#!/bin/bash
# ================================================================
# ERP Backend - Database Backup Script
# ================================================================
# Usage: ./scripts/backup.sh
# 
# Creates a compressed backup of the PostgreSQL database with
# timestamp in the filename. Automatically cleans up backups
# older than 7 days.
# ================================================================

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/erp_backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=7

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}ERP Database Backup${NC}"
echo -e "${GREEN}======================================${NC}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if Docker Compose services are running
if ! docker compose ps | grep -q "erp_postgres.*running"; then
    echo -e "${RED}ERROR: PostgreSQL container is not running!${NC}"
    echo "Start it with: docker compose up -d db"
    exit 1
fi

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
if docker compose exec -T db pg_dump -U erp_user -d erp_db | gzip > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    echo -e "  File: $BACKUP_FILE"
    echo -e "  Size: $BACKUP_SIZE"
else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi

# Clean up old backups
echo -e "${YELLOW}Cleaning up old backups (older than $RETENTION_DAYS days)...${NC}"
DELETED_COUNT=$(find "$BACKUP_DIR" -name "erp_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)

if [ "$DELETED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Removed $DELETED_COUNT old backup(s)${NC}"
else
    echo -e "${YELLOW}No old backups to remove${NC}"
fi

# List current backups
echo -e "${YELLOW}Current backups:${NC}"
ls -lh "$BACKUP_DIR"/erp_backup_*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
