"""
Setup script for Plex Poster Set Helper
Installs dependencies and Playwright browsers
"""
import subprocess
import sys
import platform

def main():
    # Install system dependencies for Linux
    if platform.system() == "Linux":
        print("Installing system dependencies...")
        print("(This requires sudo privileges)")
        try:
            # Install GUI support
            subprocess.check_call(["sudo", "apt", "update"])
            subprocess.check_call(["sudo", "apt", "install", "-y", "python3-tk", "python3-pip"])
            print("✓ GUI dependencies installed successfully")
        except subprocess.CalledProcessError as e:
            print(f"⚠ Could not install GUI dependencies: {e}")
            print("  Please run manually: sudo apt update && sudo apt install python3-tk python3-pip")
        print("")
    
    # Install system dependencies for macOS
    elif platform.system() == "Darwin":
        print("Checking for GUI support on macOS...")
        
        # Check if Homebrew is installed
        brew_installed = False
        try:
            subprocess.check_call(["brew", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            brew_installed = True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Homebrew not found. Installing Homebrew...")
            try:
                # Install Homebrew
                install_cmd = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
                subprocess.check_call(install_cmd, shell=True)
                print("✓ Homebrew installed successfully")
                brew_installed = True
            except subprocess.CalledProcessError as e:
                print(f"⚠ Could not install Homebrew automatically: {e}")
                print("  Please install Homebrew manually from: https://brew.sh")
                print("  Then run: brew install python-tk")
        
        # Install python-tk if Homebrew is available
        if brew_installed:
            try:
                subprocess.check_call(["brew", "install", "python-tk"])
                print("✓ System dependencies installed successfully")
            except subprocess.CalledProcessError:
                print("⚠ Could not install python-tk")
                print("  Please run manually: brew install python-tk")
        print("")
    
    print("Installing Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✓ Python dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies: {e}")
        sys.exit(1)
    
    print("\nInstalling Playwright Chromium browser...")
    try:
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        print("✓ Playwright Chromium installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install Playwright browser: {e}")
        sys.exit(1)
    
    # Install Playwright system dependencies
    if platform.system() == "Linux":
        try:
            subprocess.check_call([sys.executable, "-m", "playwright", "install-deps", "chromium"])
            print("✓ Playwright system dependencies installed successfully")
        except subprocess.CalledProcessError:
            print("⚠ Could not install Playwright system dependencies automatically")
            print("  Please run: sudo playwright install-deps chromium")
    
    print("\n" + "="*50)
    print("✓ Setup complete!")
    print("="*50)
    print("\nNext steps:")
    print("1. Edit config.json with your Plex server details")
    print("2. Run the application:")
    print("   - GUI: python main.py gui")
    print("   - CLI: python main.py cli")

if __name__ == "__main__":
    main()
