#!/bin/bash
set -e

echo "=========================================="
echo "ERP Backend Starting..."
echo "Environment: ${APP_ENV:-production}"
echo "=========================================="

# ---------------------------------------------------------
# Determine database connection
# Railway -> DATABASE_URL
# Docker Compose -> POSTGRES_* variables
# ---------------------------------------------------------

if [ -n "${DATABASE_URL}" ]; then
    echo "[INFO] Using DATABASE_URL"

    # Strip async driver prefix if present (e.g. postgresql+asyncpg:// -> postgresql://)
    CLEAN_URL=$(echo "$DATABASE_URL" | sed 's|+[a-zA-Z0-9]*://|://|')

    DB_HOST=$(echo "$CLEAN_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
    DB_PORT=$(echo "$CLEAN_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
    DB_USER=$(echo "$CLEAN_URL" | sed -E 's|.*://([^:@]+)[@:].*|\1|')

else
    echo "[INFO] Using POSTGRES_* variables"

    DB_HOST="${POSTGRES_HOST}"
    DB_PORT="${POSTGRES_PORT}"
    DB_USER="${POSTGRES_USER}"
fi

# Default postgres port if missing
if [ -z "$DB_PORT" ]; then
    DB_PORT=5432
fi

echo ""
echo "========== DATABASE CONFIG =========="
echo "Host                 : ${DB_HOST:-<EMPTY>}"
echo "Port                 : ${DB_PORT:-<EMPTY>}"
echo "User                 : ${DB_USER:-<EMPTY>}"
echo "DATABASE_URL Present : $([ -n "${DATABASE_URL}" ] && echo YES || echo NO)"
echo "POSTGRES_HOST        : ${POSTGRES_HOST:-<EMPTY>}"
echo "POSTGRES_PORT        : ${POSTGRES_PORT:-<EMPTY>}"
echo "POSTGRES_USER        : ${POSTGRES_USER:-<EMPTY>}"
echo "====================================="
echo ""

# Validate configuration
if [ -z "$DB_HOST" ]; then
    echo "[ERROR] Database host is empty. Check DATABASE_URL or POSTGRES_HOST."
    exit 1
fi

if [ -z "$DB_USER" ]; then
    echo "[ERROR] Database user is empty. Check DATABASE_URL or POSTGRES_USER."
    exit 1
fi

# ---------------------------------------------------------
# Wait for PostgreSQL
# ---------------------------------------------------------

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."

MAX_RETRIES=30
COUNT=0

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do

    COUNT=$((COUNT+1))

    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo ""
        echo "[ERROR] PostgreSQL never became ready after $MAX_RETRIES retries."
        echo "[ERROR] Last attempted host: ${DB_HOST}:${DB_PORT} user: ${DB_USER}"
        exit 1
    fi

    echo "  Retry $COUNT/$MAX_RETRIES - PostgreSQL not ready yet, waiting 2s..."
    sleep 2

done

echo ""
echo "PostgreSQL is ready."
echo ""

# ---------------------------------------------------------
# Run migrations
# ---------------------------------------------------------

echo "Running Alembic migrations..."

alembic upgrade head

echo "Migrations completed."

# ---------------------------------------------------------
# Start application
# ---------------------------------------------------------

APP_PORT="${PORT:-8000}"

echo ""
echo "=========================================="
echo "Starting Uvicorn"
echo "Port: $APP_PORT"
echo "=========================================="

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "$APP_PORT"
