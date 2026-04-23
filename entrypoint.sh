#!/bin/sh

# Start backend in background
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --access-log &

# Start Nginx in foreground
nginx -g "daemon off;"
