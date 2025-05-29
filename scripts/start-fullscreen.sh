#!/bin/bash

echo "🖥️  Starting GEFRAN Network Settings in Fullscreen Mode..."

# Check if the app is built
if [ ! -d "out" ]; then
    echo "📦 Building frontend first..."
    npm run export
    
    if [ $? -ne 0 ]; then
        echo "❌ Frontend build failed"
        exit 1
    fi
fi

# Start Electron in fullscreen mode
echo "🚀 Launching in fullscreen..."
electron . --start-fullscreen --kiosk

# Alternative command if the above doesn't work
# electron . --fullscreen 