# Deployment Guide

This guide covers deploying WhyKnot.live to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Frontend Deployment](#frontend-deployment)
 - [Vercel](#vercel-recommended)
 - [Netlify](#netlify)
 - [Custom Server](#custom-server)
- [Backend Deployment](#backend-deployment)
 - [Railway](#railway-recommended)
 - [Heroku](#heroku)
 - [Fly.io](#flyio)
 - [DigitalOcean](#digitalocean)
- [Database Setup](#database-setup)
- [Domain Configuration](#domain-configuration)
- [SSL/TLS Certificates](#ssltls-certificates)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- Git repository set up
- All tests passing locally
- Environment variables documented
- MongoDB database (local or cloud)
- Domain name (optional but recommended)
- Accounts on deployment platforms

## Environment Configuration

### Backend Environment Variables

Required for all deployments:

```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
MONGODB_DB=whyknot

# Server
PORT=3001
CORS_ORIGIN=https://whyknot.live

# Email (Optional)
ENABLE_EMAIL=1
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key
```

### Frontend Environment Variables

```env
PUBLIC_API_BASE_URL=https://api.whyknot.live
PUBLIC_SITE_NAME=WhyKnot Live
```

---

## Frontend Deployment

The frontend is built with Astro and can be deployed to various platforms.

### Vercel (Recommended)

**Why Vercel?**
- Best Astro support
- Automatic deployments
- Edge network
- Zero configuration

**Steps:**

1. **Install Vercel CLI**
 ```bash
 npm i -g vercel
 ```

2. **Login to Vercel**
 ```bash
 vercel login
 ```

3. **Deploy from project root**
 ```bash
 cd frontend
 vercel
 ```

4. **Configure Environment Variables**
 - Go to Vercel Dashboard → Project Settings → Environment Variables
 - Add `PUBLIC_API_BASE_URL` and `PUBLIC_SITE_NAME`

5. **Deploy to Production**
 ```bash
 vercel --prod
 ```

**Configuration:**

`vercel.json` (optional, for advanced config):
```json
{
 "buildCommand": "npm run build",
 "outputDirectory": "dist",
 "framework": "astro",
 "regions": ["sfo1"]
}
```

### Netlify

**Steps:**

1. **Install Netlify CLI**
 ```bash
 npm i -g netlify-cli
 ```

2. **Login to Netlify**
 ```bash
 netlify login
 ```

3. **Initialize**
 ```bash
 cd frontend
 netlify init
 ```

4. **Deploy**
 ```bash
 netlify deploy --prod
 ```

**Configuration:**

`netlify.toml`:
```toml
[build]
 command = "npm run build"
 publish = "dist"

[[redirects]]
 from = "/api/*"
 to = "https://api.whyknot.live/:splat"
 status = 200
 force = true

[build.environment]
 NODE_VERSION = "18"
```

### Custom Server

If deploying to your own server:

```bash
# Build the frontend
cd frontend
npm run build

# Serve with Node.js
npx serve dist -p 4321

# Or use PM2 for process management
npm i -g pm2
pm2 start "npx serve dist -p 4321" --name whyknot-frontend
```

---

## Backend Deployment

### Railway (Recommended)

**Why Railway?**
- Simple setup
- Automatic HTTPS
- Built-in PostgreSQL/MongoDB
- Affordable pricing

**Steps:**

1. **Install Railway CLI**
 ```bash
 npm i -g @railway/cli
 ```

2. **Login**
 ```bash
 railway login
 ```

3. **Initialize Project**
 ```bash
 cd backend
 railway init
 ```

4. **Add Environment Variables**
 ```bash
 railway variables set MONGODB_URI=mongodb+srv://...
 railway variables set MONGODB_DB=whyknot
 railway variables set CORS_ORIGIN=https://whyknot.live
 ```

5. **Deploy**
 ```bash
 railway up
 ```

**Configuration:**

`railway.json`:
```json
{
 "build": {
 "builder": "nixpacks",
 "buildCommand": "npm run build"
 },
 "deploy": {
 "startCommand": "npm start",
 "healthcheckPath": "/",
 "healthcheckTimeout": 100
 }
}
```

### Heroku

**Steps:**

1. **Install Heroku CLI**
 ```bash
 brew install heroku/brew/heroku # macOS
 # or
 npm i -g heroku
 ```

2. **Login**
 ```bash
 heroku login
 ```

3. **Create App**
 ```bash
 cd backend
 heroku create whyknot-api
 ```

4. **Set Environment Variables**
 ```bash
 heroku config:set MONGODB_URI=mongodb+srv://...
 heroku config:set MONGODB_DB=whyknot
 heroku config:set CORS_ORIGIN=https://whyknot.live
 ```

5. **Deploy**
 ```bash
 git push heroku main
 ```

**Configuration:**

`Procfile`:
```
web: npm start
```

### Fly.io

**Steps:**

1. **Install Fly CLI**
 ```bash
 brew install flyctl # macOS
 ```

2. **Login**
 ```bash
 fly auth login
 ```

3. **Launch App**
 ```bash
 cd backend
 fly launch
 ```

4. **Set Secrets**
 ```bash
 fly secrets set MONGODB_URI=mongodb+srv://...
 fly secrets set MONGODB_DB=whyknot
 fly secrets set CORS_ORIGIN=https://whyknot.live
 ```

5. **Deploy**
 ```bash
 fly deploy
 ```

**Configuration:**

`fly.toml`:
```toml
app = "whyknot-api"
primary_region = "sjc"

[build]
 builder = "heroku/buildpacks:20"

[env]
 PORT = "8080"

[http_service]
 internal_port = 8080
 force_https = true
 auto_stop_machines = true
 auto_start_machines = true
 min_machines_running = 1

[[services]]
 protocol = "tcp"
 internal_port = 8080

 [[services.ports]]
 port = 80
 handlers = ["http"]

 [[services.ports]]
 port = 443
 handlers = ["tls", "http"]
```

### DigitalOcean

**Using App Platform:**

1. Create a new app in DigitalOcean
2. Connect your GitHub repository
3. Select `backend` folder as source
4. Configure environment variables
5. Deploy

**Using Droplet (VPS):**

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x bash -
apt-get install -y nodejs

# Clone repository
git clone https://github.com/jayptl-me/whyknot.live.git
cd whyknot.live/backend

# Install dependencies
npm install

# Create.env file
nano.env
# Add your environment variables

# Build
npm run build

# Install PM2
npm i -g pm2

# Start with PM2
pm2 start dist/index.js --name whyknot-backend
pm2 save
pm2 startup
```

---

## Database Setup

### MongoDB Atlas (Recommended)

1. **Create Account**
 - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
 - Sign up for free tier

2. **Create Cluster**
 - Choose cloud provider (AWS/GCP/Azure)
 - Select region closest to your backend
 - Use free tier (M0)

3. **Create Database User**
 - Database Access → Add New Database User
 - Choose password authentication
 - Set strong password

4. **Whitelist IP**
 - Network Access → Add IP Address
 - For development: Allow from anywhere (0.0.0.0/0)
 - For production: Add your backend server IPs

5. **Get Connection String**
 - Clusters → Connect → Connect your application
 - Copy connection string
 - Replace `<password>` with your database user password

 ```
 mongodb+srv://username:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
 ```

6. **Create Database and Collection**
 ```bash
 # Using MongoDB Shell
 mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net/" --username username
 
 use whyknot
 db.waitlist.createIndex({ email: 1 }, { unique: true })
 ```

### Self-Hosted MongoDB

If you prefer to host MongoDB yourself:

```bash
# Install MongoDB on Ubuntu
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" tee /etc/apt/sources.list.d/mongodb-org-5.0.list
apt-get update
apt-get install -y mongodb-org

# Start MongoDB
systemctl start mongod
systemctl enable mongod

# Create admin user
mongosh
use admin
db.createUser({
 user: "admin",
 pwd: "secure_password",
 roles: ["root"]
})
```

---

## Domain Configuration

### DNS Setup

Point your domain to your deployments:

**Frontend (Vercel/Netlify):**
```
Type: A
Name: @
Value: [Vercel/Netlify IP]

Type: CNAME
Name: www
Value: [your-project].vercel.app
```

**Backend (Railway/Heroku):**
```
Type: CNAME
Name: api
Value: [your-backend].railway.app
```

### Custom Domains

**On Vercel:**
1. Go to Project Settings → Domains
2. Add custom domain
3. Follow DNS configuration instructions

**On Railway:**
1. Go to Project → Settings → Domains
2. Add custom domain
3. Update DNS records

---

## SSL/TLS Certificates

Most modern platforms (Vercel, Netlify, Railway, Heroku) provide automatic HTTPS with Let's Encrypt certificates.

For custom servers:

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d whyknot.live -d www.whyknot.live -d api.whyknot.live

# Auto-renewal
certbot renew --dry-run
```

---

## Monitoring & Maintenance

### Health Checks

Set up health check endpoints:

**Backend:**
```typescript
app.get('/health', (c) => {
 return c.json({
 status: 'healthy',
 timestamp: new Date().toISOString(),
 uptime: process.uptime()
 });
});
```

### Logging

**Production Logging:**
```typescript
import pino from 'pino';

const logger = pino({
 level: process.env.LOG_LEVEL 'info',
 transport: {
 target: 'pino-pretty',
 options: {
 colorize: false
 }
 }
});

app.use('*', async (c, next) => {
 const start = Date.now();
 await next();
 const ms = Date.now() - start;
 logger.info(`${c.req.method} ${c.req.url} - ${ms}ms`);
});
```

### Error Tracking

Integrate Sentry:

```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
 dsn: process.env.SENTRY_DSN,
 environment: process.env.NODE_ENV,
 tracesSampleRate: 1.0
});
```

### Uptime Monitoring

Use services like:
- [UptimeRobot](https://uptimerobot.com/) (Free)
- [Pingdom](https://www.pingdom.com/)
- [Better Uptime](https://betteruptime.com/)

---

## Troubleshooting

### Common Issues

**1. CORS Errors**

```typescript
// Ensure CORS_ORIGIN is set correctly
app.use('/api/*', cors({
 origin: process.env.CORS_ORIGIN '*'
}));
```

**2. Database Connection Fails**

```bash
# Check connection string
echo $MONGODB_URI

# Test connection
mongosh "$MONGODB_URI"

# Verify IP whitelist on MongoDB Atlas
```

**3. Build Failures**

```bash
# Check Node.js version
node --version # Should be 18+

# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

**4. Environment Variables Not Loading**

```bash
# Verify variables are set
railway variables list # Railway
heroku config # Heroku
vercel env ls # Vercel
```

**5. High Memory Usage**

```typescript
// Implement connection pooling
const client = new MongoClient(uri, {
 maxPoolSize: 10,
 minPoolSize: 5
});
```

### Performance Optimization

**Enable Compression:**
```typescript
import { compress } from 'hono/compress';
app.use('*', compress());
```

**Cache Static Assets:**
```typescript
app.use('/static/*', async (c, next) => {
 c.header('Cache-Control', 'public, max-age=31536000');
 await next();
});
```

**Database Indexes:**
```javascript
db.waitlist.createIndex({ email: 1 }, { unique: true });
db.waitlist.createIndex({ createdAt: -1 });
```

---

## Deployment Checklist

Before going live:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database backups configured
- [ ] SSL/HTTPS enabled
- [ ] Custom domain configured
- [ ] Error tracking setup
- [ ] Monitoring enabled
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] CORS properly configured
- [ ] Email service tested
- [ ] Health checks working
- [ ] Documentation updated
- [ ] Team notified

---

## Rollback Procedure

If something goes wrong:

**Vercel:**
```bash
vercel rollback [deployment-url]
```

**Railway:**
```bash
railway rollback
```

**Heroku:**
```bash
heroku releases
heroku rollback v123
```

**Git-based:**
```bash
git revert HEAD
git push origin main
```

---

Need help? Check our [GitHub Discussions](https://github.com/jayptl-me/whyknot.live/discussions) or open an issue.

---

Last Updated: October 23, 2025
