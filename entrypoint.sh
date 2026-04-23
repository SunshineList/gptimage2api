#!/bin/sh

# Set data directory permissions if needed
mkdir -p /app/data/images

# Start backend
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --access-log &
BACKEND_PID=$!

# Trap signals and forward them to the backend
trap "kill $BACKEND_PID" EXIT

# Start Nginx in foreground
echo "🚀 Starting gptimage2api..."
nginx -g "daemon off;"
