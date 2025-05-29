#!/bin/bash

echo "🚀 Building GEFRAN Network Settings AppImage..."

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ AppImage can only be built on Linux systems"
    exit 1
fi

# Check if required tools are installed
echo "🔍 Checking build requirements..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install with: sudo apt install nodejs npm"
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required. Install with: sudo apt install npm"
    exit 1
fi

echo "✅ Build requirements satisfied"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf out/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the frontend
echo "🏗️  Building frontend..."
npm run export

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi

echo "✅ Frontend build complete"

# Build the AppImage
echo "📱 Building AppImage..."
npm run electron:dist-linux

if [ $? -ne 0 ]; then
    echo "❌ AppImage build failed"
    exit 1
fi

# Find the generated AppImage
APPIMAGE_FILE=$(find dist/ -name "*.AppImage" 2>/dev/null | head -1)

if [ -n "$APPIMAGE_FILE" ]; then
    echo "✅ AppImage built successfully!"
    echo "📍 Location: $APPIMAGE_FILE"
    
    # Make it executable
    chmod +x "$APPIMAGE_FILE"
    
    # Get file size
    SIZE=$(du -h "$APPIMAGE_FILE" | cut -f1)
    echo "📏 Size: $SIZE"
    
    echo ""
    echo "🎉 Build complete! You can now:"
    echo "   • Run directly: ./$APPIMAGE_FILE"
    echo "   • Copy to /usr/local/bin/ for system-wide access"
    echo "   • Distribute the AppImage file to other Linux systems"
    echo ""
    echo "💡 The AppImage is portable and includes all dependencies!"
else
    echo "❌ AppImage file not found in dist/ directory"
    echo "📂 Contents of dist/:"
    ls -la dist/ 2>/dev/null || echo "   (dist directory not found)"
    exit 1
fi 