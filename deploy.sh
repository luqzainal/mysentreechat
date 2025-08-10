#!/bin/bash

# Waziper Production Deployment Script

set -e  # Exit on any error

echo "🚀 Starting Waziper deployment..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

# Check if required environment variables are set
required_vars=("MONGODB_URI" "JWT_SECRET" "EMAIL_USER" "EMAIL_PASS")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs uploads mongo-init

# Pull latest code (if using git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest code..."
    git pull origin main
fi

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
sleep 30

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