# Manual Railway Deployment Steps

## IMPORTANT: Your local changes are ready but need to be deployed

### Option 1: Deploy via Railway Dashboard (Recommended)

1. **Open Railway Dashboard:**
   ```bash
   railway open
   ```

2. **In the Railway Dashboard:**
   - Go to your service settings
   - Find the "Deploy" section
   - Click on "Deploy from GitHub repo" and DISCONNECT it
   - Instead, select "Deploy from CLI"
   - This will use your LOCAL code

3. **Deploy your local code:**
   ```bash
   # From the backend directory
   railway up
   ```
   When prompted, select your web service (not PostgreSQL or Redis)

### Option 2: Create New Service

If the above doesn't work, create a new service:

```bash
# Unlink current project
railway unlink

# Create new project
railway init

# When prompted:
# - Name: kct-backend-fixed
# - Select: Empty Project

# Deploy
railway up

# Add databases in dashboard
railway open
```

### Option 3: Force Deploy with Service Name

Try these service names (one might work):

```bash
railway up --service web
# or
railway up --service app
# or
railway up --service backend
# or
railway up --service kct-medusa-backend
```

### Files Already Fixed ✅

- `package.json` - start script fixed (no cross-env)
- `Dockerfile` - properly configured
- `railway.toml` - all settings correct
- Environment variables ready in `railway-env-vars.txt`

### After Successful Deployment

1. Check logs:
   ```bash
   railway logs
   ```

2. Run migrations:
   ```bash
   railway run npm run migrate
   ```

3. Test health endpoint:
   ```bash
   curl https://YOUR-APP.up.railway.app/admin/system/health
   ```

## The Fix That Was Applied

Changed in package.json:
- FROM: `"start": "cross-env npm run build && medusa start"`
- TO: `"start": "medusa start"`

This removes the dependency on cross-env which is not available in production.