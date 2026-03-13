#!/bin/bash

# OrbitAI - Start All Servers Script
# This script starts the frontend and backend servers together

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting OrbitAI - All Servers${NC}"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if node_modules exists in root
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Check if node_modules exists in server
if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    cd server
    npm install
    cd ..
fi

# Check if concurrently is installed
if ! npm list concurrently &>/dev/null; then
    echo -e "${YELLOW}📦 Installing concurrently...${NC}"
    npm install --save-dev concurrently
fi

# Check for MongoDB (optional - backend will handle connection errors gracefully)
echo -e "${BLUE}🔍 Checking MongoDB...${NC}"
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
        echo -e "${GREEN}✅ MongoDB is running${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB is not running locally${NC}"
        echo -e "${YELLOW}💡 Tip: Start MongoDB with: cd server && docker-compose up -d mongodb${NC}"
    fi
elif command -v docker &> /dev/null; then
    if docker ps | grep -q mongo; then
        echo -e "${GREEN}✅ MongoDB container is running${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB container not found${NC}"
        echo -e "${YELLOW}💡 Tip: Start MongoDB with: cd server && docker-compose up -d mongodb${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  MongoDB not detected. Make sure MongoDB is accessible at the configured URI.${NC}"
fi

echo ""
echo -e "${GREEN}🌟 Starting all servers...${NC}"
echo -e "${BLUE}📍 Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}📍 Backend:  http://localhost:3001${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Start both servers using concurrently
npm run dev:all

