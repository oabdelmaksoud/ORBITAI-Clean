#!/bin/bash

# Kill ports 3002 (backend) and 5173 (frontend) to ensure clean slate
echo "🧹 Cleaning up existing processes..."
lsof -ti:3002 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start Backend
echo "🚀 Starting Backend (port 3002)..."
npm run dev:backend > backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready (simple sleep for now, could be smarter)
echo "⏳ Waiting for backend to initialize..."
sleep 10

# Start Backend Tunnel
echo "🔗 Creating public Backend URL (orbitai-demo-api)..."
# We use a temp file to capture the URL from localtunnel
npx -y localtunnel --port 3002 --subdomain orbitai-demo-api > backend_tunnel.log 2>&1 &
LT_BACKEND_PID=$!

# Wait for tunnel URL to generate
sleep 5
BACKEND_URL=$(grep -o 'https://[^ ]*' backend_tunnel.log | head -n 1)

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Failed to generate Backend URL. Check backend_tunnel.log"
    cat backend_tunnel.log
    # Cleanup
    kill $BACKEND_PID 2>/dev/null
    kill $LT_BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend available at: $BACKEND_URL"

# Start Frontend with VITE_API_URL set to the Tunnel URL
echo "🚀 Starting Frontend (port 5173) connected to remote backend..."
# Start Frontend with VITE_API_URL set to the Tunnel URL
echo "🚀 Starting Frontend (port 5173)..."
# We no longer force VITE_API_URL here, enabling relative paths for local users
# The remote user will access via the tunnel URL, and the frontend will use relative paths to the backend tunnel
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "⏳ Waiting for frontend to initialize..."
sleep 5

# Start Frontend Tunnel
echo "🔗 Creating public Frontend URL (orbitai-demo-app)..."
npx -y localtunnel --port 5173 --subdomain orbitai-demo-app > frontend_tunnel.log 2>&1 &
LT_FRONTEND_PID=$!

sleep 5
FRONTEND_URL=$(grep -o 'https://[^ ]*' frontend_tunnel.log | head -n 1)

if [ -z "$FRONTEND_URL" ]; then
    echo "❌ Failed to generate Frontend URL. Check frontend_tunnel.log"
    cat frontend_tunnel.log
    # Cleanup
    kill $BACKEND_PID $FRONTEND_PID $LT_BACKEND_PID $LT_FRONTEND_PID 2>/dev/null
    exit 1
fi

echo "============================================================"
echo "🎉 Remote Access Enabled!"
echo "------------------------------------------------------------"
echo "🌍 Public App URL: $FRONTEND_URL"
echo "🔌 Connected to:   $BACKEND_URL"
echo "------------------------------------------------------------"
echo "🔑 Tunnel Password: $(curl -s https://loca.lt/mytunnelpassword)"
echo "   (Share this IP if the remote user is asked for a password)"
echo "------------------------------------------------------------"
echo "Press Ctrl+C to stop sharing."
echo "============================================================"

# Keep script running to maintain tunnels and processes
# Stream logs so the user sees server activity (like dev:all)
echo "📝 Streaming server logs (Backend & Frontend)..."
echo "============================================================"

# Stream logs in background (using distinct colors if we could, but plain tail for now)
tail -f backend.log frontend.log &
TAIL_PID=$!

# Loop to keep script running and handle cleanup
# We wait on the TAIL process. If verified, Ctrl+C sends SIGINT to script.
trap "kill $BACKEND_PID $FRONTEND_PID $LT_BACKEND_PID $LT_FRONTEND_PID $TAIL_PID 2>/dev/null; exit" SIGINT SIGTERM

wait $TAIL_PID
