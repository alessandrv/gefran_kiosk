#!/usr/bin/env python3

import subprocess
import time
import threading
import logging
import sys
import os
import pwd
from evdev import InputDevice, ecodes, list_devices

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('touchscreen-detector')

def find_touchscreen_device():
    """Find the touchscreen device"""
    logger.info("Searching for touchscreen devices...")
    
    for device_path in list_devices():
        try:
            device = InputDevice(device_path)
            device_name = device.name.lower()
            
            if any(keyword in device_name for keyword in ['ilitek']):
                if not ('mouse' in device_name):
                    logger.info(f"Found touchscreen: {device.name} at {device_path}")
                    return device_path
        except Exception as e:
            logger.warning(f"Could not access device {device_path}: {e}")
    
    # Fallback
    fallback_device = "/dev/input/event8"
    logger.warning(f"No touchscreen found, using fallback: {fallback_device}")
    return fallback_device

def launch_app_as_user(app_name, command, user):
    """Launch application as specified user"""
    logger.info(f"Launching {app_name} as user: {user}")
    
    if user == "root":
        # Run as root (current user)
        final_command = command
    else:
        # Run as different user using sudo
        try:
            user_info = pwd.getpwnam(user)
            user_home = user_info.pw_dir
            user_uid = user_info.pw_uid
        except KeyError:
            logger.error(f"User {user} not found")
            return False
        
        # Setup environment for user
        env = os.environ.copy()
        env.update({
            'HOME': user_home,
            'USER': user,
            'LOGNAME': user,
            'XDG_RUNTIME_DIR': f'/run/user/{user_uid}',
            'XAUTHORITY': f'{user_home}/.Xauthority',
            'DISPLAY': ':0'
        })
        
        final_command = ['sudo', '-u', user, '-E'] + command
    
    try:
        process = subprocess.Popen(
            final_command,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            env=env if user != "root" else None
        )
        
        time.sleep(2)  # Give it time to start
        
        if process.poll() is None:
            logger.info(f"{app_name} launched successfully (PID: {process.pid})")
            return True
        else:
            logger.error(f"{app_name} failed to start")
            return False
            
    except Exception as e:
        logger.error(f"Failed to launch {app_name}: {e}")
        return False

def monitor_chromium():
    """Keep chromium running, restart if it closes"""
    logger.info("Starting chromium monitoring...")
    
    while True:
        try:
            logger.info("Launching chromium...")
            success = launch_app_as_user("Chromium", ["chromium", "--hide-crash-restore-bubble"], "kiosk-user")
            
            if success:
                # Find chromium process and wait for it to end
                while True:
                    time.sleep(5)
                    # Check if chromium is still running
                    try:
                        result = subprocess.run(['pgrep', '-f', 'chromium'], 
                                              capture_output=True, text=True)
                        if not result.stdout.strip():
                            logger.info("Chromium closed, restarting...")
                            break
                    except:
                        break
            else:
                logger.error("Failed to start chromium, retrying in 10 seconds...")
                time.sleep(10)
                
        except Exception as e:
            logger.error(f"Error in chromium monitoring: {e}")
            time.sleep(5)

def monitor_network_settings(pid):
    """Monitor network settings and start chromium when it closes"""
    logger.info(f"Monitoring Network Settings PID: {pid}")
    
    try:
        # Wait for the process to end
        while True:
            try:
                os.kill(pid, 0)  # Check if process exists
                time.sleep(2)
            except OSError:
                # Process ended
                logger.info("Network Settings closed, starting chromium monitoring...")
                monitor_chromium()
                break
    except Exception as e:
        logger.error(f"Error monitoring Network Settings: {e}")
        logger.info("Starting chromium monitoring...")
        monitor_chromium()

def main():
    """Main function"""
    logger.info("Touchscreen Detection Service starting...")
    
    # Find touchscreen device
    device_path = find_touchscreen_device()
    
    try:
        touch_dev = InputDevice(device_path)
        logger.info(f"Opened touchscreen device: {touch_dev.name}")
    except Exception as e:
        logger.error(f"Failed to open touchscreen device: {e}")
        logger.info("Starting chromium monitoring...")
        monitor_chromium()
        return
    
    # Touch detection setup
    target_taps = 10
    time_window = 10
    tap_count = 0
    start_time = time.time()
    timeout_occurred = False
    
    def timeout_handler():
        nonlocal timeout_occurred
        time.sleep(time_window)
        if tap_count < target_taps and not timeout_occurred:
            timeout_occurred = True
            logger.info(f"Timeout: Only {tap_count} taps detected. Starting chromium...")
            monitor_chromium()
    
    # Start timeout timer
    timeout_thread = threading.Thread(target=timeout_handler, daemon=True)
    timeout_thread.start()
    
    logger.info(f"Waiting for {target_taps} touches within {time_window} seconds...")
    
    try:
        for event in touch_dev.read_loop():
            if timeout_occurred:
                break
                
            if event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 1:
                elapsed = time.time() - start_time
                
                if elapsed <= time_window:
                    tap_count += 1
                    logger.info(f"Touch {tap_count}/{target_taps} at {elapsed:.2f}s")
                    
                    if tap_count >= target_taps:
                        logger.info("10 touches detected! Launching Network Settings...")
                        
                        # Launch Network Settings
                        success = launch_app_as_user(
                            "Network Settings",
                            ["/home/kiosk-user/gefran_kiosk/dist/GEFRAN Network Settings-1.0.0.AppImage", 
                             "--no-sandbox", "--fullscreen"],
                            "root"
                        )
                        
                        if success:
                            # Get the PID of the launched app
                            time.sleep(2)
                            try:
                                result = subprocess.run(
                                    ['pgrep', '-f', 'GEFRAN Network Settings'],
                                    capture_output=True, text=True
                                )
                                if result.stdout.strip():
                                    pid = int(result.stdout.strip().split()[0])
                                    monitor_network_settings(pid)
                                else:
                                    logger.warning("Could not find Network Settings PID, starting chromium...")
                                    monitor_chromium()
                            except:
                                logger.warning("Error getting Network Settings PID, starting chromium...")
                                monitor_chromium()
                        else:
                            logger.error("Network Settings failed to launch, starting chromium...")
                            monitor_chromium()
                        break
                else:
                    if not timeout_occurred:
                        timeout_occurred = True
                        logger.info(f"Time exceeded. Only {tap_count} taps detected. Starting chromium...")
                        monitor_chromium()
                        break
                        
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Touch detection error: {e}")
        logger.info("Starting chromium monitoring...")
        monitor_chromium()

if __name__ == "__main__":
    main()
