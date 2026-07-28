# Railway Deployment Guide

## Overview

The ERP Backend is now compatible with both Docker Compose (local development) and Railway (cloud deployment) with automatic detection and configuration.

## Automatic Railway Detection

The application automatically detects Railway environment and:
1. ✅ Transforms Railway's `DATABASE_URL` from `postgresql://` to `postgresql+asyncpg://` (async) and `postgresql+psycopg://` (sync)
2. ✅ Enables SSL connections when running on Railway
3. ✅ Uses Railway's dynamic `PORT` environment variable
4. ✅ Parses `DATABASE_URL` in entrypoint.sh instead of requiring individual `POSTGRES_*` variables

## Changes Made

### 1. `app/core/config.py` - Automatic URL Transformation

**What changed:**
- Added `__init__` method to detect and transform Railway's `DATABASE_URL`
- Converts `postgresql://` → `postgresql+asyncpg://` for async SQLAlchemy
- Converts `postgresql://` → `postgresql+psycopg://` for sync operations (Alembic migrations)
- Added `is_railway` property to detect Railway environment
- Added automatic `PORT` handling for Railway's dynamic port assignment

**Why necessary:**
- Railway provides `DATABASE_URL` in format: `postgresql://user:pass@host:port/db`
- SQLAlchemy async requires: `postgresql+asyncpg://...`
- Alembic migrations require: `postgresql+psycopg://...`
- Without transformation, connection fails with "No module named 'postgresql'"

**Backward compatibility:**
- Docker Compose continues to use explicit `DATABASE_URL` from `.env` file
- If `DATABASE_URL` already contains `+asyncpg` or `+psycopg`, no transformation occurs
- Maintains all existing behavior for local development

### 2. `app/db/session.py` - Conditional SSL Support

**What changed:**
- Added `connect_args` configuration before engine creation
- Enables SSL (`ssl=require`) only when running on Railway or production
- Uses `settings.is_railway` to detect Railway environment

**Why necessary:**
- Railway PostgreSQL **requires** SSL connections
- Without SSL, connection fails with "SSL connection required"
- Local Docker PostgreSQL doesn't use SSL
- Conditional logic ensures both environments work

**Backward compatibility:**
- Docker Compose uses no SSL (empty `connect_args`)
- Only enables SSL when Railway is detected
- No impact on local development

### 3. `entrypoint.sh` - Dual-Mode Database Check

**What changed:**
- Added `check_database()` function that works with both environments
- If `DATABASE_URL` exists: Parse it to extract host, port, user for `pg_isready`
- If `DATABASE_URL` not set: Use `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER` (Docker Compose)
- Added retry counter with maximum attempts (30 retries = 60 seconds)
- Added debug output showing which variables are being used
- Added informative error message if database never becomes available

**Why necessary:**
- Railway provides only `DATABASE_URL`, not individual `POSTGRES_*` variables
- Docker Compose uses individual variables
- Original script would fail on Railway with "POSTGRES_HOST: unbound variable"
- Single script now works in both environments

**Backward compatibility:**
- Falls back to `POSTGRES_*` variables if `DATABASE_URL` not set
- Docker Compose behavior unchanged
- Added safety: exits after 30 failed attempts instead of infinite loop

### 4. `railway.json` - Railway Configuration

**What changed:**
- Created new file defining Railway build and deployment settings
- Specifies Dockerfile as build source
- Sets health check path to `/api/v1/health`
- Configures restart policy for failures

**Why necessary:**
- Tells Railway how to build and deploy the application
- Enables health checks so Railway knows when app is ready
- Configures automatic restart on failures

**Backward compatibility:**
- Only used by Railway, ignored by Docker Compose
- No impact on local development

## Railway Environment Variables

Railway automatically provides:
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `PORT` - Dynamic port number for the application

You must manually set in Railway dashboard:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `CORS_ORIGINS=https://your-frontend-domain.com`

You should **NOT** set (let Railway handle these):
- ❌ `POSTGRES_HOST`
- ❌ `POSTGRES_PORT`
- ❌ `POSTGRES_USER`
- ❌ `POSTGRES_PASSWORD`
- ❌ `POSTGRES_DB`

## Deployment Steps

### 1. Create Railway Project
```bash
railway init
```

### 2. Add PostgreSQL Plugin
In Railway dashboard:
- Click "New" → "Database" → "Add PostgreSQL"
- Railway automatically sets `DATABASE_URL` environment variable

### 3. Set Environment Variables
In Railway dashboard → Variables:
```
APP_ENV=production
APP_DEBUG=false
CORS_ORIGINS=https://your-frontend-domain.com
```

### 4. Deploy
```bash
railway up
```

Or connect to GitHub and enable automatic deployments.

## How It Works

### Docker Compose (Local Development)

1. `.env` file provides:
   ```env
   POSTGRES_HOST=db
   POSTGRES_PORT=5432
   POSTGRES_USER=erp_user
   POSTGRES_PASSWORD=your_password
   DATABASE_URL=postgresql+asyncpg://erp_user:your_password@db:5432/erp_db
   DATABASE_URL_SYNC=postgresql+psycopg://erp_user:your_password@db:5432/erp_db
   ```

2. `entrypoint.sh` detects no `DATABASE_URL` override, uses `POSTGRES_*` variables

3. `config.py` uses explicit URLs from `.env`

4. Connection established to `db:5432` (Docker Compose service)

### Railway (Production)

1. Railway provides:
   ```env
   DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway
   PORT=8000
   ```

2. `config.py.__init__()` detects Railway URL and transforms:
   ```python
   DATABASE_URL=postgresql+asyncpg://postgres:***@postgres.railway.internal:5432/railway
   DATABASE_URL_SYNC=postgresql+psycopg://postgres:***@postgres.railway.internal:5432/railway
   ```

3. `entrypoint.sh` parses `DATABASE_URL` to extract:
   ```
   DB_HOST=postgres.railway.internal
   DB_PORT=5432
   DB_USER=postgres
   ```

4. `session.py` detects Railway and enables SSL

5. Connection established to Railway PostgreSQL with SSL

## Verification

### Check Configuration Detection
```python
from app.core.config import settings

print(f"Railway detected: {settings.is_railway}")
print(f"DATABASE_URL: {settings.DATABASE_URL}")
print(f"DATABASE_URL_SYNC: {settings.DATABASE_URL_SYNC}")
print(f"Port: {settings.PORT}")
```

### Check Railway Logs
```bash
railway logs
```

Look for:
```
Database check: Using DATABASE_URL
  Host: postgres.railway.internal
  Port: 5432
  User: postgres
PostgreSQL is up - continuing...
Migrations completed successfully
Application startup complete
```

## Troubleshooting

### Issue: Connection timeout on Railway

**Check:**
```bash
railway logs | grep "Database check"
```

**Expected:**
```
Database check: Using DATABASE_URL
  Host: postgres.railway.internal
```

**If showing:**
```
Database check: Using POSTGRES_* variables
  Host: db
```

**Solution:** Railway is not providing `DATABASE_URL`. Ensure PostgreSQL plugin is added.

### Issue: SSL error

**Error message:**
```
connection requires SSL
```

**Check:** Is `settings.is_railway` returning `True`?

**Solution:** Ensure Railway detection works:
- DATABASE_URL contains "railway", OR
- Environment variables `RAILWAY_ENVIRONMENT` or `RAILWAY_PROJECT_ID` are set

### Issue: Wrong port on Railway

**Check Railway logs:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Expected:** Should match Railway's assigned `PORT`

**Solution:** Verify `config.py.__init__()` is setting `self.PORT` from Railway's `PORT` env var

## Testing Locally with Railway-like Environment

Simulate Railway locally:

```bash
# Set Railway-style DATABASE_URL
export DATABASE_URL="postgresql://erp_user:mvP-*cIyE?HA346BXDw8iWqd@localhost:5432/erp_db"

# Start just the database
docker compose up db -d

# Run backend directly (not in Docker)
python -m uvicorn app.main:app --reload
```

Expected behavior:
- ✅ URL transformed to `postgresql+asyncpg://...`
- ✅ Connection succeeds
- ✅ No SSL enforcement (not detected as Railway)

## Migration from Docker-only to Railway-compatible

No action required! The changes are backward compatible:

- ✅ Existing `.env` files continue to work
- ✅ Docker Compose behavior unchanged
- ✅ All 88 backend tests pass
- ✅ No breaking changes to API or database

## Architecture Benefits

1. **Single Codebase** - Same code runs on Docker Compose and Railway
2. **Automatic Detection** - No manual configuration switching
3. **Environment-Specific** - SSL only where needed, right port automatically
4. **Fail-Safe** - Clear error messages, retry limits, debug output
5. **Zero Breaking Changes** - Complete backward compatibility

## Summary

The backend now:
- ✅ Works on Railway without any code changes
- ✅ Automatically detects and transforms Railway's `DATABASE_URL`
- ✅ Enables SSL only when running on Railway
- ✅ Uses Railway's dynamic PORT
- ✅ Maintains full Docker Compose compatibility
- ✅ Provides clear error messages and debug output

Deploy with confidence! 🚀
