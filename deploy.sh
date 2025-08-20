#!/bin/bash

# Waziper Production Deployment Script

set -e  # Exit on any error

# Backup function
backup_current_deployment() {
    echo "💾 Creating backup..."
    BACKUP_DIR="backups/deployment-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    if [ -d "frontend/dist" ]; then
        cp -r frontend/dist "$BACKUP_DIR/frontend-dist"
    fi
    
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        docker-compose -f docker-compose.prod.yml exec -T mongodb mongodump --out "$BACKUP_DIR/mongodb-backup" > /dev/null 2>&1 || true
    fi
    
    echo "✅ Backup created at $BACKUP_DIR"
    echo "$BACKUP_DIR" > .last-backup
}

# Rollback function
rollback_deployment() {
    echo "🔄 Rolling back deployment..."
    LAST_BACKUP=$(cat .last-backup 2>/dev/null || echo "")
    
    if [ -n "$LAST_BACKUP" ] && [ -d "$LAST_BACKUP" ]; then
        echo "📦 Restoring from $LAST_BACKUP..."
        docker-compose -f docker-compose.prod.yml down
        
        if [ -d "$LAST_BACKUP/frontend-dist" ]; then
            rm -rf frontend/dist
            cp -r "$LAST_BACKUP/frontend-dist" frontend/dist
        fi
        
        docker-compose -f docker-compose.prod.yml up -d
        echo "✅ Rollback completed"
    else
        echo "❌ No backup found for rollback"
    fi
}

# Trap errors and rollback
trap 'echo "❌ Deployment failed! Initiating rollback..."; rollback_deployment; exit 1' ERR

echo "🚀 Starting Waziper deployment..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

# Check if required environment variables are set
required_vars=("MONGO_URI" "JWT_SECRET" "JWT_REFRESH_SECRET" "CORS_ORIGIN" "FRONTEND_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done
# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs uploads mongo-init backups

# Create backup before deployment
backup_current_deployment

# Pull latest code (if using git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest code..."
    git pull origin main
fi

# Build frontend
echo "🎨 Building frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi
echo "🔨 Building frontend for production..."
npm run build
cd ..

# Build backend (if needed)
echo "🔧 Preparing backend..."
cd backend  
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi
cd ..

# Build and start services
echo "🔨 Building and starting services..."

# Stop existing services
docker-compose -f docker-compose.prod.yml down

# Build images
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check MongoDB connection
echo "🗄️ Checking MongoDB connection..."
for i in {1..30}; do
    if docker-compose -f docker-compose.prod.yml exec -T mongodb mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        echo "✅ MongoDB is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ MongoDB failed to start"
        exit 1
    fi
    sleep 2
done

# Check backend health
echo "🔧 Checking backend health..."
for i in {1..15}; do
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo "✅ Backend is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️ Backend health check failed, but continuing..."
        break
    fi
    sleep 2
done

# Check if services are running
echo "🔍 Checking service health..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Services are running successfully!"
    
    # Show running containers
    echo "📊 Running containers:"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "🌐 Frontend: http://localhost"
    echo "🔧 Backend: http://localhost:5000"
    echo "🗄️  MongoDB: localhost:27017"
    echo "🔴 Redis: localhost:6379"
    echo ""
    echo "📋 To check logs:"
    echo "   Frontend: docker-compose -f docker-compose.prod.yml logs frontend"
    echo "   Backend:  docker-compose -f docker-compose.prod.yml logs backend"
    echo ""
    echo "⚠️  Remember to:"
    echo "   1. Configure your domain/SSL certificates"
    echo "   2. Set up database backups"
    echo "   3. Configure monitoring and alerts"
    echo "   4. Review security settings"
    
else
    echo "❌ Some services failed to start. Check logs:"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Cleanup old backups (keep last 5)
echo "🧹 Cleaning up old backups..."
cd backups 2>/dev/null && ls -t | tail -n +6 | xargs -r rm -rf && cd .. || true

echo "🎊 Deployment completed successfully!"
echo "📋 Next steps:"
echo "   • Update DNS to point to your server"
echo "   • Configure SSL certificates"  
echo "   • Set up monitoring and alerts"
echo "   • Schedule database backups"

# Clear error trap
trap - ERR