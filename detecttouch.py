import subprocess
import time
import threading
import logging
import sys
import os
from evdev import InputDevice, categorize, ecodes, list_devices

# Setup logging with user-accessible log file
log_dir = os.path.expanduser("~/touchscreen-detector")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "touchscreen-detector.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, mode='a')
    ]
)
logger = logging.getLogger('touchscreen-detector')

def find_touchscreen_device():
    """Find the touchscreen device automatically"""
    logger.info("Searching for touchscreen devices...")
    
    for device_path in list_devices():
        try:
            device = InputDevice(device_path)
            device_name = device.name.lower()
            logger.debug(f"Checking device: {device.name} at {device_path}")
            
            if any(keyword in device_name for keyword in ['touch', 'finger', 'elan', 'synaptics']):
                logger.info(f"Found potential touchscreen: {device.name} at {device_path}")
                return device_path
        except Exception as e:
            logger.warning(f"Could not access device {device_path}: {e}")
    
    # Fallback to the original device
    fallback_device = "/dev/input/event7"
    logger.warning(f"No touchscreen found, using fallback: {fallback_device}")
    return fallback_device

# Find touchscreen device
device_path = find_touchscreen_device()

try:
    touch_dev = InputDevice(device_path)
    logger.info(f"Successfully opened touchscreen device: {touch_dev.name} at {device_path}")
except Exception as e:
    logger.error(f"Failed to open touchscreen device {device_path}: {e}")
    logger.error("Launching nm-connection-editor due to device error")
    subprocess.Popen(["nm-connection-editor"])
    sys.exit(1)

try:
    touch_dev.grab()
    logger.info("Successfully grabbed exclusive access to touchscreen")
except Exception as e:
    logger.warning(f"Could not grab exclusive access: {e}")

tap_times = []
target_taps = 10
time_window = 10  # seconds
start_time = time.time()
timeout_triggered = False

def timeout_handler():
    """Launch nm-connection-editor if timeout is reached"""
    global timeout_triggered
    time.sleep(time_window)
    if len(tap_times) < target_taps and not timeout_triggered:
        timeout_triggered = True
        logger.info(f"Timeout reached after {time_window} seconds. Only {len(tap_times)} taps detected.")
        logger.info("Launching nm-connection-editor...")
        try:
            subprocess.Popen(["nm-connection-editor"])
            logger.info("nm-connection-editor launched successfully")
        except Exception as e:
            logger.error(f"Failed to launch nm-connection-editor: {e}")
        os._exit(0)

# Start timeout timer
timeout_thread = threading.Thread(target=timeout_handler, daemon=True)
timeout_thread.start()

logger.info(f"Touchscreen detector started. Waiting for {target_taps} touches within {time_window} seconds...")
logger.info("Touch detection loop starting...")

try:
    for event in touch_dev.read_loop():
        if timeout_triggered:
            break
            
        if event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 1:
            now = time.time()
            elapsed = now - start_time
            
            # Only keep taps within the time window from start
            if elapsed <= time_window:
                tap_times.append(now)
                logger.info(f"Tap {len(tap_times)} registered at {elapsed:.2f}s. Count: {len(tap_times)}/{target_taps}")

                if len(tap_times) >= target_taps:
                    logger.info("SUCCESS! 10 touches detected within time window.")
                    logger.info("Launching chromium-browser...")
                    try:
                        subprocess.Popen(["chromium-browser"])
                        logger.info("chromium-browser launched successfully")
                    except Exception as e:
                        logger.error(f"Failed to launch chromium-browser: {e}")
                    break
            else:
                # Time window exceeded
                if not timeout_triggered:
                    timeout_triggered = True
                    logger.info(f"Time window exceeded at {elapsed:.2f}s. Only {len(tap_times)} taps detected.")
                    logger.info("Launching nm-connection-editor...")
                    try:
                        subprocess.Popen(["nm-connection-editor"])
                        logger.info("nm-connection-editor launched successfully")
                    except Exception as e:
                        logger.error(f"Failed to launch nm-connection-editor: {e}")
                    break

except KeyboardInterrupt:
    logger.info("Touchscreen detector interrupted by user")
except Exception as e:
    logger.error(f"Unexpected error in main loop: {e}")
    logger.info("Launching nm-connection-editor due to error")
    try:
        subprocess.Popen(["nm-connection-editor"])
    except Exception as launch_error:
        logger.error(f"Failed to launch nm-connection-editor: {launch_error}")
finally:
    try:
        touch_dev.ungrab()
        logger.info("Released touchscreen device")
    except:
        pass
    logger.info("Touchscreen detector shutting down")
