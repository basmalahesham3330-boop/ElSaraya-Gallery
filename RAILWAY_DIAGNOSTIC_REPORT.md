# Railway PostgreSQL Connection Diagnostic Report

## Executive Summary

Your FastAPI backend **CANNOT connect to Railway PostgreSQL** because it's configured for Docker Compose with hardcoded hostname `db` instead of using Railway's provided environment variables.

**Critical Issues Found:**
1. ❌ Hardcoded `POSTGRES_HOST=db` (Docker hostname)
2. ❌ `DATABASE_URL` uses hardcoded values instead of Railway variables
3. ❌ `entrypoint.sh` uses individual POSTGRES_* variables not provided by Railway
4. ❌ No Railway-specific configuration file
5. ❌ Missing proper fallback logic for Railway's `DATABASE_URL` format

---

## 1. Database Configuration

### File: `app/core/config.py` (Lines 28-40)

```python
# Database
POSTGRES_USER: str = "erp_user"
POSTGRES_PASSWORD: str = "erp_password"
POSTGRES_DB: str = "erp_db"
POSTGRES_HOST: str = "db"  # ❌ PROBLEM: Hardcoded Docker hostname
POSTGRES_PORT: int = 5432

DATABASE_URL: str = (
    "postgresql+asyncpg://erp_user:erp_password@db:5432/erp_db"
)  # ❌ PROBLEM: Hardcoded default URL
DATABASE_URL_SYNC: str = (
    "postgresql+psycopg://erp_user:erp_password@db:5432/erp_db"
)  # ❌ PROBLEM: Hardcoded default URL
```

**Problems:**
- These default values point to `db` (Docker Compose service name)
- Railway provides a `DATABASE_URL` in PostgreSQL format, not individual components
- Railway's `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`
- Your app expects: `postgresql+asyncpg://...` (async) and `postgresql+psycopg://...` (sync)

**How Settings Are Loaded:**
- Uses Pydantic Settings with `.env` file support
- Environment variables override defaults
- No code transforms Railway's URL to the required formats

---

## 2. SQLAlchemy Engine

### File: `app/db/session.py` (Lines 23-27)

```python
engine = create_async_engine(
    settings.DATABASE_URL,  # ❌ Uses the hardcoded default or .env value
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
)
```

**Problems:**
- Reads `settings.DATABASE_URL` which defaults to `@db:5432`
- No transformation of Railway's `DATABASE_URL` environment variable
- Railway provides: `postgresql://...`
- Code expects: `postgresql+asyncpg://...`

**No retry logic** in the engine creation itself (relies on entrypoint.sh)

---

## 3. Database Drivers

### File: `requirements.txt`

```txt
asyncpg==0.30.0        # ✅ Correct async driver
psycopg[binary]==3.2.3 # ✅ Correct sync driver (psycopg3)
```

**Status:** ✅ **Drivers are CORRECT**

- `asyncpg` for async SQLAlchemy (`postgresql+asyncpg://`)
- `psycopg` (version 3) for sync operations (`postgresql+psycopg://`)

**Not the problem** - drivers are properly installed.

---

## 4. Startup Process

### File: `entrypoint.sh` (Lines 13-18)

```bash
# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
```

**Critical Problems:**
1. ❌ Uses `${POSTGRES_HOST}` - **Railway does NOT provide this variable**
2. ❌ Uses `${POSTGRES_PORT}` - **Railway does NOT provide this variable**
3. ❌ Uses `${POSTGRES_USER}` - **Railway does NOT provide this variable**
4. ❌ Railway only provides `DATABASE_URL` in the format: `postgresql://user:pass@host.railway.internal:port/dbname`

**This is why you see "PostgreSQL is unavailable - sleeping" in logs:**
- `pg_isready` is trying to connect to `db` (undefined → defaults to localhost or fails)
- The actual Railway database is at `host.railway.internal` (or public endpoint)
- The script never succeeds and loops forever (or times out)

---

## 5. Railway Environment Variables

### What Railway Provides:

Railway PostgreSQL plugin provides **ONE variable**:

```bash
DATABASE_URL=postgresql://postgres:password@host.railway.internal:5432/railway
```

Railway does **NOT** provide:
- ❌ `POSTGRES_HOST`
- ❌ `POSTGRES_PORT`
- ❌ `POSTGRES_USER`
- ❌ `POSTGRES_PASSWORD`
- ❌ `POSTGRES_DB`

### What Your Code Expects:

From `.env` (Lines 23-31):
```bash
POSTGRES_USER=erp_user
POSTGRES_PASSWORD=mvP-*cIyE?HA346BXDw8iWqd
POSTGRES_DB=erp_db
POSTGRES_HOST=db                    # ❌ Docker-specific
POSTGRES_PORT=5432
```

From `.env` (Lines 34-40):
```bash
DATABASE_URL=postgresql+asyncpg://erp_user:mvP-*cIyE?HA346BXDw8iWqd@db:5432/erp_db
DATABASE_URL_SYNC=postgresql+psycopg://erp_user:mvP-*cIyE?HA346BXDw8iWqd@db:5432/erp_db
```

### Current Usage in Codebase:

| Variable | File | Line | Usage |
|----------|------|------|-------|
| `DATABASE_URL` | `app/db/session.py` | 23 | ✅ Used for SQLAlchemy engine |
| `DATABASE_URL_SYNC` | `alembic/env.py` | 34 | ✅ Used for migrations |
| `POSTGRES_HOST` | `entrypoint.sh` | 14 | ❌ Used in pg_isready check |
| `POSTGRES_PORT` | `entrypoint.sh` | 14 | ❌ Used in pg_isready check |
| `POSTGRES_USER` | `entrypoint.sh` | 14 | ❌ Used in pg_isready check |
| `POSTGRES_USER` | `docker-compose.yml` | 9 | Docker only |
| `POSTGRES_PASSWORD` | `docker-compose.yml` | 10 | Docker only |
| `POSTGRES_DB` | `docker-compose.yml` | 11 | Docker only |

---

## 6. Docker Configuration

### File: `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: erp_postgres  # ❌ This creates hostname "db" in Docker network
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
```

**Why "db" hostname exists:**
- Docker Compose creates internal DNS
- Service name `db` becomes hostname on `erp_network`
- Backend can connect to `db:5432` in Docker Compose
- **This does NOT exist on Railway**

### File: `Dockerfile`

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
        postgresql-client \  # ✅ Required for pg_isready
```

- Dockerfile itself is Railway-compatible
- Problem is the entrypoint script logic

---

## 7. Potential Problems Summary

### Problem 1: Hostname Resolution Failure ❌
**Severity: CRITICAL**

```python
# config.py default
POSTGRES_HOST: str = "db"
```

- Railway database is NOT at hostname `db`
- Railway uses internal hostname like `postgres.railway.internal` or public endpoint
- Connection fails immediately

### Problem 2: URL Format Mismatch ❌
**Severity: CRITICAL**

Railway provides:
```
DATABASE_URL=postgresql://postgres:password@host:port/db
```

Your app needs:
```
DATABASE_URL=postgresql+asyncpg://postgres:password@host:port/db
DATABASE_URL_SYNC=postgresql+psycopg://postgres:password@host:port/db
```

**No transformation logic exists** to convert Railway's format.

### Problem 3: Missing Environment Variables in entrypoint.sh ❌
**Severity: CRITICAL**

```bash
pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"
```

Railway doesn't provide these variables, so:
- `POSTGRES_HOST` is empty → defaults to localhost or errors
- `POSTGRES_PORT` is empty → uses default 5432 on wrong host
- `POSTGRES_USER` is empty → uses process user or errors

### Problem 4: Hardcoded Defaults in config.py ❌
**Severity: HIGH**

```python
DATABASE_URL: str = (
    "postgresql+asyncpg://erp_user:erp_password@db:5432/erp_db"
)
```

If Railway's `DATABASE_URL` is not properly set, it falls back to Docker values.

### Problem 5: No Railway Configuration ❌
**Severity: MEDIUM**

No `railway.json` or `railway.toml` file to configure:
- Build command
- Start command
- Health check path
- Environment variable requirements

### Problem 6: SSL/TLS Requirement ❌
**Severity: MEDIUM**

Railway PostgreSQL **requires SSL connections** in production.

Your SQLAlchemy engine:
```python
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
    # ❌ Missing: connect_args={"ssl": "require"}
)
```

### Problem 7: Connection Pool Configuration ⚠️
**Severity: LOW**

Default pool settings may not be optimal for Railway's connection limits.

---

## 8. Recommended Fixes

### Fix 1: Update `app/core/config.py` (CRITICAL)

**File:** `app/core/config.py`

Replace the entire database configuration section:

```python
# Database
POSTGRES_USER: str = "erp_user"
POSTGRES_PASSWORD: str = "erp_password"
POSTGRES_DB: str = "erp_db"
POSTGRES_HOST: str = "db"
POSTGRES_PORT: int = 5432

# Railway provides DATABASE_URL in format: postgresql://user:pass@host:port/db
# We need to transform it to: postgresql+asyncpg://... and postgresql+psycopg://...
_railway_database_url: str | None = None

try:
    import os
    _railway_database_url = os.getenv("DATABASE_URL")
except Exception:
    pass

# If Railway DATABASE_URL exists, transform it
if _railway_database_url and _railway_database_url.startswith("postgresql://"):
    # Replace postgresql:// with postgresql+asyncpg:// for async
    DATABASE_URL: str = _railway_database_url.replace(
        "postgresql://", "postgresql+asyncpg://", 1
    )
    # Replace postgresql:// with postgresql+psycopg:// for sync (migrations)
    DATABASE_URL_SYNC: str = _railway_database_url.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
else:
    # Docker Compose fallback (local development)
    DATABASE_URL: str = (
        "postgresql+asyncpg://erp_user:erp_password@db:5432/erp_db"
    )
    DATABASE_URL_SYNC: str = (
        "postgresql+psycopg://erp_user:erp_password@db:5432/erp_db"
    )
```

**Why this works:**
- Detects Railway's `DATABASE_URL` environment variable
- Transforms `postgresql://` to required driver formats
- Keeps Docker Compose compatibility for local development
- Pydantic Settings will still allow override via explicit env vars

---

### Fix 2: Update `app/db/session.py` (CRITICAL)

**File:** `app/db/session.py`

Add SSL support for Railway:

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Determine connection arguments based on environment
connect_args = {}
if settings.APP_ENV == "production" and "railway" in settings.DATABASE_URL.lower():
    # Railway requires SSL
    connect_args = {"ssl": "require"}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
    connect_args=connect_args,
    # Optional: Optimize for Railway connection limits
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600,
)
```

**Why this is necessary:**
- Railway PostgreSQL requires SSL in production
- Prevents "SSL required" connection errors
- Optimizes connection pooling for cloud environment

---

### Fix 3: Update `entrypoint.sh` (CRITICAL)

**File:** `entrypoint.sh`

Replace the pg_isready check to handle both Docker and Railway:

```bash
#!/bin/bash
# ERP Backend Entrypoint Script
# Handles database migrations and starts the application

set -e

echo "=========================================="
echo "ERP Backend Starting..."
echo "Environment: ${APP_ENV:-production}"
echo "=========================================="

# Wait for database to be ready
echo "Checking database connectivity..."

# Function to check database with Railway support
check_database() {
    # If DATABASE_URL is provided (Railway), parse it
    if [ -n "$DATABASE_URL" ]; then
        # Extract components from DATABASE_URL
        # Format: postgresql://user:pass@host:port/db
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\(.*\):[0-9]*.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\(.*\):.*/\1/p')
        
        echo "Using DATABASE_URL: host=$DB_HOST, port=$DB_PORT"
        pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"
    else
        # Docker Compose fallback
        echo "Using Docker Compose variables: host=$POSTGRES_HOST, port=$POSTGRES_PORT"
        pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"
    fi
}

# Wait for database with retry logic
MAX_RETRIES=30
RETRY_COUNT=0

until check_database; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "ERROR: Database connection failed after $MAX_RETRIES attempts"
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
exec "$@"
```

**Why this is necessary:**
- Parses Railway's `DATABASE_URL` to extract connection details
- Falls back to Docker Compose variables for local development
- Prevents infinite retry loop
- Adds maximum retry limit with clear error message

---

### Fix 4: Create `railway.json` (RECOMMENDED)

**File:** `railway.json` (create in project root)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "/entrypoint.sh uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Why this is necessary:**
- Explicitly configures Railway deployment
- Uses Railway's `$PORT` variable (Railway assigns dynamic port)
- Sets proper health check endpoint
- Configures restart policy

---

### Fix 5: Update `app/core/config.py` Port Configuration (RECOMMENDED)

**File:** `app/core/config.py`

Add Railway PORT support:

```python
# Server
HOST: str = "0.0.0.0"
PORT: int = 8000

def __init__(self, **kwargs):
    super().__init__(**kwargs)
    # Railway provides PORT environment variable dynamically
    import os
    railway_port = os.getenv("PORT")
    if railway_port:
        self.PORT = int(railway_port)
```

**Why this is necessary:**
- Railway assigns a dynamic port via `$PORT` environment variable
- Your app must listen on this port, not hardcoded 8000
- Railway's internal routing requires this

---

### Fix 6: Update Dockerfile CMD for Railway (RECOMMENDED)

**File:** `Dockerfile`

Update the CMD line to use PORT environment variable:

```dockerfile
# Production command (Railway-compatible with dynamic port)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Or better, update to:

```dockerfile
# Production command (Railway-compatible)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**Why this is necessary:**
- Railway requires the app to bind to `$PORT`
- Fallback to 8000 for local Docker Compose
- Shell substitution handles the variable

---

### Fix 7: Add Railway Environment Variables in Railway Dashboard (REQUIRED)

In Railway project settings, ensure these variables are set:

```bash
# Railway automatically provides:
DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway

# You must add:
APP_ENV=production
APP_DEBUG=false
CORS_ORIGINS=https://your-frontend-domain.com
API_V1_PREFIX=/api/v1
```

**Do NOT set these** (let Railway handle them):
- ❌ `DATABASE_URL` (Railway provides this automatically)
- ❌ `PORT` (Railway provides this automatically)

**Do NOT set these** (not needed on Railway):
- ❌ `POSTGRES_HOST`
- ❌ `POSTGRES_PORT`
- ❌ `POSTGRES_USER`
- ❌ `POSTGRES_PASSWORD`
- ❌ `POSTGRES_DB`

---

## Summary of Required Changes

### Minimal Changes (MUST DO):

1. **✅ Update `app/core/config.py`** - Add Railway DATABASE_URL detection and transformation
2. **✅ Update `entrypoint.sh`** - Parse DATABASE_URL for Railway
3. **✅ Update `app/db/session.py`** - Add SSL support
4. **✅ Create `railway.json`** - Configure Railway deployment
5. **✅ Set Railway environment variables** - Add APP_ENV, CORS_ORIGINS

### Recommended Changes:

6. ✅ Update port configuration to use Railway's `$PORT`
7. ✅ Update Dockerfile CMD for dynamic port
8. ✅ Add connection pool optimization
9. ✅ Add retry limits to prevent infinite loops

---

## Testing After Fixes

### 1. Test Locally with Docker Compose (should still work):

```bash
docker compose up --build
```

Expected: ✅ Works as before with `db` hostname

### 2. Test on Railway:

```bash
# Railway will automatically use DATABASE_URL
railway up
```

Expected: ✅ Connects to Railway PostgreSQL

### 3. Check Railway logs:

```bash
railway logs
```

Look for:
- ✅ "Using DATABASE_URL: host=postgres.railway.internal"
- ✅ "PostgreSQL is up - continuing..."
- ✅ "Migrations completed successfully"
- ✅ "Application startup complete"

---

## Root Cause Summary

**Why Connection Fails:**

1. **Hardcoded Docker hostname** (`db`) doesn't exist on Railway
2. **URL format mismatch** (Railway provides `postgresql://`, code expects `postgresql+asyncpg://`)
3. **Missing environment variables** (Railway doesn't provide `POSTGRES_HOST`, etc.)
4. **No SSL configuration** (Railway requires SSL)
5. **Wrong port binding** (Railway uses dynamic `$PORT`, code uses hardcoded 8000)

**After fixes, the flow will be:**

```
Railway provides: DATABASE_URL=postgresql://user:pass@railway-host:5432/db
        ↓
config.py detects and transforms:
        ↓
DATABASE_URL=postgresql+asyncpg://user:pass@railway-host:5432/db (async)
DATABASE_URL_SYNC=postgresql+psycopg://user:pass@railway-host:5432/db (sync)
        ↓
entrypoint.sh parses DATABASE_URL for pg_isready check
        ↓
SQLAlchemy engine connects with SSL enabled
        ↓
✅ SUCCESS
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Deploy Immediately)
1. Update `app/core/config.py` with Railway URL detection
2. Update `entrypoint.sh` with DATABASE_URL parsing
3. Update `app/db/session.py` with SSL support

### Phase 2: Railway Configuration (Before Deploy)
4. Create `railway.json`
5. Set Railway environment variables

### Phase 3: Optimization (After Initial Deploy)
6. Update PORT configuration
7. Update Dockerfile CMD
8. Add connection pool tuning

---

## Contact & Support

After implementing these fixes, if you still encounter issues, check:

1. Railway deployment logs: `railway logs`
2. Database plugin status in Railway dashboard
3. Environment variables are set correctly
4. DATABASE_URL format matches `postgresql://...`
5. SSL certificate issues (Railway should handle automatically)

The core issue is **Docker Compose-specific configuration** that doesn't translate to Railway's environment. The fixes above make your application **cloud-agnostic** and compatible with both local Docker development and Railway production deployment.
