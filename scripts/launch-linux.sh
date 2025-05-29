#!/bin/bash

# GEFRAN Network Settings Launcher for Linux
# This script handles running the app with proper permissions

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ELECTRON_APP="$APP_DIR/node_modules/.bin/electron"

echo "🚀 Starting GEFRAN Network Settings..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Running as root - adding sandbox flags for security"
    
    # Build the frontend if needed
    if [ ! -d "$APP_DIR/out" ]; then
        echo "📦 Building frontend..."
        cd "$APP_DIR"
        npm run export
    fi
    
    # Run Electron with root-safe flags
    exec "$ELECTRON_APP" "$APP_DIR" \
        --no-sandbox \
        --disable-setuid-sandbox \
        --disable-dev-shm-usage \
        --disable-accelerated-2d-canvas \
        --no-first-run \
        --no-zygote \
        --single-process
else
    echo "👤 Running as regular user"
    
    # Check if we need sudo for network operations
    echo "🔐 Network management requires root privileges."
    echo "    You may be prompted for your password for network operations."
    
    # Build the frontend if needed
    if [ ! -d "$APP_DIR/out" ]; then
        echo "📦 Building frontend..."
        cd "$APP_DIR"
        npm run export
    fi
    
    # Run normally
    cd "$APP_DIR"
    exec "$ELECTRON_APP" .
fi 