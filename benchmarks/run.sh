#!/bin/bash

set -e

PORT=${PORT:-8000}
DURATION=${DURATION:-10s}

echo "=== Hectoday HTTP Benchmark ==="
echo ""

# Check if wrk is installed
if ! command -v wrk &> /dev/null; then
    echo "❌ wrk is not installed"
    echo "Install: brew install wrk (macOS) or apt-get install wrk (Linux)"
    exit 1
fi

# Start server
echo "Starting server on port $PORT..."
deno run --allow-net --allow-env server.ts &
SERVER_PID=$!

# Wait for server
sleep 2

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

echo ""
echo "=== GET / (plain text) ==="
wrk -t2 -c10 -d$DURATION http://localhost:$PORT/

echo ""
echo "=== GET /json ==="
wrk -t2 -c10 -d$DURATION http://localhost:$PORT/json

echo ""
echo "=== GET /users/:id (with params) ==="
wrk -t2 -c10 -d$DURATION http://localhost:$PORT/users/123

echo ""
echo "✅ Benchmark complete!"
