import subprocess
import time
import threading
import logging
import sys
import os
from evdev import InputDevice, ecodes, list_devices

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('touchscreen-detector')

def launch_application(app_name, command):
    """Simple application launcher"""
    logger.info(f"Launching {app_name}...")
    try:
        subprocess.Popen(command, start_new_session=True)
        logger.info(f"{app_name} launched successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to launch {app_name}: {e}")
        return False

def find_touchscreen_device():
    """Find the touchscreen device automatically"""
    logger.info("Searching for touchscreen devices...")
    
    for device_path in list_devices():
        try:
            device = InputDevice(device_path)
            device_name = device.name.lower()
            
            if any(keyword in device_name for keyword in ['touch', 'finger', 'elan', 'synaptics']):
                logger.info(f"Found touchscreen: {device.name} at {device_path}")
                return device_path
        except Exception as e:
            logger.warning(f"Could not access device {device_path}: {e}")
    
    # Fallback to the original device
    fallback_device = "/dev/input/event7"
    logger.warning(f"No touchscreen found, using fallback: {fallback_device}")
    return fallback_device

# Find and open touchscreen device
device_path = find_touchscreen_device()

try:
    touch_dev = InputDevice(device_path)
    logger.info(f"Opened touchscreen device: {touch_dev.name}")
except Exception as e:
    logger.error(f"Failed to open touchscreen device: {e}")
    launch_application("xterm", ["xterm"])
    sys.exit(1)

# Configuration
target_taps = 10
time_window = 10  # seconds
tap_count = 0
start_time = time.time()
timeout_triggered = False

def timeout_handler():
    """Launch xterm if timeout is reached"""
    global timeout_triggered
    time.sleep(time_window)
    if tap_count < target_taps and not timeout_triggered:
        timeout_triggered = True
        logger.info(f"Timeout reached. Only {tap_count} taps detected.")
        launch_application("xterm", ["xterm"])
        os._exit(0)

# Start timeout timer
timeout_thread = threading.Thread(target=timeout_handler, daemon=True)
timeout_thread.start()

logger.info(f"Waiting for {target_taps} touches within {time_window} seconds...")

try:
    for event in touch_dev.read_loop():
        if timeout_triggered:
            break
            
        if event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 1:
            elapsed = time.time() - start_time
            
            if elapsed <= time_window:
                tap_count += 1
                logger.info(f"Tap {tap_count}/{target_taps} at {elapsed:.2f}s")

                if tap_count >= target_taps:
                    logger.info("SUCCESS! 10 touches detected.")
                    launch_application("Network Settings", ["/home/kiosk-user/gefran_kiosk/dist/GEFRAN Network Settings-1.0.0.AppImage"])
                    break
            else:
                if not timeout_triggered:
                    timeout_triggered = True
                    logger.info(f"Time window exceeded. Only {tap_count} taps detected.")
                    launch_application("xterm", ["xterm"])
                    break

except KeyboardInterrupt:
    logger.info("Interrupted by user")
except Exception as e:
    logger.error(f"Error: {e}")
    launch_application("xterm", ["xterm"])
finally:
    logger.info("Shutting down")
