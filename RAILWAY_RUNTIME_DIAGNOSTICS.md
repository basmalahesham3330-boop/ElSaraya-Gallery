# Railway Runtime Diagnostics Report

## Purpose

This document describes the diagnostic instrumentation added to identify why `pg_isready` succeeds but Alembic fails with DNS resolution errors on Railway.

---

## Diagnostic Changes Made

### 1. `app/core/config.py` - Final Configuration Output

**Location:** Lines 80-156

**What it does:**
- Prints final `DATABASE_URL` and `DATABASE_URL_SYNC` values after all transformations
- Uses `sqlalchemy.engine.make_url()` to parse and display:
  - Driver name
  - Hostname
  - Port
  - Database name
  - Username (password masked)

**When it runs:**
- Immediately after configuration initialization
- Before any database connections are attempted

**Output format:**
```
============================================================
FINAL DATABASE CONFIG
============================================================

DATABASE_URL (Async - FastAPI):
  Driver:   postgresql+asyncpg
  Host:     postgres.railway.internal
  Port:     5432
  Database: railway
  Username: postgres

DATABASE_URL_SYNC (Sync - Alembic):
  Driver:   postgresql+psycopg
  Host:     postgres.railway.internal
  Port:     5432
  Database: railway
  Username: postgres

============================================================
```

**Purpose:**
- Verify transformation logic executed correctly
- Confirm Railway URL was detected and transformed
- Ensure both URLs point to same hostname
- Detect if any code replaced hostname with "db" or "localhost"

---

### 2. `alembic/env.py` - Alembic Database Configuration

**Location:** Lines 34-52

**What it does:**
- Prints the DATABASE_URL_SYNC value that Alembic will use
- Executes **immediately before** `config.set_main_option("sqlalchemy.url", ...)`
- Parses URL to show individual components

**When it runs:**
- When Alembic migrations start
- After config.py initialization but before engine creation

**Output format:**
```
============================================================
ALEMBIC DATABASE CONFIG
============================================================

Driver:   postgresql+psycopg
Host:     postgres.railway.internal
Port:     5432
Database: railway
Username: postgres

Raw URL (masked): postgresql+psycopg://postgres:****@postgres.railway.internal:5432/railway
============================================================
```

**Purpose:**
- Verify Alembic receives correct DATABASE_URL_SYNC
- Confirm hostname is not being changed between config.py and Alembic
- Show exact URL format Alembic attempts to connect with

---

### 3. `app/db/session.py` - FastAPI Engine Configuration

**Location:** Lines 29-50

**What it does:**
- Prints DATABASE_URL that FastAPI will use for async engine
- Shows SSL configuration status
- Executes **immediately before** `create_async_engine()`

**When it runs:**
- When FastAPI application starts
- Before any API requests are handled

**Output format:**
```
============================================================
FASTAPI ENGINE CONFIG
============================================================

Driver:   postgresql+asyncpg
Host:     postgres.railway.internal
Port:     5432
Database: railway
Username: postgres
SSL enabled: True

Raw URL (masked): postgresql+asyncpg://postgres:****@postgres.railway.internal:5432/railway
============================================================
```

**Purpose:**
- Verify FastAPI uses same hostname as Alembic
- Confirm SSL is enabled for Railway
- Show exact URL format FastAPI attempts to connect with

---

### 4. `entrypoint.sh` - Environment and DNS Testing

**Location:** Lines 84-143

**What it does:**
- Prints all database-related environment variables (passwords masked)
- Tests DNS resolution for Railway hostnames
- Runs after `pg_isready` succeeds but before Alembic migrations

**When it runs:**
- After PostgreSQL health check succeeds
- Immediately before `alembic upgrade head`

**Output format:**
```
==========================================
===== ENVIRONMENT VARIABLES =====
==========================================
DATABASE_URL=postgresql://postgres:****@postgres.railway.internal:5432/railway
DATABASE_URL_SYNC=(not set)
PGHOST=(not set)
PGPORT=(not set)
PGDATABASE=(not set)
PGUSER=(not set)

===== DNS RESOLUTION TESTS =====
==========================================
Testing: postgres.railway.internal
  ✓ SUCCESS: postgres.railway.internal resolves
Testing: postgres
  ✗ FAILED: postgres does NOT resolve

nslookup postgres.railway.internal:
Server:         10.0.0.1
Address:        10.0.0.1#53
Name:   postgres.railway.internal
Address: 172.16.0.2

nslookup postgres:
(nslookup failed or not available)
==========================================
```

**Purpose:**
- Show what environment variables are actually set
- Detect if `DATABASE_URL_SYNC` is being set separately
- Verify DNS resolution works for Railway hostnames
- Identify if short hostname "postgres" resolves differently
- Compare what `pg_isready` sees vs what psycopg sees

---

## Search Results - All DATABASE_URL References

### Files WHERE DATABASE_URL or DATABASE_URL_SYNC Appear:

1. **`app/core/config.py`**
   - Lines 36-40: Default values (Docker Compose fallback)
   - Lines 54-71: Railway URL transformation logic
   - Lines 97-156: Diagnostic output

2. **`alembic/env.py`**
   - Line 34-52: Diagnostic output
   - Line 53: `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_SYNC)`

3. **`app/db/session.py`**
   - Lines 29-50: Diagnostic output
   - Line 52: `engine = create_async_engine(settings.DATABASE_URL, ...)`

4. **`docker-compose.yml`**
   - Lines 36-37: Environment variable pass-through (Docker only)

5. **`.env` file**
   - Lines 34-40: Default values for Docker Compose (not used on Railway)

6. **`.env.example`**
   - Lines 35-40: Example configuration

7. **`tests/conftest.py`**
   - Line 30: SQLite in-memory database for testing (not relevant)

8. **Documentation files:**
   - `DEPLOYMENT.md`
   - `RAILWAY_DEPLOYMENT.md`
   - `RAILWAY_DIAGNOSTIC_REPORT.md`
   - `RAILWAY_URL_INSPECTION_REPORT.md`
   - `RAILWAY_CHANGES_SUMMARY.md`

### Files WHERE create_engine or create_async_engine Appear:

1. **`app/db/session.py`** (Line 52)
   ```python
   engine = create_async_engine(
       settings.DATABASE_URL,
       echo=settings.APP_DEBUG,
       pool_pre_ping=True,
       connect_args=connect_args,
   )
   ```

2. **`tests/conftest.py`** (Line 30)
   ```python
   engine = create_async_engine("sqlite+aiosqlite:///:memory:")
   ```
   - Test-only, not relevant to production

### Files WHERE "sqlalchemy.url" Appears:

1. **`alembic/env.py`** (Line 53)
   ```python
   config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_SYNC)
   ```

2. **`alembic/env.py`** (Line 64)
   ```python
   url = config.get_main_option("sqlalchemy.url")
   ```

3. **`alembic.ini`** (Line 5)
   ```ini
   sqlalchemy.url =
   ```
   - Empty placeholder, overridden by env.py

---

## Analysis Based on Code Review

### 1. Which DATABASE_URL FastAPI Uses

**Answer:** `settings.DATABASE_URL` (async version)

**Source:** `app/db/session.py` line 52

**Value on Railway:** 
```
postgresql+asyncpg://postgres:****@postgres.railway.internal:5432/railway
```

**Transformation:**
- Railway provides: `postgresql://postgres:pass@postgres.railway.internal:5432/railway`
- config.py transforms to: `postgresql+asyncpg://postgres:pass@postgres.railway.internal:5432/railway`
- Hostname preserved: `postgres.railway.internal`

---

### 2. Which DATABASE_URL Alembic Uses

**Answer:** `settings.DATABASE_URL_SYNC` (sync version)

**Source:** `alembic/env.py` line 53

**Value on Railway:**
```
postgresql+psycopg://postgres:****@postgres.railway.internal:5432/railway
```

**Transformation:**
- Railway provides: `postgresql://postgres:pass@postgres.railway.internal:5432/railway`
- config.py transforms to: `postgresql+psycopg://postgres:pass@postgres.railway.internal:5432/railway`
- Hostname preserved: `postgres.railway.internal`

---

### 3. Are They Identical?

**Answer:** Partially

**Differences:**
- Driver: `asyncpg` (FastAPI) vs `psycopg` (Alembic)
- Protocol: `postgresql+asyncpg://` vs `postgresql+psycopg://`

**Same:**
- Username: `postgres`
- Password: (same, from Railway)
- **Hostname: `postgres.railway.internal`** ✅
- Port: `5432`
- Database: `railway`

**Conclusion:** Both should connect to the same database server.

---

### 4. Does Any Code Override DATABASE_URL_SYNC?

**Answer:** NO

**Evidence:**
1. `DATABASE_URL_SYNC` is set once in `config.py.__init__()` (lines 68-71)
2. Never modified after that
3. Alembic reads directly from `settings.DATABASE_URL_SYNC` (line 53)
4. No other code references or modifies `DATABASE_URL_SYNC`

**Verification:**
- Searched entire codebase for `DATABASE_URL_SYNC =`
- Only found in:
  - Default value (line 38)
  - Transformation logic (line 69)
  - No overwrites

---

### 5. Do Hostnames Differ Between FastAPI and Alembic?

**Answer:** NO - They should be identical

**FastAPI hostname:** `postgres.railway.internal` (from `DATABASE_URL`)

**Alembic hostname:** `postgres.railway.internal` (from `DATABASE_URL_SYNC`)

**Source:** Both come from same Railway `DATABASE_URL` environment variable, transformed identically except for driver prefix.

**Code proof:**
```python
# Line 54: Read Railway URL
railway_db_url = os.getenv("DATABASE_URL")

# Line 64-66: Transform for async
self.DATABASE_URL = railway_db_url.replace(
    "postgresql://", "postgresql+asyncpg://", 1
)

# Line 68-70: Transform for sync
self.DATABASE_URL_SYNC = railway_db_url.replace(
    "postgresql://", "postgresql+psycopg://", 1
)
```

Both use `railway_db_url` as source → same hostname.

---

### 6. Does Any Code Use "db", "localhost", or "postgres" Instead?

**Answer:** NO - Not on Railway

**Code check:**

1. **"db" hostname:**
   - Line 31: `POSTGRES_HOST: str = "db"` - Default only, not used when Railway URL present
   - Lines 36-40: Default URLs with `@db:5432` - Overwritten by transformation

2. **"localhost" hostname:**
   - Not found in any production code
   - Only in test files (irrelevant)

3. **"postgres" hostname:**
   - Not found as a hostname in connection strings
   - Only appears in usernames (`postgres@...`)

**Verification:**
```bash
grep -r "@db:" app/ alembic/
# Only found in default values that are overwritten

grep -r "@localhost:" app/ alembic/
# Not found

grep -r "@postgres:" app/ alembic/
# Not found (only postgres.railway.internal)
```

**Conclusion:** No code uses Docker/local hostnames when Railway URL is provided.

---

### 7. Git Diffs for All Modified Files

See above output from `git diff` commands showing:

1. **`app/core/config.py`**
   - Added `_print_final_config()` method
   - Added `_mask_password()` static method
   - Call diagnostic print in `__init__()`

2. **`alembic/env.py`**
   - Added diagnostic print before `config.set_main_option()`

3. **`app/db/session.py`**
   - Added diagnostic print before `create_async_engine()`

4. **`entrypoint.sh`**
   - Added environment variable dump (masked)
   - Added DNS resolution tests

**All changes are diagnostic only - no logic modified.**

---

## Expected Railway Deployment Output

When deployed to Railway with these diagnostics, you will see:

```
==========================================
ERP Backend Starting...
Environment: production
==========================================

============================================================
FINAL DATABASE CONFIG
============================================================

DATABASE_URL (Async - FastAPI):
  Driver:   postgresql+asyncpg
  Host:     postgres.railway.internal
  Port:     5432
  Database: railway
  Username: postgres

DATABASE_URL_SYNC (Sync - Alembic):
  Driver:   postgresql+psycopg
  Host:     postgres.railway.internal
  Port:     5432
  Database: railway
  Username: postgres

============================================================

Waiting for PostgreSQL to be ready...
Database check: Using DATABASE_URL
  Host: postgres.railway.internal
  Port: 5432
  User: postgres
PostgreSQL is up - continuing...

==========================================
===== ENVIRONMENT VARIABLES =====
==========================================
DATABASE_URL=postgresql://postgres:****@postgres.railway.internal:5432/railway
DATABASE_URL_SYNC=(not set)
PGHOST=(not set)
PGPORT=(not set)
PGDATABASE=(not set)
PGUSER=(not set)

===== DNS RESOLUTION TESTS =====
==========================================
Testing: postgres.railway.internal
  ✓ SUCCESS: postgres.railway.internal resolves
Testing: postgres
  ✗ FAILED: postgres does NOT resolve

nslookup postgres.railway.internal:
[DNS response showing IP]

nslookup postgres:
(nslookup failed or not available)
==========================================

Running database migrations...

============================================================
ALEMBIC DATABASE CONFIG
============================================================

Driver:   postgresql+psycopg
Host:     postgres.railway.internal
Port:     5432
Database: railway
Username: postgres

Raw URL (masked): postgresql+psycopg://postgres:****@postgres.railway.internal:5432/railway
============================================================

[Alembic migration output or error]
```

---

## What to Look For in Railway Logs

### 1. Configuration Mismatch
**Check if:**
- FINAL DATABASE CONFIG shows different hostnames for async vs sync
- Alembic config shows different hostname than FINAL DATABASE CONFIG

### 2. DNS Resolution Failure
**Check if:**
- `postgres.railway.internal` fails DNS resolution test
- `postgres` succeeds but `postgres.railway.internal` doesn't

### 3. Environment Variable Issues
**Check if:**
- `DATABASE_URL_SYNC` is set (it shouldn't be)
- Any `PG*` variables are set (they shouldn't be)
- `DATABASE_URL` doesn't contain "railway.internal"

### 4. Hostname Replacement
**Check if:**
- Any config shows `@db:` or `@localhost:` instead of `@postgres.railway.internal:`
- FastAPI and Alembic show different hostnames

### 5. Driver Issues
**Check if:**
- Driver is not `postgresql+psycopg` for Alembic
- Driver is not `postgresql+asyncpg` for FastAPI

---

## Next Steps After Reviewing Logs

1. **Compare outputs:**
   - FINAL DATABASE CONFIG
   - ALEMBIC DATABASE CONFIG
   - FASTAPI ENGINE CONFIG

2. **Check DNS:**
   - Does `postgres.railway.internal` resolve?
   - Does `postgres` resolve?
   - Are they the same IP?

3. **Verify transformation:**
   - Did Railway URL get detected and transformed?
   - Are drivers correct (`asyncpg` and `psycopg`)?
   - Is hostname preserved?

4. **Check for overrides:**
   - Is `DATABASE_URL_SYNC` being set by Railway or elsewhere?
   - Are any `PG*` environment variables interfering?

---

## Summary

**No fixes applied - only diagnostics added.**

The diagnostics will reveal:
1. Exact URLs used by FastAPI and Alembic
2. Whether hostnames differ
3. Whether DNS resolution works
4. Whether Railway URL transformation succeeded
5. What environment variables Railway provides

This information will identify the root cause of the `psycopg.OperationalError: Name or service not known` error.
