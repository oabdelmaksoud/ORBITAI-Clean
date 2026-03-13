#!/bin/bash

# Start MongoDB and Backend Server Script

set -e

echo "🚀 Starting OrbitAI Backend with MongoDB..."

# Check if MongoDB is running
if mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo "✅ MongoDB is already running"
else
    echo "⚠️  MongoDB is not running"
    echo ""
    echo "Please start MongoDB using one of these methods:"
    echo ""
    echo "Option 1: Using Docker (if Docker is installed and running):"
    echo "  cd server && docker-compose up -d mongodb"
    echo ""
    echo "Option 2: Using Homebrew (if MongoDB is installed via Homebrew):"
    echo "  brew services start mongodb-community"
    echo ""
    echo "Option 3: Using MongoDB Atlas (cloud - recommended for quick setup):"
    echo "  1. Go to https://www.mongodb.com/cloud/atlas"
    echo "  2. Create a free cluster"
    echo "  3. Get connection string"
    echo "  4. Update server/.env with: MONGODB_URI=mongodb+srv://..."
    echo ""
    echo "Option 4: Install MongoDB locally:"
    echo "  brew tap mongodb/brew"
    echo "  brew install mongodb-community"
    echo "  brew services start mongodb-community"
    echo ""
    
    read -p "Do you want to continue anyway? The server will start but database features won't work. (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Please start MongoDB first."
        exit 1
    fi
fi

# Start the backend server
echo ""
echo "📡 Starting backend server..."
cd "$(dirname "$0")"
npm run dev

