# Waziper Production Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Domain name configured (optional but recommended)
- SSL certificates (for HTTPS)
- SMTP email service configured

## Quick Setup

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd WAZIPER-V2
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your production values:

```bash
# Database Configuration
MONGODB_URI=mongodb://username:password@mongodb:27017/waziper
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=your-strong-password

# JWT Secret (generate a strong random key)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

## Manual Deployment

### 1. Build Frontend
```bash
cd frontend
npm install
npm run build:prod
```

### 2. Build and Start Services
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## Post-Deployment Configuration

### 1. Database Setup
The MongoDB will be initialized automatically. First user registration will create an admin user.

### 2. File Uploads Directory
Ensure the uploads directory has proper permissions:
```bash
mkdir -p uploads
chmod 755 uploads
```

### 3. SSL Setup (Recommended)
For production, configure SSL certificates:

```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d chatbot.kuasaplus.com
```

### 4. Nginx Configuration (if using reverse proxy)
```nginx
server {
    listen 443 ssl http2;
    server_name chatbot.kuasaplus.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring and Maintenance

### Check Service Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Backup Database
```bash
# Create backup
docker exec mongodb mongodump --out /backup --db waziper

# Restore backup
docker exec mongodb mongorestore /backup
```

### Update Application
```bash
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

## Security Checklist

- [ ] Strong passwords for all services
- [ ] JWT secret is randomly generated and secure
- [ ] Email credentials are secure
- [ ] MongoDB authentication enabled
- [ ] Redis password protected
- [ ] Firewall configured properly
- [ ] SSL/TLS certificates installed
- [ ] Regular backups scheduled
- [ ] Rate limiting configured
- [ ] Error logs monitored

## Troubleshooting

### Service Won't Start
1. Check Docker logs: `docker-compose -f docker-compose.prod.yml logs [service-name]`
2. Verify environment variables in `.env`
3. Check port availability
4. Ensure proper file permissions

### Database Connection Issues
1. Verify MongoDB is running: `docker-compose -f docker-compose.prod.yml ps mongodb`
2. Check MongoDB logs: `docker-compose -f docker-compose.prod.yml logs mongodb`
3. Verify MONGODB_URI in `.env`

### Email Not Working
1. Verify EMAIL_USER and EMAIL_PASS in `.env`
2. For Gmail, use App Password instead of regular password
3. Check if 2FA is enabled on email account

### File Upload Issues
1. Check uploads directory permissions
2. Verify MAX_FILE_SIZE configuration
3. Check disk space availability

## Performance Optimization

### Frontend Optimization
- Static assets are compressed and cached
- React build is optimized for production
- Code splitting implemented

### Backend Optimization
- Database indexing configured
- Connection pooling enabled
- Rate limiting implemented

### Database Optimization
- Regular database maintenance
- Proper indexing strategy
- Connection limits configured

## Support

For issues and support:
1. Check logs first
2. Review this documentation
3. Check GitHub issues
4. Contact development team

## Environment Comparison

| Feature | Development | Production |
|---------|-------------|------------|
| Debug Mode | Enabled | Disabled |
| Error Details | Detailed | Generic |
| Asset Optimization | Disabled | Enabled |
| HTTPS | Optional | Required |
| Database | Local/Docker | Managed Service |
| File Storage | Local | Cloud Storage |
| Email Service | Development | Production SMTP |
| Monitoring | Basic | Full Stack |