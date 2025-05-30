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
echo "Current UID: $CURRENT_UID"
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

# Create log directory in user home
echo "Setting up logging directory..."
mkdir -p "$INSTALL_DIR"
touch "$INSTALL_DIR/touchscreen-detector.log"
chmod 644 "$INSTALL_DIR/touchscreen-detector.log"

# Add user to input group for device access
echo "Adding user to input group..."
sudo usermod -a -G input $CURRENT_USER

# Install systemd service with correct UID
echo "Installing systemd service..."
# Replace placeholders in service file
sed "s/%i/$CURRENT_USER/g" "$SCRIPT_DIR/touchscreen-detector.service" | \
sed "s|/home/%i|/home/$CURRENT_USER|g" | \
sed "s|XDG_RUNTIME_DIR=/run/user/1000|XDG_RUNTIME_DIR=/run/user/$CURRENT_UID|g" | \
sudo tee /etc/systemd/system/touchscreen-detector@.service > /dev/null

# Create a user-specific service file
echo "Creating user-specific service..."
sudo sed "s/%i/$CURRENT_USER/g" "$SCRIPT_DIR/touchscreen-detector.service" | \
sudo sed "s|/home/%i|/home/$CURRENT_USER|g" | \
sudo sed "s|XDG_RUNTIME_DIR=/run/user/1000|XDG_RUNTIME_DIR=/run/user/$CURRENT_UID|g" | \
sudo tee /etc/systemd/system/touchscreen-detector-$CURRENT_USER.service > /dev/null

# Reload systemd and enable service
echo "Enabling systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable touchscreen-detector-$CURRENT_USER.service

# Create a simple wrapper script for easier management
echo "Creating management script..."
cat > "$INSTALL_DIR/manage-service.sh" << EOF
#!/bin/bash

SERVICE_NAME="touchscreen-detector-$CURRENT_USER"

case "\$1" in
    start)
        echo "Starting touchscreen detector service..."
        sudo systemctl start \$SERVICE_NAME
        ;;
    stop)
        echo "Stopping touchscreen detector service..."
        sudo systemctl stop \$SERVICE_NAME
        ;;
    restart)
        echo "Restarting touchscreen detector service..."
        sudo systemctl restart \$SERVICE_NAME
        ;;
    status)
        sudo systemctl status \$SERVICE_NAME
        ;;
    logs)
        echo "=== Service logs (journalctl) ==="
        sudo journalctl -u \$SERVICE_NAME -f --no-pager
        ;;
    logfile)
        echo "=== Log file ==="
        tail -f "$INSTALL_DIR/touchscreen-detector.log"
        ;;
    test)
        echo "Testing touchscreen detector manually..."
        cd "$INSTALL_DIR"
        python3 detecttouch.py
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|status|logs|logfile|test}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the service"
        echo "  stop     - Stop the service"
        echo "  restart  - Restart the service"
        echo "  status   - Show service status"
        echo "  logs     - Show live service logs"
        echo "  logfile  - Show live log file"
        echo "  test     - Run manually for testing"
        exit 1
        ;;
esac
EOF

chmod +x "$INSTALL_DIR/manage-service.sh"

echo ""
echo "Installation complete!"
echo ""
echo "Service name: touchscreen-detector-$CURRENT_USER"
echo ""
echo "Quick commands (use the management script):"
echo "  Start service:    $INSTALL_DIR/manage-service.sh start"
echo "  Stop service:     $INSTALL_DIR/manage-service.sh stop"
echo "  Service status:   $INSTALL_DIR/manage-service.sh status"
echo "  View logs:        $INSTALL_DIR/manage-service.sh logs"
echo "  View log file:    $INSTALL_DIR/manage-service.sh logfile"
echo "  Test manually:    $INSTALL_DIR/manage-service.sh test"
echo ""
echo "Or use systemctl directly:"
echo "  sudo systemctl start touchscreen-detector-$CURRENT_USER.service"
echo "  sudo systemctl status touchscreen-detector-$CURRENT_USER.service"
echo ""
echo "Log file location: $INSTALL_DIR/touchscreen-detector.log"
echo ""
echo "The service will start automatically on next boot."
echo "To start it now, run: $INSTALL_DIR/manage-service.sh start"
echo ""
echo "IMPORTANT: You may need to log out and log back in for group changes to take effect!"
echo ""
echo "Instructions:"
echo "1. After service starts, you have 10 seconds to tap the screen 10 times"
echo "2. If successful: chromium-browser will launch"
echo "3. If unsuccessful or timeout: nm-connection-editor will launch" 