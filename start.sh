#!/bin/bash
# OrbitAI Quick Start Script
# Usage: ./start.sh [docker|local]

MODE="${1:-local}"

echo "============================================"
echo "  OrbitAI - Starting in $MODE mode"
echo "============================================"

if [ "$MODE" = "docker" ]; then
  echo "Starting with Docker Compose..."
  docker compose up --build -d
  echo ""
  echo "Services starting up..."
  sleep 10
  echo "  Frontend: http://localhost:5173"
  echo "  Backend:  http://localhost:3002"
  echo "  API Docs: http://localhost:3002/api-docs"
  echo ""
  echo "Run 'docker compose logs -f' to see logs"
  echo "Run 'docker compose down' to stop"

elif [ "$MODE" = "local" ]; then
  # Check prerequisites
  if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required. Install from https://nodejs.org"
    exit 1
  fi

  if ! command -v docker &> /dev/null; then
    echo "Error: Docker is required for MongoDB. Install from https://docker.com"
    exit 1
  fi

  echo "Step 1: Starting MongoDB..."
  docker start orbitai-mongo 2>/dev/null || \
    docker run -d --name orbitai-mongo \
      -e MONGO_INITDB_ROOT_USERNAME=orbitai \
      -e MONGO_INITDB_ROOT_PASSWORD=orbitai-temp-pass \
      -p 27017:27017 \
      mongo:7
  sleep 3

  echo "Step 2: Installing dependencies..."
  npm install 2>/dev/null

  echo "Step 3: Building server..."
  cd server && npx tsc --noEmit false --noEmitOnError false 2>/dev/null
  cd ..

  echo "Step 4: Starting server..."
  cd server && node dist/index.js &
  SERVER_PID=$!
  cd ..
  sleep 3

  echo "Step 5: Starting client..."
  cd client && npx vite --host 0.0.0.0 &
  CLIENT_PID=$!
  cd ..
  sleep 3

  echo ""
  echo "============================================"
  echo "  OrbitAI is running!"
  echo "============================================"
  echo ""
  echo "  Frontend: http://localhost:5173"
  echo "  Backend:  http://localhost:3002"
  echo "  API Docs: http://localhost:3002/api-docs"
  echo ""
  echo "  Press Ctrl+C to stop"
  echo ""

  # Trap Ctrl+C to clean up
  trap "echo 'Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT TERM
  wait
else
  echo "Usage: ./start.sh [docker|local]"
  echo "  docker - Run everything in Docker containers"
  echo "  local  - Run server/client locally with Docker MongoDB"
fi
