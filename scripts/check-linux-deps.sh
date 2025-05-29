#!/bin/bash

echo "🔍 Checking Linux dependencies for GEFRAN Network Settings..."

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script is for Linux systems only"
    exit 1
fi

# Check for required libraries
echo "📦 Checking for required libraries..."

# Check for FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg is installed"
else
    echo "❌ FFmpeg is missing. Install with: sudo apt install ffmpeg"
fi

# Check for libavcodec
if ldconfig -p | grep -q libavcodec; then
    echo "✅ libavcodec found"
else
    echo "❌ libavcodec missing. Install with: sudo apt install libavcodec-extra"
fi

# Check for libffmpeg.so specifically
if ldconfig -p | grep -q libffmpeg; then
    echo "✅ libffmpeg found"
else
    echo "⚠️  libffmpeg not found in system libraries"
fi

# Check Electron installation
if [ -d "node_modules/electron" ]; then
    echo "✅ Electron is installed"
    ELECTRON_VERSION=$(node -e "console.log(require('./node_modules/electron/package.json').version)")
    echo "   Version: $ELECTRON_VERSION"
else
    echo "❌ Electron not found. Run: npm install"
fi

echo ""
echo "🚀 If you see any ❌ or ⚠️  above, run these commands:"
echo "   sudo apt update"
echo "   sudo apt install ffmpeg libavcodec-extra ubuntu-restricted-extras"
echo "   npm install"
echo ""
echo "💡 If issues persist, try running the app with:"
echo "   npm run electron -- --no-sandbox --disable-gpu" 