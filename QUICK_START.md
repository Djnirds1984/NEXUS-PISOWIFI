# NEXUS PISOWIFI - Quick Start Guide

## 🚀 One-Line Installation
```bash
# Download and run automated setup
curl -sSL https://raw.githubusercontent.com/Djnirds1984/NEXUS-PISOWIFI/main/setup.sh | sudo bash
```

## 📋 Manual Installation (5 minutes)

### 1. Install Dependencies
```bash
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs
```

### 2. Clone & Install
```bash
git clone https://github.com/Djnirds1984/NEXUS-PISOWIFI.git
cd NEXUS-PISOWIFI
npm install
```

### 3. Start System
```bash
npm start
```

### 4. Access Dashboards
- **Admin Dashboard**: http://your-pi-ip:3001/admin
- **User Portal**: http://your-pi-ip:3001/portal

## 🔌 Hardware Wiring (Raspberry Pi)

### Coin Acceptor Connection
```
Coin Acceptor → Raspberry Pi
Red Wire     → 5V (Pin 2)
Black Wire   → GND (Pin 6)
White Wire   → GPIO 22 (Pin 15)
```

### Status LED Connection
```
LED Positive → GPIO 17 (Pin 11)
LED Negative → GND (Pin 14)
Use 220Ω resistor!
```

## ⚙️ Default Configuration

### GPIO Pins (Physical Pin Numbers)
- **Coin Slot**: Pin 15 (GPIO 22)
- **Status LED**: Pin 11 (GPIO 17)
- **Optional LED**: Pin 13 (GPIO 27)

### Network Settings
- **Admin Port**: 3001
- **Portal Port**: 80 (redirected)
- **Database**: data/settings.json

### Default Rates
- ₱1.00 = 30 minutes
- ₱5.00 = 3 hours
- ₱10.00 = 8 hours

## 🎯 First Time Setup

1. **Access Admin Dashboard** → Configure Hardware
2. **Test Coin Detection** → Insert coin
3. **Set WiFi Rates** → Adjust pricing
4. **Customize Portal** → Add your branding
5. **Test User Flow** → Connect from phone

## 🔧 Common Commands

```bash
# Start development server
npm run dev

# Check system status
sudo systemctl status nexus-pisowifi

# View logs
journalctl -u nexus-pisowifi -f

# Test GPIO
curl http://localhost:3001/api/hardware/status

# Simulate coin (testing)
curl -X POST http://localhost:3001/api/hardware/simulate-coin

# Restart service
sudo systemctl restart nexus-pisowifi
```

## 📊 System Status

### LED Indicators
- **Solid**: System ready
- **Blinking**: Coin detected
- **Off**: System error

### Web Interface Status
- **Green**: All systems operational
- **Yellow**: Minor issues detected
- **Red**: Critical error

## 🚨 Troubleshooting

### Coin Not Detected
1. Check wiring connections
2. Test with `npm run test-gpio`
3. Verify coin acceptor pulse settings
4. Check Admin Dashboard hardware config

### WiFi Not Working
1. Verify network interfaces
2. Check hostapd status: `sudo systemctl status hostapd`
3. Test captive portal: `curl -I http://neverssl.com`

### Portal Not Loading
1. Check if service is running
2. Verify firewall rules: `sudo ufw status`
3. Test API endpoints

### Performance Issues
1. Monitor CPU: `htop`
2. Check memory: `free -h`
3. Review logs for errors

## 📞 Support

### Quick Diagnostics
```bash
# System health check
npm run health-check

# Generate support report
npm run support-report
```

### Get Help
1. Check logs: `journalctl -u nexus-pisowifi -n 100`
2. Review configuration: `cat data/settings.json`
3. Test connectivity: `ping 8.8.8.8`

## 📱 User Experience

### For Users (WiFi Customers)
1. Connect to WiFi network
2. Get redirected to portal
3. Insert coins
4. Click "Connect"
5. Enjoy internet access!

### For Admin (You)
1. Monitor dashboard regularly
2. Check revenue reports
3. Adjust rates as needed
4. Maintain hardware
5. Keep system updated

---

**💡 Pro Tips:**
- Use Raspberry Pi 4 for better performance
- Position coin acceptor in visible location
- Regular backup with `cp -r data/ backup/`
- Monitor system health daily
- Keep spare SD card ready