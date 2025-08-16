#!/bin/bash

# Copy production environment
cp .env.production .env

# Start with PM2
pm2 start ecosystem.config.js --env production

# Show status
pm2 status

# Show logs
pm2 logs waziper-backend --lines 50