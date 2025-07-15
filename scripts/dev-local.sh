#!/bin/bash

# Local Development Setup Script
# This script sets up the development environment to connect to a local OpenBadges server

echo "🚀 Starting local development setup..."

# Check if local OpenBadges server is running
echo "🔍 Checking if OpenBadges server is running on localhost:3000..."
if curl -s -f -m 5 http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ OpenBadges server is running on port 3000"
else
    echo "❌ OpenBadges server is not running on port 3000"
    echo "Please start the OpenBadges server first:"
    echo "  cd ../openbadges-modular-server"
    echo "  bun dev"
    exit 1
fi

# Load local environment variables
if [ -f .env.local ]; then
    echo "📁 Loading local environment variables..."
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo "⚠️  No .env.local file found, using defaults"
fi

# Start the development servers
echo "🏃 Starting development servers..."
pnpm dev

echo "🎉 Local development setup complete!"
echo "Frontend: http://localhost:7777"
echo "Backend: http://localhost:8888"
echo "OpenBadges: http://localhost:3000"