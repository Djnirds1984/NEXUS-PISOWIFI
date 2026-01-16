# NEXUS PISOWIFI System - Installation Guide

## System Requirements

### Hardware Requirements
- **Raspberry Pi 3B+/4B** (Recommended) OR **Orange Pi** (Any model with GPIO)
- **Micro SD Card**: 16GB+ Class 10 or better
- **Power Supply**: 5V 3A for Raspberry Pi 4, 5V 2.5A for Raspberry Pi 3
- **WiFi Adapter**: Built-in or USB (for access point mode)
- **Ethernet Cable**: For WAN connection
- **Coin Acceptor**: 3-wire pulse output type
- **LED Indicators**: Status and coin detection
- **Case**: Weatherproof for outdoor installation

### Software Requirements
- **Operating System**: Raspberry Pi OS Lite (64-bit) or Ubuntu Server 22.04 LTS
- **Node.js**: Version 18.x or higher
- **Network Tools**: NetworkManager or traditional networking
- **GPIO Library**: rpio (Raspberry Pi) or equivalent

## Installation Steps

### 1. Operating System Setup

#### For Raspberry Pi
```bash
# Download Raspberry Pi Imager
# https://www.raspberrypi.com/software/

# Flash Raspberry Pi OS Lite (64-bit) to SD card
# Enable SSH by creating empty "ssh" file in boot partition
# Configure WiFi by creating wpa_supplicant.conf in boot partition
```

#### For Orange Pi/Ubuntu
```bash
# Download Ubuntu Server 22.04 LTS
# Flash to SD card using Balena Etcher or similar tool
# Boot and configure network via console
```

### 2. Initial System Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential python3-pip

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version  # Should show v18.x.x or higher
npm --version
```

### 3. Network Configuration

#### Install NetworkManager (Recommended)
```bash
sudo apt install -y network-manager
sudo systemctl enable NetworkManager
sudo systemctl start NetworkManager
```

#### Install Traditional Networking Tools
```bash
sudo apt install -y net-tools iptables dnsmasq hostapd
```

### 4. GPIO Dependencies

#### For Raspberry Pi
```bash
# Install GPIO library
sudo apt install -y wiringpi

# Install rpio npm package (will be installed with npm install)
```

#### For Orange Pi
```bash
# Install WiringOP (Orange Pi GPIO library)
git clone https://github.com/orangepi-xunlong/wiringOP
cd wiringOP
./build

# Test GPIO access
gpio readall
```

### 5. Project Installation

#### Clone the Repository
```bash
cd ~
git clone https://github.com/your-repo/nexus-pisowifi.git
cd nexus-pisowifi
```

#### Install Node.js Dependencies
```bash
# Install all dependencies
npm install

# This will install:
# - express: Web server framework
# - rpio: GPIO control library
# - lowdb: JSON database
# - concurrently: Run multiple processes
# - Other dependencies listed in package.json
```

### 6. Hardware Setup

#### GPIO Pin Configuration
```bash
# Default pin configuration (physical pin numbering):
# Pin 15 (GPIO 22): Coin acceptor input
# Pin 11 (GPIO 17): Status LED output
# Pin 13 (GPIO 27): Optional LED output

# Test GPIO access
npm run test-gpio
```

#### Coin Acceptor Wiring
```
Coin Acceptor → Raspberry Pi
-------------------------------
Red Wire     → 5V (Pin 2 or 4)
Black Wire   → GND (Pin 6, 9, 14, 20, 25, 30, 34, 39)
White Wire   → GPIO 22 (Pin 15)
```

#### LED Indicator Wiring
```
Status LED → Raspberry Pi
-------------------------
Positive   → GPIO 17 (Pin 11)
Negative   → GND (Pin 14)
Add 220Ω resistor in series
```

### 7. Network Configuration

#### VLAN Setup (Optional)
```bash
# Create VLAN for guest network
sudo ip link add link eth0 name eth0.100 type vlan id 100
sudo ip link set eth0.100 up
```

#### Hotspot Configuration
```bash
# Edit hostapd configuration
sudo nano /etc/hostapd/hostapd.conf

# Add configuration:
interface=wlan0
driver=nl80211
ssid=NEXUS-PISOWIFI
hw_mode=g
channel=6
wpa=2
wpa_passphrase=changeme123
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
```

### 8. System Service Setup

#### Create Systemd Service
```bash
# Create service file
sudo nano /etc/systemd/system/nexus-pisowifi.service
```

Add this content:
```ini
[Unit]
Description=NEXUS PISOWIFI System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/root/NEXUS-PISOWIFI
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Enable and Start Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable nexus-pisowifi

# Start service
sudo systemctl start nexus-pisowifi

# Check service status
sudo systemctl status nexus-pisowifi
```

### 9. Initial Configuration

#### Access Admin Dashboard
1. Open browser and go to: `http://raspberry-pi-ip:3001/admin`
2. Default admin credentials will be shown in console
3. Configure:
   - **Hardware Settings**: Coin slot pin, LED pins
   - **Network Settings**: WAN interface, VLAN configuration
   - **Rates**: Time per peso pricing
   - **Portal**: Welcome message, theme, background

#### Test Coin Detection
```bash
# Monitor coin detection logs
journalctl -u nexus-pisowifi -f

# Simulate coin pulse (for testing)
npm run simulate-coin
```

### 10. Security Configuration

#### Firewall Rules
```bash
# Allow web server ports
sudo ufw allow 3001/tcp  # Admin dashboard
sudo ufw allow 80/tcp    # User portal
sudo ufw allow 443/tcp   # HTTPS (if configured)

# Enable firewall
sudo ufw enable
```

#### Captive Portal Rules
```bash
# These are automatically managed by the application
# Manual verification:
sudo iptables -t nat -L PREROUTING -n
```

## Platform-Specific Notes

### Raspberry Pi
- Use physical pin numbering (BCM mode)
- GPIO pins are 3.3V tolerant only
- Built-in WiFi supports AP mode
- Recommended: Raspberry Pi 4 for better performance

### Orange Pi
- Install WiringOP for GPIO support
- Pin numbering may vary by model
- Check model-specific documentation
- Some models require external WiFi adapter

### Ubuntu x64 (Development)
- Runs in mock mode (no physical GPIO)
- Useful for development and testing
- All features work except hardware control

## Troubleshooting

### Common Issues

#### 1. GPIO Permission Errors
```bash
# Add user to gpio group
sudo usermod -a -G gpio pi
# Or run as root (not recommended for production)
sudo npm start
```

#### 2. NetworkManager Conflicts
```bash
# Disable NetworkManager if using traditional networking
sudo systemctl disable NetworkManager
sudo systemctl stop NetworkManager
```

#### 3. Hostapd Not Starting
```bash
# Check hostapd service
sudo systemctl status hostapd
# Test configuration
sudo hostapd -d /etc/hostapd/hostapd.conf
```

#### 4. Coin Detection Not Working
```bash
# Test GPIO input
npm run test-gpio
# Check wiring and voltage levels
# Verify coin acceptor settings (pulse duration, etc.)
```

#### 5. Session Not Expiring
```bash
# Check session manager logs
journalctl -u nexus-pisowifi -n 50
# Verify iptables rules
sudo iptables -L -n
```

### Debug Mode
```bash
# Run in debug mode
DEBUG=* npm start

# Check system logs
journalctl -xe
```

## Performance Optimization

### SD Card Longevity
- Use high-quality SD card (SanDisk Extreme, Samsung EVO)
- Enable log rotation
- Consider USB boot for Raspberry Pi 4
- Regular backups recommended

### Network Performance
- Use wired connection for WAN when possible
- Position WiFi antenna optimally
- Monitor bandwidth usage
- Consider external WiFi adapter for better range

### System Resources
- Monitor CPU and memory usage
- Consider Raspberry Pi 4 for high-traffic locations
- Use heat sinks and proper ventilation
- Regular system updates

## Maintenance

### Regular Tasks
```bash
# Update system
sudo apt update && sudo apt upgrade

# Check disk space
df -h

# Monitor system logs
journalctl -u nexus-pisowifi --since "1 hour ago"

# Backup configuration
cp -r data/ ~/backup-$(date +%Y%m%d)
```

### Backup and Restore
```bash
# Backup
tar -czf pisowifi-backup.tar.gz data/ package.json

# Restore
tar -xzf pisowifi-backup.tar.gz
```

## Support

For issues and questions:
1. Check system logs: `journalctl -u nexus-pisowifi`
2. Review configuration in `data/settings.json`
3. Test hardware with `npm run test-gpio`
4. Check network connectivity and firewall rules

## License

This software is provided as-is for educational and commercial use. Ensure compliance with local regulations for public WiFi services.
