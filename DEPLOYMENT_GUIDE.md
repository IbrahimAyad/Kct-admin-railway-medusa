# KCT Menswear Backend - Railway Deployment Guide

## 🚀 Overview

This guide covers deploying the KCT Menswear Medusa.js e-commerce backend to Railway cloud platform with managed PostgreSQL and Redis services.

## 📋 Prerequisites

- Railway account (https://railway.app)
- Git repository with your backend code
- All environment variables prepared (see Configuration section)

## 🛠️ Deployment Steps

### 1. Install Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### 2. Initialize Railway Project

```bash
# Navigate to your backend directory
cd /workspace/kct-commerce/backend

# Initialize Railway project
railway init

# Select "Empty Project" when prompted
# Name your project: "kct-medusa-backend"
```

### 3. Add Database Services

```bash
# Add PostgreSQL database
railway add --database postgresql

# Add Redis cache
railway add --database redis
```

### 4. Configure Environment Variables

Set all required environment variables in Railway dashboard or via CLI:

```bash
# Security secrets (IMPORTANT: Generate new secure keys for production)
railway variables set JWT_SECRET="your_secure_jwt_secret_min_32_chars"
railway variables set COOKIE_SECRET="your_secure_cookie_secret_min_32_chars"
railway variables set SESSION_SECRET="your_secure_session_secret_min_32_chars"

# Node environment
railway variables set NODE_ENV="production"
railway variables set PORT="9000"
railway variables set DATABASE_TYPE="postgres"
railway variables set WORKER_MODE="shared"

# CORS Configuration - Update with your actual domains
railway variables set STORE_CORS="https://kctmenswear.com,https://www.kctmenswear.com"
railway variables set ADMIN_CORS="https://admin.kctmenswear.com,https://your-railway-app.up.railway.app"

# Stripe (Production keys)
railway variables set STRIPE_API_KEY="sk_live_your_production_stripe_key"
railway variables set STRIPE_WEBHOOK_SECRET="whsec_your_production_webhook_secret"

# Cloudflare
railway variables set CLOUDFLARE_ACCOUNT_ID="ea644c4a47a499ad4721449cbac587f4"
railway variables set CLOUDFLARE_IMAGES_TOKEN="Chn3Hcgcy-BQ306WCrA6bT5gSTa5wE-F0SfxNR4k"
railway variables set CLOUDFLARE_R2_TOKEN="ea644c4a47a499ad4721449cbac587f4"
railway variables set CLOUDFLARE_CDN_URL="https://cdn.kctmenswear.com"
railway variables set CLOUDFLARE_IMAGE_DELIVERY_URL="https://imagedelivery.net/QI-O2U_ayTU_H_Ilcb4c6Q"
railway variables set CLOUDFLARE_VIDEO_STREAM_URL="https://customer-6njalxhlz5ulnoaq.cloudflarestream.com"

# Facebook Business
railway variables set FACEBOOK_APP_ID="600272069409397"
railway variables set FACEBOOK_APP_SECRET="6e1c702c56290016ffa5c8320017b363"
railway variables set FACEBOOK_BUSINESS_PORTFOLIO_ID="1935361121530439"
railway variables set FACEBOOK_AD_ACCOUNT_ID="1409898642574301"
railway variables set FACEBOOK_CLIENT_TOKEN="f296cad6d16fbf985116e940d41ea51d"
railway variables set FACEBOOK_DATASET_ID="283546658844002"
railway variables set FACEBOOK_PIXEL_ID="1409898642574301"
railway variables set FACEBOOK_API_VERSION="v22.0"

# Google Analytics & Cloud
railway variables set GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
railway variables set GOOGLE_CLIENT_SECRET="your-google-client-secret"
railway variables set GOOGLE_PROJECT_ID="dazzling-alpha-24110"
railway variables set GOOGLE_PROJECT_NUMBER="755715745967"
railway variables set GA4_MEASUREMENT_ID="G-LH26GTWFQS"

# Email Configuration (Update with your production SMTP)
railway variables set SMTP_HOST="smtp.gmail.com"
railway variables set SMTP_PORT="587"
railway variables set SMTP_USER="your-production-email@kctmenswear.com"
railway variables set SMTP_PASSWORD="your-production-app-password"
```

### 5. Deploy the Application

```bash
# Deploy to Railway
railway deploy

# Follow the deployment logs
railway logs
```

### 6. Run Database Migrations

After successful deployment:

```bash
# Run Medusa migrations
railway run npm run migrate

# Optional: Seed database with initial data
railway run npm run seed
```

### 7. Configure Domain (Optional)

In Railway dashboard:
1. Go to your project settings
2. Add custom domain (e.g., `api.kctmenswear.com`)
3. Update CORS settings to include your custom domain

## 🔧 Configuration Details

### Required Files Created

- ✅ `railway.toml` - Railway deployment configuration
- ✅ `Dockerfile` - Container configuration (already exists)
- ✅ `.env.production.template` - Production environment template
- ✅ Updated `medusa-config.js` with GA4 integration

### Database Configuration

Railway automatically provides:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

These are automatically injected into your application.

### GA4 Integration

The backend is configured with:
- **Measurement ID**: `G-LH26GTWFQS`
- **Server-side tracking** for e-commerce events
- **Enhanced e-commerce** tracking (purchases, cart events, etc.)

## 🌍 Access Points

After deployment, your application will be available at:

- **API Base**: `https://your-app-name.up.railway.app`
- **Admin Panel**: `https://your-app-name.up.railway.app/admin`
- **Store API**: `https://your-app-name.up.railway.app/store`
- **Health Check**: `https://your-app-name.up.railway.app/admin/system/health`

## 🔐 Security Checklist

### ✅ Required Security Steps

1. **Generate New Secrets**: Replace all development secrets with production-grade keys
2. **Update CORS**: Configure proper CORS origins for production domains
3. **SSL/TLS**: Railway provides HTTPS by default
4. **Environment Variables**: Ensure no sensitive data in code
5. **API Keys**: Use production API keys for all external services

### 🔑 Generate Production Secrets

```bash
# Generate secure random secrets (32+ characters)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('COOKIE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   railway logs --deployment
   ```

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is set
   - Check database service status
   - Run migrations: `railway run npm run migrate`

3. **Redis Connection Issues**
   - Verify `REDIS_URL` is set
   - Check Redis service status

4. **Environment Variables**
   ```bash
   railway variables
   ```

5. **Health Check Failures**
   - Check application logs
   - Verify port 9000 is exposed
   - Test health endpoint

### Debug Commands

```bash
# View application logs
railway logs

# View environment variables
railway variables

# Run commands in production environment
railway run <command>

# Connect to production database
railway connect postgres

# Connect to Redis
railway connect redis
```

## 📊 Monitoring

### Built-in Monitoring

- **Railway Dashboard**: Monitor deployments, logs, and metrics
- **Health Checks**: Automatic health monitoring at `/admin/system/health`
- **GA4 Analytics**: Track e-commerce events and user behavior

### Custom Analytics Available

- **Sales Analytics**: Revenue, orders, customer metrics
- **Inventory Analytics**: Stock levels, low inventory alerts
- **Customer Analytics**: Acquisition, top customers, behavior

## 🔄 Updates & Maintenance

### Deploying Updates

```bash
# Deploy latest changes
railway deploy

# Watch deployment logs
railway logs --tail
```

### Database Maintenance

```bash
# Run new migrations
railway run npm run migrate

# Backup database (if needed)
railway connect postgres -- pg_dump
```

### Scaling

Railway provides:
- **Automatic scaling** based on traffic
- **Resource monitoring** in dashboard
- **Performance metrics** and alerts

## 📞 Support

For deployment issues:
1. Check Railway documentation: https://docs.railway.app
2. Review application logs: `railway logs`
3. Check environment variables: `railway variables`
4. Test health endpoint: `/admin/system/health`

---

**Next Steps**: After successful deployment, you can proceed with frontend development and integration. The admin panel will be accessible at your Railway app URL + `/admin`.