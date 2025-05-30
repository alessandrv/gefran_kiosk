import subprocess
import time
import threading
from evdev import InputDevice, categorize, ecodes, list_devices

# Find your touchscreen device
touch_dev = InputDevice("/dev/input/event7")

if not touch_dev:
    print("Touchscreen not found")
    exit(1)

touch_dev.grab()
tap_times = []
target_taps = 10
time_window = 10  # seconds
start_time = time.time()

def timeout_handler():
    """Launch nm-connection-editor if timeout is reached"""
    time.sleep(time_window)
    if len(tap_times) < target_taps:
        print(f"Timeout reached. Only {len(tap_times)} taps detected. Launching nm-connection-editor...")
        subprocess.Popen(["nm-connection-editor"])
        exit(0)

# Start timeout timer
timeout_thread = threading.Thread(target=timeout_handler, daemon=True)
timeout_thread.start()

print(f"Waiting for {target_taps} touches within {time_window} seconds...")

for event in touch_dev.read_loop():
    if event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 1:
        now = time.time()
        # Only keep taps within the time window from start
        if now - start_time <= time_window:
            tap_times.append(now)
            print(f"Tap registered. Count: {len(tap_times)}/{target_taps}")

            if len(tap_times) >= target_taps:
                print("Success! 10 touches detected. Launching chromium-browser...")
                subprocess.Popen(["chromium-browser"])
                break
        else:
            # Time window exceeded
            print(f"Time window exceeded. Only {len(tap_times)} taps detected. Launching nm-connection-editor...")
            subprocess.Popen(["nm-connection-editor"])
            break
