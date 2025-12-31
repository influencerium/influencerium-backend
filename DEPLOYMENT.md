# README.md - Deployment Guide

# Influencerium Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Influencerium application to production.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ database access
- Domain name with DNS access
- SSL certificate (Let's Encrypt or purchased)
- Minimum 1GB RAM, 10GB storage

## Quick Deployment (Docker)

### 1. Clone Repository
```bash
git clone <repository-url>
cd influencerium
```

### 2. Configure Environment
```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit with your values
nano backend/.env
```

Required environment variables:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` (generate with: `openssl rand -base64 64`)
- `SESSION_SECRET` (generate with: `openssl rand -base64 64`)
- `FRONTEND_URL` (your frontend URL)

### 3. Start with Docker Compose
```bash
cd backend

# Start all services (PostgreSQL, Redis, Backend, Nginx)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Verify Deployment
```bash
# Health check
curl http://localhost/health

# API docs
curl http://localhost/api-docs
```

---

## Manual Deployment

### 1. Database Setup

#### Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql@15
brew services start postgresql@15
```

#### Create Database and User
```bash
sudo -i -u postgres
psql

CREATE DATABASE influencerium;
CREATE USER influencerium WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE influencerium TO influencerium;
ALTER DATABASE influencerium OWNER TO influencerium;

\q
```

#### Run Migrations
```bash
cd backend
npm install
npm run migrate
npm run seed  # Optional: add sample data
```

### 2. Backend Deployment

#### Install Dependencies
```bash
cd backend
npm ci --only=production
```

#### Configure PM2 for Process Management
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 delete influencerium-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup

# Monitor
pm2 monit
```

#### Setup Systemd Service (Alternative)
Create `/etc/systemd/system/influencerium.service`:
```ini
[Unit]
Description=Influencerium API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/influencerium/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/influencerium/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable influencerium
sudo systemctl start influencerium
sudo systemctl status influencerium
```

### 3. Frontend Deployment

#### Option A: Vercel (Recommended)
```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Option B: Nginx Static Hosting
```bash
cd frontend

# Copy files to web root
sudo cp -r . /var/www/influencerium

# Set permissions
sudo chown -R www-data:www-data /var/www/influencerium
sudo chmod -R 755 /var/www/influencerium

# Create uploads directory
sudo mkdir -p /var/www/influencerium/uploads
sudo chown www-data:www-data /var/www/influencerium/uploads
```

### 4. Nginx Configuration

#### Install Nginx
```bash
sudo apt-get install nginx
```

#### Configure SSL with Let's Encrypt
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api.influencerium.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### Create Nginx Configuration
Copy `nginx/nginx.conf` to `/etc/nginx/sites-available/influencerium`:
```bash
sudo cp nginx/nginx.conf /etc/nginx/sites-available/influencerium
sudo ln -s /etc/nginx/sites-available/influencerium /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | API port (default: 3000) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port (default: 5432) |
| `DB_USER` | Yes | Database username |
| `DB_PASSWORD` | Yes | Database password |
| `DB_NAME` | Yes | Database name |
| `DB_SSL` | Yes | Use SSL for DB connection (`true`) |
| `JWT_SECRET` | Yes | JWT signing secret (64+ chars) |
| `JWT_EXPIRES_IN` | No | Token expiration (default: 7d) |
| `SESSION_SECRET` | Yes | Session secret key |
| `FRONTEND_URL` | Yes | Frontend application URL |
| `REDIS_ENABLED` | No | Enable Redis caching |
| `SMTP_HOST` | No | SMTP server for emails |
| `SMTP_PORT` | No | SMTP port |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |

---

## Monitoring & Logging

### View Application Logs
```bash
# PM2 logs
pm2 logs influencerium-api

# System logs
journalctl -u influencerium -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Health Check Endpoints
- Backend Health: `http://your-api-domain/health`
- API Docs: `http://your-api-domain/docs`

### Performance Monitoring
```bash
# PM2 monitoring
pm2 monit

# Node.js process info
pm2 show influencerium-api
```

---

## Backup & Recovery

### Database Backup
```bash
# Daily cron backup
0 2 * * * pg_dump -h localhost -U influencerium influencerium | gzip > /backups/influencerium_$(date +\%Y\%m\%d).sql.gz
```

### Restore from Backup
```bash
gunzip -c /backups/influencerium_20240101.sql.gz | psql -h localhost -U influencerium -d influencerium
```

---

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
pm2 logs influencerium-api

# Verify environment
cd backend && node -e "require('dotenv').config(); console.log(process.env.DB_HOST)"
```

### Database Connection Failed
```bash
# Test connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check firewall
sudo ufw status
```

### SSL Certificate Issues
```bash
# Check certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Renew certificate
sudo certbot renew
```

---

## Scaling

### Horizontal Scaling (PM2)
```bash
# Run with multiple instances
pm2 start ecosystem.config.js --max-memory-restart 500M
```

### Database Connection Pooling
Configure in `config.production.yaml`:
```yaml
database:
  pool:
    min: 5
    max: 50
```

### Caching with Redis
```bash
# Enable Redis in .env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET (64+ random characters)
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Enable rate limiting
- [ ] Configure CORS for production domain
- [ ] Set up monitoring and alerts
- [ ] Regular security updates

---

## Support

For issues or questions:
- Documentation: `/api-docs` endpoint
- Health Check: `/health` endpoint
- Logs: `pm2 logs influencerium-api`

---

**Production deployment complete! 🚀**
