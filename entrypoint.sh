#!/bin/bash
# ERP Backend Entrypoint Script
# Handles database migrations and starts the application

set -e

echo "=========================================="
echo "ERP Backend Starting..."
echo "Environment: ${APP_ENV:-production}"
echo "=========================================="

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; do
  echo "PostgreSQL is unavailable - sleeping"
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
exec "$@"
