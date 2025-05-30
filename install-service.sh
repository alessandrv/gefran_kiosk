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
sudo apt install -y python3-evdev python3-pip x11-utils wmctrl

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

# Copy files to installation directory
echo "Copying files..."
cp "$SCRIPT_DIR/detecttouch.py" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/test-launch.py" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/detecttouch.py"
chmod +x "$INSTALL_DIR/test-launch.py"

# Create log directory in user home
echo "Setting up logging directory..."
mkdir -p "$INSTALL_DIR"
touch "$INSTALL_DIR/touchscreen-detector.log"
chmod 644 "$INSTALL_DIR/touchscreen-detector.log"

# Add user to input group for device access
echo "Adding user to input group..."
sudo usermod -a -G input $CURRENT_USER

# Check which systemd targets are available
echo "Checking available systemd targets..."
if systemctl list-units --type=target | grep -q "graphical-session.target"; then
    echo "✓ graphical-session.target is available"
    USE_USER_SERVICE=true
elif systemctl list-units --type=target | grep -q "graphical.target"; then
    echo "✓ graphical.target is available"
    USE_USER_SERVICE=false
else
    echo "⚠ No suitable graphical target found, using default.target"
    USE_USER_SERVICE=true
fi

if [ "$USE_USER_SERVICE" = true ]; then
    echo "Installing as user service..."
    
    # Create user systemd directory
    mkdir -p ~/.config/systemd/user
    
    # Install user service
    if [ -f "$SCRIPT_DIR/touchscreen-detector-user.service" ]; then
        cp "$SCRIPT_DIR/touchscreen-detector-user.service" ~/.config/systemd/user/touchscreen-detector.service
    else
        # Create user service on the fly
        cat > ~/.config/systemd/user/touchscreen-detector.service << EOF
[Unit]
Description=Touchscreen Detection Service (User)
After=default.target

[Service]
Type=simple
Environment=DISPLAY=:0
WorkingDirectory=%h/touchscreen-detector
ExecStartPre=/bin/sleep 5
ExecStart=/usr/bin/python3 %h/touchscreen-detector/detecttouch.py
Restart=no
RestartSec=5

[Install]
WantedBy=default.target
EOF
    fi
    
    # Reload and enable user service
    systemctl --user daemon-reload
    systemctl --user enable touchscreen-detector.service
    
    SERVICE_TYPE="user"
    SERVICE_NAME="touchscreen-detector"
    
else
    echo "Installing as system service..."
    
    # Install systemd service with correct UID
    sed "s/%i/$CURRENT_USER/g" "$SCRIPT_DIR/touchscreen-detector.service" | \
    sed "s|/home/%i|/home/$CURRENT_USER|g" | \
    sed "s|XDG_RUNTIME_DIR=/run/user/1000|XDG_RUNTIME_DIR=/run/user/$CURRENT_UID|g" | \
    sudo tee /etc/systemd/system/touchscreen-detector-$CURRENT_USER.service > /dev/null
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable touchscreen-detector-$CURRENT_USER.service
    
    SERVICE_TYPE="system"
    SERVICE_NAME="touchscreen-detector-$CURRENT_USER"
fi

# Create a management script that handles both service types
echo "Creating management script..."
cat > "$INSTALL_DIR/manage-service.sh" << EOF
#!/bin/bash

SERVICE_TYPE="$SERVICE_TYPE"
SERVICE_NAME="$SERVICE_NAME"

if [ "\$SERVICE_TYPE" = "user" ]; then
    SYSTEMCTL_CMD="systemctl --user"
else
    SYSTEMCTL_CMD="sudo systemctl"
fi

case "\$1" in
    start)
        echo "Starting touchscreen detector service..."
        \$SYSTEMCTL_CMD start \$SERVICE_NAME
        ;;
    stop)
        echo "Stopping touchscreen detector service..."
        \$SYSTEMCTL_CMD stop \$SERVICE_NAME
        ;;
    restart)
        echo "Restarting touchscreen detector service..."
        \$SYSTEMCTL_CMD restart \$SERVICE_NAME
        ;;
    status)
        \$SYSTEMCTL_CMD status \$SERVICE_NAME
        ;;
    logs)
        echo "=== Service logs (journalctl) ==="
        if [ "\$SERVICE_TYPE" = "user" ]; then
            journalctl --user -u \$SERVICE_NAME -f --no-pager
        else
            sudo journalctl -u \$SERVICE_NAME -f --no-pager
        fi
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
    test-launch)
        echo "Testing application launching..."
        cd "$INSTALL_DIR"
        python3 test-launch.py
        ;;
    enable)
        echo "Enabling service for autostart..."
        \$SYSTEMCTL_CMD enable \$SERVICE_NAME
        ;;
    disable)
        echo "Disabling service autostart..."
        \$SYSTEMCTL_CMD disable \$SERVICE_NAME
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|status|logs|logfile|test|test-launch|enable|disable}"
        echo ""
        echo "Service type: \$SERVICE_TYPE"
        echo "Service name: \$SERVICE_NAME"
        echo ""
        echo "Commands:"
        echo "  start       - Start the service"
        echo "  stop        - Stop the service"
        echo "  restart     - Restart the service"
        echo "  status      - Show service status"
        echo "  logs        - Show live service logs"
        echo "  logfile     - Show live log file"
        echo "  test        - Run touchscreen detector manually for testing"
        echo "  test-launch - Test if applications can be launched properly"
        echo "  enable      - Enable service for autostart"
        echo "  disable     - Disable service autostart"
        exit 1
        ;;
esac
EOF

chmod +x "$INSTALL_DIR/manage-service.sh"

echo ""
echo "Installation complete!"
echo ""
echo "Service type: $SERVICE_TYPE"
echo "Service name: $SERVICE_NAME"
echo ""
echo "Quick commands (use the management script):"
echo "  Start service:    $INSTALL_DIR/manage-service.sh start"
echo "  Stop service:     $INSTALL_DIR/manage-service.sh stop"
echo "  Service status:   $INSTALL_DIR/manage-service.sh status"
echo "  View logs:        $INSTALL_DIR/manage-service.sh logs"
echo "  View log file:    $INSTALL_DIR/manage-service.sh logfile"
echo "  Test manually:    $INSTALL_DIR/manage-service.sh test"
echo "  Test app launch:  $INSTALL_DIR/manage-service.sh test-launch"
echo ""

if [ "$SERVICE_TYPE" = "user" ]; then
    echo "Direct systemctl commands:"
    echo "  systemctl --user start $SERVICE_NAME"
    echo "  systemctl --user status $SERVICE_NAME"
    echo ""
    echo "Note: User services run in your user session context."
    echo "This is better for GUI applications but requires you to be logged in."
else
    echo "Direct systemctl commands:"
    echo "  sudo systemctl start $SERVICE_NAME"
    echo "  sudo systemctl status $SERVICE_NAME"
fi

echo ""
echo "Log file location: $INSTALL_DIR/touchscreen-detector.log"
echo ""
echo "The service will start automatically on next login/boot."
echo "To start it now, run: $INSTALL_DIR/manage-service.sh start"
echo ""
echo "IMPORTANT: You may need to log out and log back in for group changes to take effect!"
echo ""
echo "TROUBLESHOOTING:"
echo "If applications don't appear, run: $INSTALL_DIR/manage-service.sh test-launch"
echo "This will test if GUI applications can be launched from the service context."
echo ""
echo "Instructions:"
echo "1. After service starts, you have 10 seconds to tap the screen 10 times"
echo "2. If successful: chromium-browser will launch"
echo "3. If unsuccessful or timeout: nm-connection-editor will launch" 