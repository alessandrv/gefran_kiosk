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

def launch_chromium_kiosk():
    """Launch Chromium in kiosk mode at localhost:3000 as admin user"""
    logger.info("Launching Chromium in kiosk mode at localhost:3000 as admin user")
    
    try:
        user_info = pwd.getpwnam("admin")
        user_home = user_info.pw_dir
        user_uid = user_info.pw_uid
    except KeyError:
        logger.error("User 'admin' not found")
        return None
    
    # Setup environment for admin user
    env = os.environ.copy()
    env.update({
        'HOME': user_home,
        'USER': 'admin',
        'LOGNAME': 'admin',
        'XDG_RUNTIME_DIR': f'/run/user/{user_uid}',
        'XAUTHORITY': f'{user_home}/.Xauthority',
        'DISPLAY': ':0'
    })
    
    command = [
        'sudo', '-u', 'admin', '-E',
        'chromium',
        '--hide-crash-restore-bubble',
        '--no-first-run',
        '--disable-session-crashed-bubble',
        '--disable-infobars',
        '--kiosk',
        'http://localhost:3000'
    ]
    
    try:
        process = subprocess.Popen(
            command,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            env=env
        )
        
        time.sleep(2)  # Give it time to start
        
        if process.poll() is None:
            logger.info(f"Chromium kiosk mode launched successfully (PID: {process.pid})")
            return process
        else:
            logger.error("Chromium kiosk mode failed to start")
            return None
            
    except Exception as e:
        logger.error(f"Failed to launch Chromium kiosk mode: {e}")
        return None

def launch_chromium_normal():
    """Launch Chromium in normal mode as admin user"""
    logger.info("Launching Chromium in normal mode as admin user")
    
    try:
        user_info = pwd.getpwnam("admin")
        user_home = user_info.pw_dir
        user_uid = user_info.pw_uid
    except KeyError:
        logger.error("User 'admin' not found")
        return None
    
    # Setup environment for admin user
    env = os.environ.copy()
    env.update({
        'HOME': user_home,
        'USER': 'admin',
        'LOGNAME': 'admin',
        'XDG_RUNTIME_DIR': f'/run/user/{user_uid}',
        'XAUTHORITY': f'{user_home}/.Xauthority',
        'DISPLAY': ':0'
    })
    
    command = [
        'sudo', '-u', 'admin', '-E',
        'chromium',
        '--hide-crash-restore-bubble',
        '--start-maximized',
        '--no-first-run',
        '--disable-session-crashed-bubble',
        '--disable-infobars'
    ]
    
    try:
        process = subprocess.Popen(
            command,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            env=env
        )
        
        time.sleep(2)  # Give it time to start
        
        if process.poll() is None:
            logger.info(f"Chromium normal mode launched successfully (PID: {process.pid})")
            return process
        else:
            logger.error("Chromium normal mode failed to start")
            return None
            
    except Exception as e:
        logger.error(f"Failed to launch Chromium normal mode: {e}")
        return None

def monitor_chromium_and_restart(is_kiosk_mode=False):
    """Monitor Chromium and restart it when it closes"""
    mode_name = "kiosk" if is_kiosk_mode else "normal"
    logger.info(f"Starting Chromium monitoring in {mode_name} mode...")
    
    while True:
        try:
            # Launch appropriate Chromium mode
            if is_kiosk_mode:
                process = launch_chromium_kiosk()
            else:
                process = launch_chromium_normal()
            
            if process:
                # Monitor the process
                logger.info(f"Monitoring Chromium {mode_name} mode (PID: {process.pid})")
                while True:
                    time.sleep(5)
                    if process.poll() is not None:
                        logger.info(f"Chromium {mode_name} mode closed, restarting...")
                        break
            else:
                logger.error(f"Failed to start Chromium {mode_name} mode, retrying in 10 seconds...")
                time.sleep(10)
                
        except Exception as e:
            logger.error(f"Error in Chromium {mode_name} mode monitoring: {e}")
            time.sleep(5)

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
        logger.info("Starting Chromium in normal mode...")
        monitor_chromium_and_restart(is_kiosk_mode=False)
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
            logger.info(f"Timeout: Only {tap_count} taps detected. Starting Chromium in normal mode...")
            monitor_chromium_and_restart(is_kiosk_mode=False)
    
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
                        logger.info("10 touches detected! Starting Chromium in kiosk mode at localhost:3000...")
                        # Launch kiosk mode once, then switch to normal mode
                        process = launch_chromium_kiosk()
                        if process:
                            logger.info(f"Monitoring Chromium kiosk mode (PID: {process.pid})")
                            while True:
                                time.sleep(5)
                                if process.poll() is not None:
                                    logger.info("Chromium kiosk mode closed, switching to normal mode...")
                                    break
                        # After kiosk mode closes, start normal mode monitoring
                        monitor_chromium_and_restart(is_kiosk_mode=False)
                        break
                else:
                    if not timeout_occurred:
                        timeout_occurred = True
                        logger.info(f"Time exceeded. Only {tap_count} taps detected. Starting Chromium in normal mode...")
                        monitor_chromium_and_restart(is_kiosk_mode=False)
                        break
                        
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Touch detection error: {e}")
        logger.info("Starting Chromium in normal mode...")
        monitor_chromium_and_restart(is_kiosk_mode=False)

if __name__ == "__main__":
    main()
