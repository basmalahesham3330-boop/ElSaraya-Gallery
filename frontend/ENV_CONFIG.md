# Frontend Environment Configuration

## Overview

The frontend uses environment variables to configure the API endpoint. This allows the same build to work across different environments (development, staging, production).

## Environment Variables

### `VITE_API_URL`

**Description**: The full URL to the backend API endpoint.

**Format**: `{protocol}://{host}:{port}/api/v1`

**Examples**:
- Development: `http://localhost:8000/api/v1`
- Production (same domain): Leave empty or omit (uses relative path `/api/v1`)
- Production (different domain): `https://api.yourdomain.com/api/v1`

**Default Behavior**: If not set, the frontend will use a relative path `/api/v1`, which works when the frontend and backend are served from the same domain.

## Environment Files

### `.env.development`
Used when running `npm run dev` (local development)

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### `.env.production`
Used when running `npm run build` (production build)

```env
# Leave empty to use relative path (/api/v1)
VITE_API_URL=
```

### `.env.example`
Template file showing all available environment variables

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### `.env.local` (Not tracked in Git)
For local overrides and secrets. Create this file if you need custom settings for your local machine.

```env
VITE_API_URL=http://192.168.1.100:8000/api/v1
```

## Usage

### Local Development

1. Copy `.env.example` to `.env.development`:
   ```bash
   cp .env.example .env.development
   ```

2. Update `VITE_API_URL` if your backend is running on a different host/port:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Production Build

#### Scenario 1: Frontend and Backend on Same Domain
When both are served from the same domain (e.g., using a reverse proxy):

```env
# .env.production
VITE_API_URL=
```

The frontend will use relative path `/api/v1` which will resolve to `https://yourdomain.com/api/v1`

#### Scenario 2: Frontend and Backend on Different Domains
When frontend is on `https://app.yourdomain.com` and backend on `https://api.yourdomain.com`:

```env
# .env.production
VITE_API_URL=https://api.yourdomain.com/api/v1
```

### Vercel Deployment

Set environment variable in Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add variable:
   - **Name**: `VITE_API_URL`
   - **Value**: Your production API URL or leave empty for relative path
   - **Environment**: Production (or all environments)

**Important**: Vite environment variables must be prefixed with `VITE_` to be exposed to the client-side code.

## Architecture

### API Client Configuration

The centralized API client is located at `src/lib/api.ts`:

```typescript
import axios from 'axios';

// Use environment variable for API URL, fallback to relative path for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### All API Services Use Centralized Client

All service files (`src/services/*.ts`) import and use the centralized API client:

```typescript
import api from '../lib/api';

export const customersApi = {
  getAll: async (params) => {
    const { data } = await api.get('/customers', { params });
    return data;
  },
  // ... other methods
};
```

## Security Notes

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **API URL is public** - It's bundled in the client-side JavaScript, so don't treat it as a secret
3. **Use HTTPS in production** - Always use HTTPS for production API URLs
4. **CORS Configuration** - Ensure backend CORS settings allow requests from your frontend domain

## Troubleshooting

### API calls fail with CORS errors
- Check backend CORS configuration includes your frontend domain
- Verify `VITE_API_URL` is correct
- Check browser console for actual CORS error details

### API calls go to wrong endpoint
- Verify environment file is being loaded (check with `console.log(import.meta.env.VITE_API_URL)`)
- Ensure file is named correctly (`.env.development` or `.env.production`)
- Restart development server after changing environment files
- For production, rebuild: `npm run build`

### Environment variable not updating
- Restart the development server (`npm run dev`)
- For production builds, run `npm run build` again
- Verify Vite is reading the correct environment file
- Check that variable name starts with `VITE_`

## References

- [Vite Environment Variables Documentation](https://vitejs.dev/guide/env-and-mode.html)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
