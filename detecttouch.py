import subprocess
import time
import threading
import logging
import sys
import os
import psutil
import pwd
from evdev import InputDevice, ecodes, list_devices

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('touchscreen-detector')

def launch_application(app_name, command, user=None):
    """Application launcher optimized for Electron apps with user switching"""
    logger.info(f"Launching {app_name} as user: {user or 'current user'}...")
    logger.info(f"Command: {' '.join(command)}")
    
    # If user is specified and we're running as root, use sudo to switch user
    if user and user != 'root' and os.geteuid() == 0:
        # Get user info
        try:
            user_info = pwd.getpwnam(user)
            user_home = user_info.pw_dir
            user_uid = user_info.pw_uid
        except KeyError:
            logger.error(f"User {user} not found")
            return None
        
        # Prepare environment for the user
        user_env = os.environ.copy()
        user_env.update({
            'HOME': user_home,
            'USER': user,
            'LOGNAME': user,
            'XDG_RUNTIME_DIR': f'/run/user/{user_uid}',
            'XAUTHORITY': f'{user_home}/.Xauthority'
        })
        
        # Build sudo command
        sudo_command = ['sudo', '-u', user, '-E'] + command
        final_command = sudo_command
        final_env = user_env
    else:
        final_command = command
        final_env = os.environ.copy()
    
    try:
        # Launch with proper detachment, avoiding pipe issues
        process = subprocess.Popen(
            final_command, 
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            env=final_env
        )
        
        # Give it a moment to start
        time.sleep(1)
        
        # Check if process is still running
        if process.poll() is None:
            logger.info(f"{app_name} launched successfully (PID: {process.pid})")
            return process
        else:
            logger.error(f"{app_name} exited immediately with code {process.returncode}")
            return None
            
    except Exception as e:
        logger.error(f"Failed to launch {app_name}: {e}")
        return None

def monitor_process_and_launch_fallback(process, fallback_app, fallback_command, fallback_user=None):
    """Monitor a process and launch fallback app when it closes"""
    logger.info(f"Monitoring process PID {process.pid}...")
    
    try:
        # Wait for the process to finish
        process.wait()
        logger.info(f"Process {process.pid} has ended. Launching fallback...")
        
        # Give a small delay before launching fallback
        time.sleep(2)
        launch_application(fallback_app, fallback_command, fallback_user)
        
    except Exception as e:
        logger.error(f"Error monitoring process: {e}")
        # Launch fallback anyway
        launch_application(fallback_app, fallback_command, fallback_user)

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
    fallback_device = "/dev/input/event8"
    logger.warning(f"No touchscreen found, using fallback: {fallback_device}")
    return fallback_device

# Find and open touchscreen device
device_path = find_touchscreen_device()

try:
    touch_dev = InputDevice(device_path)
    logger.info(f"Opened touchscreen device: {touch_dev.name}")
except Exception as e:
    logger.error(f"Failed to open touchscreen device: {e}")
    launch_application("xterm", ["xterm"], "kiosk-user")
    sys.exit(1)

# Configuration
target_taps = 10
time_window = 10  # seconds
tap_count = 0
start_time = time.time()
timeout_triggered = False

def timeout_handler():
    """Launch chromium if timeout is reached"""
    global timeout_triggered
    time.sleep(time_window)
    if tap_count < target_taps and not timeout_triggered:
        timeout_triggered = True
        logger.info(f"Timeout reached. Only {tap_count} taps detected.")
        launch_application("chromium", ["chromium"], "kiosk-user")
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
                    network_process = launch_application("Network Settings", ["/home/kiosk-user/gefran_kiosk/dist/GEFRAN Network Settings-1.0.0.AppImage", "--no-sandbox", "--fullscreen"], "root")
                    
                    if network_process:
                        # Start monitoring the network settings app in a separate thread
                        monitor_thread = threading.Thread(
                            target=monitor_process_and_launch_fallback,
                            args=(network_process, "chromium", ["chromium"], "kiosk-user"),
                            daemon=True
                        )
                        monitor_thread.start()
                        
                        # Keep service alive while monitoring
                        logger.info("Network Settings launched, monitoring for closure...")
                        while True:
                            time.sleep(10)  # Keep service running
                    else:
                        # If network settings failed to launch, launch chromium immediately
                        launch_application("chromium", ["chromium"], "kiosk-user")
                    break
            else:
                if not timeout_triggered:
                    timeout_triggered = True
                    logger.info(f"Time window exceeded. Only {tap_count} taps detected.")
                    launch_application("chromium", ["chromium"], "kiosk-user")
                    break

except KeyboardInterrupt:
    logger.info("Interrupted by user")
except Exception as e:
    logger.error(f"Error: {e}")
    launch_application("xterm", ["xterm"], "kiosk-user")
finally:
    logger.info("Shutting down")
