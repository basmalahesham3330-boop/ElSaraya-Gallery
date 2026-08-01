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

    DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
    DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')

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
echo "Host : ${DB_HOST:-<EMPTY>}"
echo "Port : ${DB_PORT:-<EMPTY>}"
echo "User : ${DB_USER:-<EMPTY>}"
echo "DATABASE_URL Present : $([ -n "${DATABASE_URL}" ] && echo YES || echo NO)"
echo "POSTGRES_HOST        : ${POSTGRES_HOST:-<EMPTY>}"
echo "POSTGRES_PORT        : ${POSTGRES_PORT:-<EMPTY>}"
echo "POSTGRES_USER        : ${POSTGRES_USER:-<EMPTY>}"
echo "====================================="
echo ""

# Validate configuration
if [ -z "$DB_HOST" ]; then
    echo "[ERROR] Database host is empty."
    exit 1
fi

if [ -z "$DB_USER" ]; then
    echo "[ERROR] Database user is empty."
    exit 1
fi

# ---------------------------------------------------------
# Wait for PostgreSQL
# ---------------------------------------------------------

echo "Waiting for PostgreSQL..."

MAX_RETRIES=30
COUNT=0

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do

    COUNT=$((COUNT+1))

    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo ""
        echo "[ERROR] PostgreSQL never became ready."
        exit 1
    fi

    echo "Retry $COUNT/$MAX_RETRIES..."
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