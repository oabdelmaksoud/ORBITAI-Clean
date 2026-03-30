#!/bin/bash
# OrbitAI Quick Start Script
# Usage: ./start.sh [docker|local]

set -e
MODE="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  OrbitAI - Starting in $MODE mode"
echo "============================================"

cleanup() {
  echo ""
  echo "Stopping OrbitAI..."
  [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
  [ -n "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null
  echo "Stopped."
  exit 0
}

if [ "$MODE" = "docker" ]; then
  echo "Starting with Docker Compose..."
  cd "$SCRIPT_DIR"
  docker compose up --build -d
  echo ""
  echo "Services starting up..."
  sleep 10
  echo ""
  echo "============================================"
  echo "  OrbitAI is running!"
  echo "============================================"
  echo ""
  echo "  Open in browser: http://localhost:5173"
  echo "  API Docs:        http://localhost:3002/api-docs"
  echo ""
  echo "  Run 'docker compose logs -f' to see logs"
  echo "  Run 'docker compose down' to stop"

elif [ "$MODE" = "local" ]; then
  # Check prerequisites
  if ! command -v node &> /dev/null; then
    echo "Error: Node.js 18+ required. Install from https://nodejs.org"
    exit 1
  fi

  if ! command -v docker &> /dev/null; then
    echo "Error: Docker required for MongoDB. Install from https://docker.com"
    exit 1
  fi

  cd "$SCRIPT_DIR"

  # Step 1: MongoDB
  echo ""
  echo "[1/5] Starting MongoDB..."
  if docker ps --format '{{.Names}}' | grep -q orbitai-mongo; then
    echo "  MongoDB already running."
  elif docker ps -a --format '{{.Names}}' | grep -q orbitai-mongo; then
    docker start orbitai-mongo > /dev/null
    echo "  MongoDB started."
  else
    docker run -d --name orbitai-mongo -p 27017:27017 mongo:7 > /dev/null
    echo "  MongoDB container created and started."
  fi
  sleep 2

  # Step 2: Dependencies
  echo "[2/5] Installing dependencies..."
  npm install --silent 2>/dev/null || npm install 2>&1 | tail -3

  # Step 3: .env
  if [ ! -f .env ]; then
    echo "[3/5] Creating .env from example..."
    if [ -f .env.example ]; then
      cp .env.example .env
    else
      cat > .env << 'ENVEOF'
NODE_ENV=development
PORT=3002
MONGODB_URI=mongodb://localhost:27017/orbitai
JWT_SECRET=orbitai-dev-secret-change-in-production
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
ENVEOF
    fi
    echo "  .env created. Edit it to add your API keys."
  else
    echo "[3/5] .env already exists."
  fi

  # Step 4: Build server
  echo "[4/5] Building server..."
  cd server
  npx tsc --noEmit false --noEmitOnError false 2>/dev/null
  cd "$SCRIPT_DIR"
  echo "  Server built."

  # Step 5: Start services
  echo "[5/5] Starting services..."

  trap cleanup INT TERM

  # Start server
  cd server
  node dist/index.js > /tmp/orbitai-server.log 2>&1 &
  SERVER_PID=$!
  cd "$SCRIPT_DIR"

  # Start client dev server
  cd client
  npx vite --host 0.0.0.0 > /tmp/orbitai-client.log 2>&1 &
  CLIENT_PID=$!
  cd "$SCRIPT_DIR"

  # Wait for services to be ready
  echo "  Waiting for services..."
  for i in $(seq 1 30); do
    if curl -s http://localhost:3002/health > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  for i in $(seq 1 30); do
    if curl -s http://localhost:5173/ > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  # Verify
  SERVER_OK=$(curl -s http://localhost:3002/health 2>/dev/null | grep -c "ok" || true)
  CLIENT_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null)

  echo ""
  echo "============================================"
  if [ "$SERVER_OK" = "1" ] && [ "$CLIENT_OK" = "200" ]; then
    echo "  OrbitAI is running!"
  else
    echo "  OrbitAI started (check logs if issues)"
  fi
  echo "============================================"
  echo ""
  echo "  Open in browser: http://localhost:5173"
  echo "  API Docs:        http://localhost:3002/api-docs"
  echo ""
  echo "  Server log: tail -f /tmp/orbitai-server.log"
  echo "  Client log: tail -f /tmp/orbitai-client.log"
  echo ""
  echo "  Press Ctrl+C to stop"
  echo ""

  wait
else
  echo "Usage: ./start.sh [docker|local]"
  echo ""
  echo "  local  - Run locally with Docker MongoDB (default)"
  echo "  docker - Run everything in Docker containers"
fi
