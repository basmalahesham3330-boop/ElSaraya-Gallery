# Railway Deployment Guide

## Quick Start

Deploy the ERP Backend to Railway in 3 steps:

### 1. Create Railway Project & Add Database

```bash
# Option A: Using Railway CLI
railway login
railway init

# Option B: Using Railway Dashboard
# Go to railway.app → New Project → Empty Project
```

**Add PostgreSQL:**
- Railway Dashboard → Click "New" → "Database" → "PostgreSQL"
- Railway automatically sets `DATABASE_URL` environment variable

### 2. Set Environment Variables

In Railway Dashboard → Your Backend Service → **Variables**:

```bash
APP_ENV=production
APP_DEBUG=false
CORS_ORIGINS=https://your-frontend-domain.com
```

**Do NOT set these** (Railway provides automatically):
- `DATABASE_URL` (provided by PostgreSQL plugin)
- `PORT` (assigned dynamically)

### 3. Deploy

```bash
# Option A: Push to GitHub (recommended)
git push origin main
# Railway will auto-deploy

# Option B: Deploy directly
railway up
```

---

## How It Works

### Automatic Configuration

The backend automatically detects Railway and configures itself:

1. **DATABASE_URL Transformation**
   - Railway provides: `postgresql://user:pass@host:port/db`
   - Backend converts to: `postgresql+asyncpg://...` (async) and `postgresql+psycopg://...` (sync)

2. **SSL Enabled**
   - Automatically enabled when Railway is detected
   - Required by Railway PostgreSQL

3. **Dynamic PORT**
   - Uses Railway's assigned port automatically

4. **Private Networking**
   - Connects via Railway's internal network (`postgres.railway.internal`)

### Railway Detection

The backend detects Railway environment by checking:
- DATABASE_URL contains "railway"
- `RAILWAY_ENVIRONMENT` variable exists
- `RAILWAY_PROJECT_ID` variable exists

---

## Environment Variables

### Required (Set in Railway Dashboard)

| Variable | Value | Description |
|----------|-------|-------------|
| `APP_ENV` | `production` | Application environment |
| `APP_DEBUG` | `false` | Disable debug mode |
| `CORS_ORIGINS` | `https://your-domain.com` | Frontend domain(s), comma-separated |

### Automatic (Provided by Railway)

| Variable | Provided By | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | PostgreSQL Plugin | Database connection string |
| `PORT` | Railway | Dynamic port assignment |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `API_V1_PREFIX` | `/api/v1` | API route prefix |

---

## Configuration Files

### `railway.json`
Tells Railway how to build and deploy:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### `Dockerfile`
Already configured for Railway (no changes needed)

### `entrypoint.sh`
Automatically handles both Docker Compose and Railway:
- Parses `DATABASE_URL` for Railway
- Falls back to `POSTGRES_*` variables for Docker Compose
- Runs migrations automatically

---

## Verification

### Check Deployment Status

```bash
# View logs
railway logs

# Check services
railway status
```

### Test Health Endpoint

```bash
curl https://your-backend.railway.app/api/v1/health
```

**Expected response:**
```json
{
  "status": "ok",
  "environment": "production",
  "debug": false
}
```

---

## Troubleshooting

### Database Connection Issues

**Symptom:** Connection timeouts or "Name or service not known"

**Check:**
1. PostgreSQL plugin is added
2. `DATABASE_URL` is automatically set by Railway
3. Backend and database are in the same Railway project

**Solution:**
- Ensure private networking is enabled (default)
- Check Railway logs for actual error

### Wrong Port

**Symptom:** Application not accessible

**Check Railway logs for:**
```
INFO: Uvicorn running on http://0.0.0.0:XXXX
```

**Solution:**
- Port is assigned by Railway automatically
- Don't set `PORT` manually in environment variables

### CORS Errors

**Symptom:** Frontend can't connect to backend

**Solution:**
- Add your frontend domain to `CORS_ORIGINS`
- Format: `https://app.vercel.app,https://www.yourdomain.com`

---

## Local Testing with Railway Database

Connect your local backend to Railway database for testing:

```bash
# Get Railway DATABASE_URL
railway variables

# Export it locally
export DATABASE_URL="postgresql://postgres:***@***:5432/railway"

# Run backend locally
python -m uvicorn app.main:app --reload
```

The backend will automatically:
- Transform the URL for SQLAlchemy
- Enable SSL for Railway connection
- Connect successfully

---

## Deployment Checklist

Before deploying:
- [ ] PostgreSQL plugin added
- [ ] `APP_ENV=production` set
- [ ] `APP_DEBUG=false` set
- [ ] `CORS_ORIGINS` set to your frontend domain
- [ ] `railway.json` exists in repository
- [ ] All backend tests passing locally

After deploying:
- [ ] Check Railway logs for errors
- [ ] Test health endpoint
- [ ] Verify database migrations ran successfully
- [ ] Test API endpoints from frontend

---

## Key Differences: Docker Compose vs Railway

| Aspect | Docker Compose | Railway |
|--------|----------------|---------|
| DATABASE_URL | `postgresql+asyncpg://...@db:5432/...` | `postgresql://...@postgres.railway.internal:5432/...` |
| Driver | Explicit in URL | Auto-added by backend |
| SSL | Disabled | **Enabled automatically** |
| PORT | Static (8000) | **Dynamic** |
| Hostname | `db` | `postgres.railway.internal` |

---

## Support

- **Railway Documentation:** [docs.railway.app](https://docs.railway.app)
- **Railway Discord:** [discord.gg/railway](https://discord.gg/railway)

---

**Last Updated:** 2026-07-31  
**Backend Version:** 1.0.0
