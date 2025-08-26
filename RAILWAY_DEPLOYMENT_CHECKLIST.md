# Railway Deployment Checklist for KCT Menswear Backend

## ✅ Pre-Deployment Setup (Completed)
- [x] Railway CLI installed
- [x] Backend code structure verified
- [x] Dockerfile configured
- [x] railway.toml configuration file created
- [x] Production secrets generated
- [x] Environment variables file prepared (`railway-env-vars.txt`)
- [x] Deployment script created (`deploy-to-railway.sh`)

## 📋 Manual Deployment Steps

### Step 1: Login to Railway
```bash
railway login
```
This will open your browser for authentication.

### Step 2: Create New Railway Project
```bash
cd /Users/ibrahim/Downloads/agent_workspace/kct-commerce/backend
railway link
```
Select "Create New Project" when prompted.

### Step 3: Add Database Services via Railway Dashboard

1. Open Railway Dashboard:
```bash
railway open
```

2. In the Railway Dashboard:
   - Click **"+ New"** → **"Database"** → **"PostgreSQL"**
   - Click **"+ New"** → **"Database"** → **"Redis"**

### Step 4: Configure Environment Variables

In Railway Dashboard → Variables tab, add ALL variables from `railway-env-vars.txt`:

#### Critical Production Secrets (Generated)
- `JWT_SECRET=fdd2b4485fdccc420c658710030bf9f9f7818fcbedae44fa5e3bdce2b55740d5`
- `COOKIE_SECRET=0d8ef08bbf7256224c07b6873b2ea71ad88c159877ebe8718db560903b8de128`
- `SESSION_SECRET=a0fad47f58b157099c61b9c830d6e721e6820165bdb4bcc8a66b86217903ccf1`

#### Node Configuration
- `NODE_ENV=production`
- `PORT=9000`
- `DATABASE_TYPE=postgres`
- `WORKER_MODE=shared`

#### CORS (Update after deployment with actual Railway URL)
- `STORE_CORS=https://kctmenswear.com,https://www.kctmenswear.com`
- `ADMIN_CORS=https://admin.kctmenswear.com,https://YOUR-APP.up.railway.app`

#### Stripe
- `STRIPE_API_KEY=sk_test_your_stripe_key_here`
- `STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET` (will be provided by Stripe after webhook setup)
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key_here`

#### EasyPost (Shipping)
- `EASYPOST_API_KEY=EZAK_your_easypost_key_here`

#### Resend (Email Service)
- `RESEND_API_KEY=re_your_resend_key_here`

#### All other services (Cloudflare, Facebook, Google)
Copy from `railway-env-vars.txt`

### Step 5: Deploy Application
```bash
railway up
```

This will:
- Build Docker container
- Deploy to Railway
- Start the application

### Step 6: Run Database Migrations
```bash
railway run npm run migrate
```

### Step 7: (Optional) Seed Initial Data
```bash
railway run npm run seed
```

### Step 8: Verify Deployment
```bash
# Check logs
railway logs

# Get deployment URL
railway open
```

## 🔍 Post-Deployment Verification

### Check Health Endpoint
Visit: `https://YOUR-APP.up.railway.app/admin/system/health`

### Test Admin Panel
Visit: `https://YOUR-APP.up.railway.app/admin`

### Test Store API
```bash
curl https://YOUR-APP.up.railway.app/store/products
```

## 🔧 Important Notes

1. **Database URLs**: Railway automatically provides `DATABASE_URL` and `REDIS_URL`
2. **Custom Domain**: After deployment, you can add custom domain in Railway settings
3. **CORS Update**: After getting Railway URL, update CORS settings
4. **Stripe Webhooks**: Configure webhook endpoint in Stripe Dashboard with Railway URL
5. **Storage**: Volume is configured for `/app/backend/uploads` (10GB)

## 🚨 Troubleshooting Commands

```bash
# View logs
railway logs --tail

# Check environment variables
railway variables

# Run commands in production
railway run <command>

# Connect to PostgreSQL
railway connect postgres

# Connect to Redis
railway connect redis

# Redeploy
railway up --detach
```

## 📱 Next Steps After Deployment

1. **Update Frontend Configuration**
   - Update API URL in frontend to Railway URL
   - Update CORS settings with frontend domain

2. **Configure Stripe Webhooks**
   - Add webhook endpoint: `https://YOUR-APP.up.railway.app/hooks/stripe`
   - Update `STRIPE_WEBHOOK_SECRET` with new secret

3. **Set Up Monitoring**
   - Enable Railway metrics
   - Configure error tracking
   - Set up uptime monitoring

4. **Security Hardening**
   - Review all environment variables
   - Enable rate limiting
   - Configure backup strategy

## 📞 Support Resources

- Railway Documentation: https://docs.railway.app
- Railway Status: https://status.railway.app
- Medusa Documentation: https://docs.medusajs.com
- Your Backend README: `/README.md`

---

**Ready to Deploy?** Run `./deploy-to-railway.sh` or follow the manual steps above!