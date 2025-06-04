import subprocess
import time
import threading
import logging
import sys
import os
import psutil
import pwd
import signal
from evdev import InputDevice, ecodes, list_devices

# Global variables for touch detection
touch_detection_active = True
target_taps = 10
time_window = 10  # seconds

def setup_logging():
    """Setup logging for daemon"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger('touchscreen-detector')

def daemonize():
    """Properly daemonize the process"""
    try:
        # First fork
        pid = os.fork()
        if pid > 0:
            # Parent process - write PID and exit
            with open('/var/run/touchscreen-detector-kiosk-user.pid', 'w') as f:
                f.write(str(pid))
            sys.exit(0)
    except OSError as e:
        print(f"First fork failed: {e}")
        sys.exit(1)
    
    # Decouple from parent environment
    os.chdir('/')
    os.setsid()
    os.umask(0)
    
    try:
        # Second fork
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError as e:
        print(f"Second fork failed: {e}")
        sys.exit(1)
    
    # Redirect standard file descriptors
    sys.stdout.flush()
    sys.stderr.flush()
    
    # Keep stdout/stderr for logging
    # Comment out the following lines to keep logging to systemd journal
    # si = open('/dev/null', 'r')
    # so = open('/dev/null', 'w')
    # se = open('/dev/null', 'w')
    # os.dup2(si.fileno(), sys.stdin.fileno())
    # os.dup2(so.fileno(), sys.stdout.fileno())
    # os.dup2(se.fileno(), sys.stderr.fileno())

def signal_handler(signum, frame):
    """Handle termination signals"""
    global touch_detection_active
    logger.info(f"Received signal {signum}, shutting down...")
    touch_detection_active = False
    
    # Clean up PID file
    try:
        os.remove('/var/run/touchscreen-detector-kiosk-user.pid')
    except:
        pass
    
    sys.exit(0)

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

def monitor_and_restart_chromium():
    """Continuously monitor and restart chromium when it closes"""
    global touch_detection_active
    logger.info("Starting persistent chromium monitoring...")
    
    while touch_detection_active:
        try:
            logger.info("Launching chromium...")
            chromium_process = launch_application("chromium", ["chromium"], "kiosk-user")
            
            if chromium_process:
                logger.info(f"Chromium running with PID {chromium_process.pid}")
                # Wait for chromium to exit
                chromium_process.wait()
                logger.info("Chromium closed. Restarting in 3 seconds...")
                time.sleep(3)
            else:
                logger.error("Failed to launch chromium. Retrying in 10 seconds...")
                time.sleep(10)
                
        except Exception as e:
            logger.error(f"Error in chromium monitoring: {e}")
            time.sleep(5)
    
    logger.info("Chromium monitoring stopped (service inactive)")

def monitor_process_and_launch_fallback(process, fallback_app, fallback_command, fallback_user=None):
    """Monitor a process and launch fallback app when it closes"""
    logger.info(f"Monitoring process PID {process.pid}...")
    
    try:
        # Wait for the process to finish
        process.wait()
        logger.info(f"Process {process.pid} has ended. Launching fallback...")
        
        # Give a small delay before launching fallback
        time.sleep(2)
        
        # Start persistent chromium monitoring instead of single launch
        if fallback_app == "chromium":
            logger.info("Network Settings closed, starting persistent chromium monitoring")
            # Start chromium monitoring in a non-daemon thread
            chromium_thread = threading.Thread(
                target=monitor_and_restart_chromium,
                daemon=False
            )
            chromium_thread.start()
            logger.info("Chromium monitoring thread started")
        else:
            launch_application(fallback_app, fallback_command, fallback_user)
        
    except Exception as e:
        logger.error(f"Error monitoring process: {e}")
        # Launch fallback anyway
        if fallback_app == "chromium":
            logger.info("Error occurred, starting persistent chromium monitoring")
            chromium_thread = threading.Thread(
                target=monitor_and_restart_chromium,
                daemon=False
            )
            chromium_thread.start()
            logger.info("Chromium monitoring thread started (fallback)")
        else:
            launch_application(fallback_app, fallback_command, fallback_user)

def find_touchscreen_device():
    """Find the touchscreen device automatically"""
    logger.info("Searching for touchscreen devices...")
    
    for device_path in list_devices():
        try:
            device = InputDevice(device_path)
            device_name = device.name.lower()
            
            if any(keyword in device_name for keyword in ['touch', 'finger', 'elan', 'synaptics', 'ilitek']):
                if not ('mouse' in device_name):
                    logger.info(f"Found touchscreen: {device.name} at {device_path}")
                    return device_path
        except Exception as e:
            logger.warning(f"Could not access device {device_path}: {e}")
    
    # Fallback to the original device
    fallback_device = "/dev/input/event8"
    logger.warning(f"No touchscreen found, using fallback: {fallback_device}")
    return fallback_device

def touch_detection_worker():
    """Worker thread for touch detection that doesn't block the main service"""
    global touch_detection_active
    
    logger.info("Starting touch detection worker thread...")
    
    # Find and open touchscreen device
    device_path = find_touchscreen_device()
    
    try:
        touch_dev = InputDevice(device_path)
        logger.info(f"Opened touchscreen device: {touch_dev.name}")
    except Exception as e:
        logger.error(f"Failed to open touchscreen device: {e}")
        return
    
    # Touch detection variables
    tap_count = 0
    start_time = time.time()
    timeout_triggered = False
    
    def timeout_handler():
        """Launch chromium if timeout is reached"""
        nonlocal timeout_triggered
        time.sleep(time_window)
        if tap_count < target_taps and not timeout_triggered:
            timeout_triggered = True
            logger.info(f"Timeout reached. Only {tap_count} taps detected.")
            logger.info("Starting persistent chromium monitoring")
            # Start chromium monitoring in a non-daemon thread
            chromium_thread = threading.Thread(
                target=monitor_and_restart_chromium,
                daemon=False
            )
            chromium_thread.start()
            logger.info("Chromium monitoring thread started (timeout)")
    
    # Start timeout timer
    timeout_thread = threading.Thread(target=timeout_handler, daemon=True)
    timeout_thread.start()
    
    logger.info(f"Waiting for {target_taps} touches within {time_window} seconds...")
    
    try:
        for event in touch_dev.read_loop():
            if not touch_detection_active or timeout_triggered:
                break
                
            if event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 1:
                elapsed = time.time() - start_time
                
                if elapsed <= time_window:
                    tap_count += 1
                    logger.info(f"Tap {tap_count}/{target_taps} at {elapsed:.2f}s")

                    if tap_count >= target_taps:
                        logger.info("SUCCESS! 10 touches detected.")
                        touch_detection_active = False
                        network_process = launch_application("Network Settings", ["/home/kiosk-user/gefran_kiosk/dist/GEFRAN Network Settings-1.0.0.AppImage", "--no-sandbox", "--fullscreen"], "root")
                        
                        if network_process:
                            # Start monitoring the network settings app in a separate thread
                            monitor_thread = threading.Thread(
                                target=monitor_process_and_launch_fallback,
                                args=(network_process, "chromium", ["chromium"], "kiosk-user"),
                                daemon=True
                            )
                            monitor_thread.start()
                        else:
                            # If network settings failed to launch, start persistent chromium monitoring
                            logger.info("Network Settings failed to launch, starting persistent chromium monitoring")
                            chromium_thread = threading.Thread(
                                target=monitor_and_restart_chromium,
                                daemon=False
                            )
                            chromium_thread.start()
                            logger.info("Chromium monitoring thread started (network settings failed)")
                        break
                else:
                    if not timeout_triggered:
                        timeout_triggered = True
                        touch_detection_active = False
                        logger.info(f"Time window exceeded. Only {tap_count} taps detected.")
                        logger.info("Starting persistent chromium monitoring")
                        chromium_thread = threading.Thread(
                            target=monitor_and_restart_chromium,
                            daemon=False
                        )
                        chromium_thread.start()
                        logger.info("Chromium monitoring thread started (time exceeded)")
                        break

    except KeyboardInterrupt:
        logger.info("Touch detection interrupted by user")
    except Exception as e:
        logger.error(f"Error in touch detection: {e}")
        logger.info("Starting persistent chromium monitoring due to error")
        chromium_thread = threading.Thread(
            target=monitor_and_restart_chromium,
            daemon=False
        )
        chromium_thread.start()
        logger.info("Chromium monitoring thread started (touch detection error)")

def main():
    """Main service function"""
    global logger
    
    # Daemonize the process
    daemonize()
    
    # Setup logging after daemonization
    logger = setup_logging()
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    logger.info("Touchscreen Detection Service starting as daemon...")
    
    # Small delay to ensure graphics system is ready
    time.sleep(5)
    
    # Start touch detection in a separate thread
    touch_thread = threading.Thread(target=touch_detection_worker, daemon=True)
    touch_thread.start()
    
    logger.info("Service started successfully, touch detection active")
    
    # Main service loop - just keep the service alive
    try:
        while touch_detection_active:
            time.sleep(5)
            if not touch_thread.is_alive():
                logger.info("Touch detection thread ended, service will continue running")
                break
    except Exception as e:
        logger.error(f"Service error: {e}")
    finally:
        logger.info("Service shutting down")
        # Clean up PID file
        try:
            os.remove('/var/run/touchscreen-detector-kiosk-user.pid')
        except:
            pass

if __name__ == "__main__":
    main()
