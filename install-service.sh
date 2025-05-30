#!/bin/bash

# Install script for touchscreen detector systemd service

set -e

echo "Installing Touchscreen Detector Service..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Please run as a regular user."
   exit 1
fi

# Get current user
CURRENT_USER=$(whoami)
CURRENT_UID=$(id -u)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/home/$CURRENT_USER/touchscreen-detector"

echo "Current user: $CURRENT_USER"
echo "Script directory: $SCRIPT_DIR"
echo "Install directory: $INSTALL_DIR"

# Install required Python packages
echo "Installing Python dependencies..."
sudo apt update
sudo apt install -y python3-evdev python3-pip

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

# Copy files to installation directory
echo "Copying files..."
cp "$SCRIPT_DIR/detecttouch.py" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/detecttouch.py"

# Create log directory and file
echo "Setting up logging..."
sudo mkdir -p /var/log
sudo touch /var/log/touchscreen-detector.log
sudo chown $CURRENT_USER:$CURRENT_USER /var/log/touchscreen-detector.log
sudo chmod 644 /var/log/touchscreen-detector.log

# Add user to input group for device access
echo "Adding user to input group..."
sudo usermod -a -G input $CURRENT_USER

# Install systemd service
echo "Installing systemd service..."
# Replace placeholders in service file
sed "s/%i/$CURRENT_USER/g" "$SCRIPT_DIR/touchscreen-detector.service" | \
sed "s|/home/%i|/home/$CURRENT_USER|g" | \
sudo tee /etc/systemd/system/touchscreen-detector@.service > /dev/null

# Reload systemd and enable service
echo "Enabling systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable touchscreen-detector@$CURRENT_USER.service

echo ""
echo "Installation complete!"
echo ""
echo "Service commands:"
echo "  Start service:    sudo systemctl start touchscreen-detector@$CURRENT_USER.service"
echo "  Stop service:     sudo systemctl stop touchscreen-detector@$CURRENT_USER.service"
echo "  Service status:   sudo systemctl status touchscreen-detector@$CURRENT_USER.service"
echo "  View logs:        sudo journalctl -u touchscreen-detector@$CURRENT_USER.service -f"
echo "  View log file:    tail -f /var/log/touchscreen-detector.log"
echo ""
echo "The service will start automatically on next boot."
echo "To start it now, run: sudo systemctl start touchscreen-detector@$CURRENT_USER.service"
echo ""
echo "Instructions:"
echo "1. After service starts, you have 10 seconds to tap the screen 10 times"
echo "2. If successful: chromium-browser will launch"
echo "3. If unsuccessful or timeout: nm-connection-editor will launch" 