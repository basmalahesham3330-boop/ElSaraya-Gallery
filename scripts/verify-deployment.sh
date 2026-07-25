#!/bin/bash
# ================================================================
# ERP Backend - Deployment Verification Script
# ================================================================
# Runs comprehensive checks to verify deployment health
# ================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
}

check_pass() {
    echo -e "${GREEN}✓ $1${NC}"
    PASSED=$((PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗ $1${NC}"
    FAILED=$((FAILED + 1))
}

check_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# Start verification
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   ERP Backend Deployment Verification  ║"
echo "╔════════════════════════════════════════╗"
echo -e "${NC}"

# ================================================================
# 1. Docker Installation
# ================================================================
print_header "1. Docker Installation"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    check_pass "Docker installed (version $DOCKER_VERSION)"
else
    check_fail "Docker not installed"
fi

if command -v docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short)
    check_pass "Docker Compose installed (version $COMPOSE_VERSION)"
else
    check_fail "Docker Compose not installed"
fi

# ================================================================
# 2. Environment Configuration
# ================================================================
print_header "2. Environment Configuration"

if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check critical variables
    if grep -q "^APP_ENV=" .env; then
        APP_ENV=$(grep "^APP_ENV=" .env | cut -d '=' -f2)
        if [ "$APP_ENV" = "production" ]; then
            check_pass "APP_ENV set to production"
        else
            check_warning "APP_ENV is '$APP_ENV' (expected 'production')"
        fi
    else
        check_fail "APP_ENV not set in .env"
    fi
    
    if grep -q "^APP_DEBUG=" .env; then
        APP_DEBUG=$(grep "^APP_DEBUG=" .env | cut -d '=' -f2)
        if [ "$APP_DEBUG" = "false" ]; then
            check_pass "APP_DEBUG is false"
        else
            check_warning "APP_DEBUG is '$APP_DEBUG' (should be 'false' in production)"
        fi
    fi
    
    if grep -q "^POSTGRES_PASSWORD=" .env; then
        POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d '=' -f2)
        if [ "$POSTGRES_PASSWORD" = "erp_password" ] || [ "$POSTGRES_PASSWORD" = "CHANGE_THIS_SECURE_PASSWORD_IN_PRODUCTION" ]; then
            check_fail "Using default database password (SECURITY RISK!)"
        else
            check_pass "Custom database password set"
        fi
    else
        check_fail "POSTGRES_PASSWORD not set"
    fi
    
    if grep -q "^DATABASE_URL=" .env; then
        check_pass "DATABASE_URL configured"
    else
        check_fail "DATABASE_URL not set"
    fi
    
else
    check_fail ".env file not found"
fi

# ================================================================
# 3. Docker Services
# ================================================================
print_header "3. Docker Services"

if docker compose ps | grep -q "erp_postgres"; then
    check_pass "PostgreSQL container exists"
    
    if docker compose ps | grep "erp_postgres" | grep -q "running"; then
        check_pass "PostgreSQL container running"
        
        if docker compose ps | grep "erp_postgres" | grep -q "healthy"; then
            check_pass "PostgreSQL container healthy"
        else
            check_fail "PostgreSQL container unhealthy"
        fi
    else
        check_fail "PostgreSQL container not running"
    fi
else
    check_fail "PostgreSQL container not found"
fi

if docker compose ps | grep -q "erp_backend"; then
    check_pass "Backend container exists"
    
    if docker compose ps | grep "erp_backend" | grep -q "running"; then
        check_pass "Backend container running"
        
        if docker compose ps | grep "erp_backend" | grep -q "healthy"; then
            check_pass "Backend container healthy"
        else
            check_warning "Backend container not yet healthy (may still be starting)"
        fi
    else
        check_fail "Backend container not running"
    fi
else
    check_fail "Backend container not found"
fi

# ================================================================
# 4. Network Connectivity
# ================================================================
print_header "4. Network Connectivity"

if docker compose ps | grep "erp_backend" | grep -q "running"; then
    if docker compose exec -T backend curl -sf http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        check_pass "Backend health endpoint responding"
        
        # Check response content
        HEALTH_RESPONSE=$(docker compose exec -T backend curl -s http://localhost:8000/api/v1/health)
        if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
            check_pass "Health status is OK"
        else
            check_fail "Health status is not OK"
        fi
        
        if echo "$HEALTH_RESPONSE" | grep -q '"debug":false'; then
            check_pass "Debug mode is disabled"
        else
            check_warning "Debug mode appears to be enabled"
        fi
    else
        check_fail "Backend health endpoint not responding"
    fi
    
    # External connectivity
    if curl -sf http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        check_pass "Backend accessible from host"
    else
        check_fail "Backend not accessible from host on port 8000"
    fi
else
    check_warning "Skipping network tests (backend not running)"
fi

# ================================================================
# 5. Database
# ================================================================
print_header "5. Database"

if docker compose ps | grep "erp_postgres" | grep -q "running"; then
    if docker compose exec -T db pg_isready -U erp_user -d erp_db > /dev/null 2>&1; then
        check_pass "Database accepting connections"
    else
        check_fail "Database not accepting connections"
    fi
    
    # Check if database has tables
    TABLE_COUNT=$(docker compose exec -T db psql -U erp_user -d erp_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    if [ "$TABLE_COUNT" -gt 0 ]; then
        check_pass "Database has $TABLE_COUNT tables"
    else
        check_warning "Database has no tables (migrations may not have run)"
    fi
else
    check_warning "Skipping database tests (PostgreSQL not running)"
fi

# ================================================================
# 6. Migrations
# ================================================================
print_header "6. Migrations"

if docker compose ps | grep "erp_backend" | grep -q "running"; then
    if docker compose exec -T backend alembic current > /dev/null 2>&1; then
        MIGRATION_VERSION=$(docker compose exec -T backend alembic current 2>/dev/null | grep -v "INFO" | head -n 1)
        if [ ! -z "$MIGRATION_VERSION" ]; then
            check_pass "Migrations applied: $MIGRATION_VERSION"
        else
            check_warning "No migration version found"
        fi
    else
        check_fail "Unable to check migration status"
    fi
else
    check_warning "Skipping migration check (backend not running)"
fi

# ================================================================
# 7. Security
# ================================================================
print_header "7. Security"

# Check if .env is in .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "^\.env$" .gitignore; then
        check_pass ".env excluded from git"
    else
        check_fail ".env not in .gitignore (SECURITY RISK!)"
    fi
fi

# Check file permissions on .env
if [ -f ".env" ]; then
    ENV_PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null)
    if [ "$ENV_PERMS" = "600" ] || [ "$ENV_PERMS" = "400" ]; then
        check_pass ".env file has secure permissions ($ENV_PERMS)"
    else
        check_warning ".env file permissions are $ENV_PERMS (consider chmod 600 .env)"
    fi
fi

# ================================================================
# 8. Backup System
# ================================================================
print_header "8. Backup System"

if [ -d "backups" ]; then
    check_pass "Backup directory exists"
    
    BACKUP_COUNT=$(ls -1 backups/erp_backup_*.sql* 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        check_pass "Found $BACKUP_COUNT backup file(s)"
    else
        check_warning "No backups found (run scripts/backup.sh)"
    fi
else
    check_warning "Backup directory does not exist"
fi

if [ -f "scripts/backup.sh" ]; then
    if [ -x "scripts/backup.sh" ]; then
        check_pass "Backup script exists and is executable"
    else
        check_warning "Backup script exists but is not executable (chmod +x scripts/backup.sh)"
    fi
else
    check_fail "Backup script not found"
fi

# ================================================================
# Summary
# ================================================================
print_header "Verification Summary"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "${GREEN}Passed:   $PASSED${NC}"
echo -e "${RED}Failed:   $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo "Total:    $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ All checks passed successfully!    ║${NC}"
        echo -e "${GREEN}║  System is ready for production.      ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  ⚠ System operational with warnings   ║${NC}"
        echo -e "${YELLOW}║  Review warnings before production.    ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
        exit 0
    fi
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ Verification failed!                ║${NC}"
    echo -e "${RED}║  Fix issues before deploying.          ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    exit 1
fi
