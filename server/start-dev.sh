#!/bin/bash

# OrbitAI Backend Development Startup Script

echo "🚀 Starting OrbitAI Backend Development Server..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file in the server directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running locally"
        echo "💡 Tip: Start MongoDB or use Docker Compose: docker-compose up -d mongodb"
    fi
elif command -v docker &> /dev/null; then
    if docker ps | grep -q mongo; then
        echo "✅ MongoDB container is running"
    else
        echo "⚠️  MongoDB container not found"
        echo "💡 Starting MongoDB with Docker Compose..."
        docker-compose up -d mongodb
        echo "⏳ Waiting for MongoDB to be ready..."
        sleep 5
    fi
else
    echo "⚠️  MongoDB not detected. Make sure MongoDB is accessible at the configured URI."
fi

echo ""
echo "🌟 Starting development server..."
echo "📍 Server will run on: http://localhost:3001"
echo "📝 Logs will be written to: ./logs/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev

