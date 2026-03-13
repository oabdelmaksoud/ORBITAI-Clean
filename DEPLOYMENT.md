# OrbitAI Deployment Guide

Complete guide for deploying OrbitAI to production.

## Prerequisites

- Node.js 22+ (LTS)
- MongoDB 7+
- Redis 7+
- Docker & Docker Compose (optional)
- GitHub account (for OAuth)
- Domain with SSL certificate

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb://localhost:27017/orbitai
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=7d

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=https://yourdomain.com/api/integrations/github/callback

# AI APIs (Optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL
CLIENT_URL=https://yourdomain.com

# Session
SESSION_SECRET=your-session-secret-change-this
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Build and start services:**
```bash
cd docker
docker-compose up -d
```

2. **Check status:**
```bash
docker-compose ps
docker-compose logs -f app
```

3. **Stop services:**
```bash
docker-compose down
```

4. **Update application:**
```bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Option 2: Manual Deployment

1. **Install dependencies:**
```bash
npm ci --only=production
```

2. **Build application:**
```bash
npm run build
```

3. **Start MongoDB and Redis:**
```bash
# MongoDB
sudo systemctl start mongod

# Redis
sudo systemctl start redis
```

4. **Run database migrations:**
```bash
npm run migrate
```

5. **Start application:**
```bash
npm start
```

6. **Use PM2 for process management:**
```bash
npm install -g pm2
pm2 start npm --name orbitai -- start
pm2 save
pm2 startup
```

### Option 3: Kubernetes

1. **Apply configurations:**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

2. **Check status:**
```bash
kubectl get pods -n orbitai
kubectl logs -f deployment/orbitai -n orbitai
```

## Database Setup

### MongoDB Indexes

Create indexes for optimal performance:

```javascript
// Run in MongoDB shell
use orbitai;

// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

// Workspace indexes
db.workspaces.createIndex({ slug: 1 }, { unique: true });
db.workspaces.createIndex({ owner: 1 });
db.workspaces.createIndex({ "members.user": 1 });

// Project indexes
db.projects.createIndex({ workspace: 1, createdAt: -1 });
db.projects.createIndex({ "members.user": 1 });

// Comment indexes
db.comments.createIndex({ resourceType: 1, resourceId: 1, createdAt: -1 });
db.comments.createIndex({ author: 1 });
db.comments.createIndex({ parentComment: 1 });

// Notification indexes
db.notifications.createIndex({ user: 1, createdAt: -1 });
db.notifications.createIndex({ user: 1, read: 1 });

// Time Entry indexes
db.timeentries.createIndex({ user: 1, startTime: -1 });
db.timeentries.createIndex({ project: 1, startTime: -1 });
db.timeentries.createIndex({ user: 1, isRunning: 1 });
```

### Database Backup

```bash
# Backup
mongodump --uri="mongodb://localhost:27017/orbitai" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/orbitai" /backup/20260214
```

## Nginx Configuration

Create `/etc/nginx/sites-available/orbitai`:

```nginx
upstream orbitai_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend (static files)
    location / {
        root /var/www/orbitai/dist/client;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://orbitai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://orbitai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/orbitai /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already set up by certbot)
sudo certbot renew --dry-run
```

## GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: OrbitAI
   - Homepage URL: https://yourdomain.com
   - Authorization callback URL: https://yourdomain.com/api/integrations/github/callback
4. Copy Client ID and Client Secret to `.env`

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T20:00:00.000Z",
  "uptime": 3600,
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

### Application Logs

```bash
# PM2
pm2 logs orbitai --lines 100

# Docker
docker-compose logs -f app

# System logs
journalctl -u orbitai -f
```

### Resource Monitoring

```bash
# PM2
pm2 monit

# Docker stats
docker stats

# System resources
htop
```

## Security Checklist

- [ ] Change all default secrets
- [ ] Enable firewall (UFW/iptables)
- [ ] Configure SSL/TLS
- [ ] Set up database authentication
- [ ] Enable Redis password
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Database backups scheduled
- [ ] Log rotation configured
- [ ] Monitoring alerts set up

## Performance Optimization

1. **Enable Redis caching:**
```javascript
// Already implemented in the code
```

2. **Database connection pooling:**
```javascript
// MongoDB connection options
mongoose.connect(uri, {
  maxPoolSize: 100,
  minPoolSize: 10,
  socketTimeoutMS: 45000
});
```

3. **Nginx caching:**
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=orbitai_cache:10m max_size=10g inactive=60m;
proxy_cache orbitai_cache;
proxy_cache_valid 200 60m;
```

## Troubleshooting

### Application won't start

1. Check logs
2. Verify environment variables
3. Ensure MongoDB and Redis are running
4. Check port availability: `lsof -i :3001`

### Database connection failed

1. Verify MongoDB is running: `systemctl status mongod`
2. Check connection string in `.env`
3. Test connection: `mongosh "mongodb://localhost:27017/orbitai"`

### High memory usage

1. Check for memory leaks: `pm2 monit`
2. Restart application
3. Consider increasing server resources

## Scaling

### Horizontal Scaling

1. **Load Balancer:** Use Nginx/HAProxy
2. **Multiple instances:** `pm2 scale orbitai 4`
3. **Session storage:** Use Redis for sessions
4. **Database:** MongoDB replica set

### Vertical Scaling

1. Increase server resources (CPU/RAM)
2. Optimize database queries
3. Enable caching
4. Use CDN for static assets

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/orbitai/issues
- Documentation: https://docs.orbitai.com
- Discord: https://discord.gg/orbitai
