#!/bin/bash
# ERP Backend Entrypoint Script
# Handles database migrations and starts the application
# Compatible with both Docker Compose and Railway

set -e

echo "=========================================="
echo "ERP Backend Starting..."
echo "Environment: ${APP_ENV:-production}"
echo "=========================================="

# Function to check database connectivity
# Works with both Docker Compose (individual vars) and Railway (DATABASE_URL)
check_database() {
    if [ -n "$DATABASE_URL" ]; then
        # Railway or explicit DATABASE_URL provided
        # Parse DATABASE_URL: postgresql://user:pass@host:port/db
        
        # Extract host (everything between @ and : or /)
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\).*/\1/p')
        
        # Extract port (number after last : and before /)
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        
        # Extract user (between :// and :, handles postgresql+asyncpg:// etc.)
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        
        # If parsing failed, try alternative approach
        if [ -z "$DB_HOST" ]; then
            DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\(.*\):\([0-9]*\).*/\1/p')
        fi
        
        if [ -z "$DB_PORT" ]; then
            DB_PORT="5432"  # Default PostgreSQL port
        fi
        
        echo "Database check: Using DATABASE_URL"
        echo "  Host: $DB_HOST"
        echo "  Port: $DB_PORT"
        echo "  User: $DB_USER"
        
        pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"
    else
        # Docker Compose with individual environment variables
        echo "Database check: Using POSTGRES_* variables"
        echo "  Host: ${POSTGRES_HOST}"
        echo "  Port: ${POSTGRES_PORT}"
        echo "  User: ${POSTGRES_USER}"
        
        pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"
    fi
}

# Wait for database to be ready with retry logic
echo "Waiting for PostgreSQL to be ready..."

MAX_RETRIES=30
RETRY_COUNT=0

until check_database; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "=========================================="
        echo "ERROR: Database connection failed!"
        echo "Attempted $MAX_RETRIES times without success."
        echo "=========================================="
        echo "Debug Information:"
        echo "  DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"
        echo "  POSTGRES_HOST: ${POSTGRES_HOST:-not set}"
        echo "  POSTGRES_PORT: ${POSTGRES_PORT:-not set}"
        echo "  POSTGRES_USER: ${POSTGRES_USER:-not set}"
        echo "=========================================="
        exit 1
    fi
    
    echo "PostgreSQL is unavailable - sleeping (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "PostgreSQL is up - continuing..."

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo "Migrations completed successfully"
else
    echo "ERROR: Migrations failed!"
    exit 1
fi

# Start the application
echo "Starting application server..."
echo "=========================================="

# Use Railway's dynamic PORT if set, otherwise default to 8000
APP_PORT="${PORT:-8000}"
echo "Binding to port: $APP_PORT"

exec uvicorn app.main:app --host 0.0.0.0 --port "$APP_PORT"
