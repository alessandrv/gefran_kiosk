#!/usr/bin/env python3

import subprocess
import os
import sys
import time

def test_environment():
    """Test the current environment for GUI application launching"""
    print("=== Environment Test ===")
    
    # Check important environment variables
    env_vars = ['DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR', 'XDG_SESSION_TYPE', 'USER', 'HOME']
    for var in env_vars:
        value = os.environ.get(var, 'NOT SET')
        print(f"{var}: {value}")
    
    print(f"UID: {os.getuid()}")
    print(f"GID: {os.getgid()}")
    
    # Check if X server is accessible
    try:
        result = subprocess.run(['xdpyinfo'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✓ X server is accessible")
        else:
            print("✗ X server not accessible")
            print(f"Error: {result.stderr}")
    except Exception as e:
        print(f"✗ Cannot test X server: {e}")
    
    # Check if we can list windows
    try:
        result = subprocess.run(['wmctrl', '-l'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✓ Window manager is accessible")
            print(f"Current windows: {len(result.stdout.splitlines())}")
        else:
            print("✗ Window manager not accessible (wmctrl not found or failed)")
    except Exception as e:
        print(f"? Cannot test window manager: {e}")

def test_launch_app(app_name, command):
    """Test launching an application"""
    print(f"\n=== Testing {app_name} ===")
    
    # Set up environment
    env = os.environ.copy()
    env['DISPLAY'] = ':0'
    
    # Try to find XAUTHORITY if not set
    if 'XAUTHORITY' not in env:
        possible_xauth = [
            f"/home/{os.getenv('USER', 'user')}/.Xauthority",
            f"/run/user/{os.getuid()}/gdm/Xauthority",
            "/tmp/.X0-lock"
        ]
        for xauth_path in possible_xauth:
            if os.path.exists(xauth_path):
                env['XAUTHORITY'] = xauth_path
                print(f"Using XAUTHORITY: {xauth_path}")
                break
    
    env['XDG_RUNTIME_DIR'] = f"/run/user/{os.getuid()}"
    env['XDG_SESSION_TYPE'] = 'x11'
    
    try:
        print(f"Launching: {' '.join(command)}")
        process = subprocess.Popen(
            command,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
        
        print(f"Process started with PID: {process.pid}")
        
        # Wait a bit and check if it's still running
        time.sleep(3)
        
        if process.poll() is None:
            print(f"✓ {app_name} is running")
            
            # Try to terminate it gracefully
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"✓ {app_name} terminated successfully")
            except:
                process.kill()
                print(f"! {app_name} had to be killed")
            
            return True
        else:
            stdout, stderr = process.communicate()
            print(f"✗ {app_name} exited with code: {process.returncode}")
            if stdout:
                print(f"stdout: {stdout.decode()}")
            if stderr:
                print(f"stderr: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"✗ Failed to launch {app_name}: {e}")
        return False

def main():
    print("Desktop Environment Application Launch Test")
    print("=" * 50)
    
    # Test environment
    test_environment()
    
    # Test applications
    apps_to_test = [
        ("chromium-browser", ["chromium-browser", "--no-sandbox"]),
        ("nm-connection-editor", ["nm-connection-editor"]),
        ("simple terminal", ["xterm"]),
        ("text editor", ["mousepad"])
    ]
    
    results = {}
    for app_name, command in apps_to_test:
        results[app_name] = test_launch_app(app_name, command)
    
    # Summary
    print("\n=== Summary ===")
    for app_name, success in results.items():
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{app_name}: {status}")
    
    if all(results.values()):
        print("\n🎉 All applications can be launched successfully!")
    else:
        print("\n⚠️  Some applications failed to launch. Check the errors above.")
        print("\nTroubleshooting tips:")
        print("1. Make sure you're running this from a desktop session")
        print("2. Check if the applications are installed")
        print("3. Verify X server permissions")
        print("4. Try running: export DISPLAY=:0 && chromium-browser")

if __name__ == "__main__":
    main() 