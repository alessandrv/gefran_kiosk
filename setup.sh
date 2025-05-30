#!/bin/bash

# Setup script for touchscreen detector

echo "Setting up touchscreen detector..."

# Install required Python packages
echo "Installing Python dependencies..."
sudo apt update
sudo apt install -y python3-evdev python3-pip

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make the Python script executable
chmod +x "$SCRIPT_DIR/detecttouch.py"

# Find the correct touchscreen device
echo "Detecting touchscreen device..."
python3 -c "
from evdev import list_devices, InputDevice
for device_path in list_devices():
    device = InputDevice(device_path)
    if 'touch' in device.name.lower() or 'Touch' in device.name:
        print(f'Found touchscreen: {device.name} at {device_path}')
        # Update the script with the correct device path
        with open('$SCRIPT_DIR/detecttouch.py', 'r') as f:
            content = f.read()
        content = content.replace('/dev/input/event7', device_path)
        with open('$SCRIPT_DIR/detecttouch.py', 'w') as f:
            f.write(content)
        break
else:
    print('No touchscreen device found. Please manually update the device path in detecttouch.py')
"

# Setup autostart using XDG autostart (recommended for Xubuntu)
echo "Setting up autostart..."
mkdir -p ~/.config/autostart

# Update the desktop file with the correct path
sed "s|/path/to/your/detecttouch.py|$SCRIPT_DIR/detecttouch.py|g" "$SCRIPT_DIR/touchscreen-detector.desktop" > ~/.config/autostart/touchscreen-detector.desktop

echo "Setup complete!"
echo "The touchscreen detector will start automatically on next login."
echo "To test manually, run: python3 $SCRIPT_DIR/detecttouch.py"
echo ""
echo "Instructions:"
echo "1. After boot, you have 10 seconds to tap the screen 10 times"
echo "2. If successful: chromium-browser will launch"
echo "3. If unsuccessful or timeout: nm-connection-editor will launch" 