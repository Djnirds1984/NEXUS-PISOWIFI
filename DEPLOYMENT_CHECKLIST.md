# 🚀 NEXUS PISOWIFI Deployment Checklist

## 📋 Pre-Deployment Setup

### ✅ GitHub Repository Configuration
- [ ] **Repository Created**: `https://github.com/Djnirds1984/NEXUS-PISOWIFI`
- [ ] **Repository Visibility**: Set to Public (for easy installation)
- [ ] **README Updated**: With your repository URL
- [ ] **Installation Scripts Updated**: Pointing to your repository

### ✅ Local Code Preparation
- [ ] **Code Complete**: All files created and tested locally
- [ ] **Dependencies Installed**: `npm install` completed successfully
- [ ] **TypeScript Compilation**: `npm run check` passes with no errors
- [ ] **Development Server Tested**: `npm run dev` working correctly
- [ ] **API Endpoints Verified**: All endpoints responding correctly

## 🔄 Deployment Steps

### Step 1: Push Code to GitHub
```bash
# Navigate to your project directory
cd c:\Users\AJC\Documents\GitHub\NEXUS-PISOWIFI

# Initialize git if not already done
git init

# Add your repository as origin
git remote add origin https://github.com/Djnirds1984/NEXUS-PISOWIFI.git

# Add all files
git add .

# Commit your changes
git commit -m "Initial commit: Complete NEXUS PISOWIFI System"

# Push to GitHub
git push -u origin main
```

### Step 2: Verify Repository
- [ ] **Files Uploaded**: All project files visible on GitHub
- [ ] **Installation Scripts**: Updated with correct repository URL
- [ ] **Documentation**: All markdown files present and readable
- [ ] **package.json**: Dependencies and scripts correctly configured

### Step 3: Test Installation from GitHub
```bash
# Test on a fresh system (Raspberry Pi or Ubuntu)
# Option 1: Automated installation
curl -sSL https://raw.githubusercontent.com/Djnirds1984/NEXUS-PISOWIFI/main/setup.sh | sudo bash

# Option 2: Manual installation
git clone https://github.com/Djnirds1984/NEXUS-PISOWIFI.git
cd NEXUS-PISOWIFI
npm install
npm start
```

## 🎯 Hardware Deployment

### ✅ Raspberry Pi Setup
- [ ] **OS Installed**: Raspberry Pi OS Lite (64-bit)
- [ ] **Network Configured**: SSH and internet access working
- [ ] **Node.js Installed**: Version 18.x or higher
- [ ] **GPIO Libraries**: WiringPi or equivalent installed

### ✅ Hardware Wiring
- [ ] **Coin Acceptor Connected**: Red (5V), Black (GND), White (GPIO 22)
- [ ] **Status LED Connected**: Positive (GPIO 17), Negative (GND)
- [ ] **Resistor Added**: 220Ω resistor in series with LED
- [ ] **Connections Verified**: All wiring secure and correct

### ✅ System Service
- [ ] **Systemd Service Created**: `/etc/systemd/system/nexus-pisowifi.service`
- [ ] **Service Enabled**: `sudo systemctl enable nexus-pisowifi`
- [ ] **Service Started**: `sudo systemctl start nexus-pisowifi`
- [ ] **Auto-Start Configured**: Service starts on boot

## 🔧 Configuration & Testing

### ✅ Initial Configuration
- [ ] **Admin Dashboard Access**: http://pi-ip:3001/admin
- [ ] **Hardware Settings**: Coin slot pin configured (GPIO 22)
- [ ] **Network Settings**: WAN interface selected
- [ ] **Rates Configuration**: Time-per-peso pricing set
- [ ] **Portal Customization**: Welcome message and theme configured

### ✅ System Testing
- [ ] **Coin Detection**: Insert coin and verify detection
- [ ] **Session Creation**: WiFi session starts correctly
- [ ] **Time Tracking**: Session timer counts down properly
- [ ] **Auto-Disconnect**: Session ends when time expires
- [ ] **Revenue Tracking**: Coin amounts recorded accurately

### ✅ Network Testing
- [ ] **WiFi Hotspot**: SSID broadcasting correctly
- [ ] **Captive Portal**: Users redirected to portal page
- [ ] **Internet Access**: Connected users can browse
- [ ] **Session Isolation**: Users cannot access without payment

## 📊 Monitoring & Maintenance

### ✅ Monitoring Setup
- [ ] **System Logs**: `journalctl -u nexus-pisowifi -f`
- [ ] **Dashboard Monitoring**: Regular admin dashboard checks
- [ ] **Revenue Reports**: Daily/weekly revenue tracking
- [ ] **Performance Monitoring**: CPU and memory usage

### ✅ Backup Strategy
- [ ] **Configuration Backup**: `data/settings.json` backed up
- [ ] **Database Backup**: Session and revenue data backed up
- [ ] **System Backup**: Full SD card image created
- [ ] **Recovery Plan**: Restoration procedure documented

## 🚨 Common Issues & Solutions

### Issue: Coin Not Detected
**Solution**: Check wiring, test GPIO with `npm run test-gpio`, verify coin acceptor settings

### Issue: WiFi Not Working
**Solution**: Check hostapd status, verify network interfaces, test captive portal redirection

### Issue: Portal Not Loading
**Solution**: Check service status, verify firewall rules, test API endpoints

### Issue: Session Not Expiring
**Solution**: Check session manager logs, verify iptables rules, test auto-cleanup

## 📞 Support Resources

### Documentation
- [Installation Guide](INSTALLATION.md)
- [Quick Start Guide](QUICK_START.md)
- [Technical Architecture](.trae/documents/technical-architecture.md)

### Commands
```bash
# Check system status
sudo systemctl status nexus-pisowifi

# View logs
journalctl -u nexus-pisowifi -f

# Restart service
sudo systemctl restart nexus-pisowifi

# Test GPIO
curl http://localhost:3001/api/hardware/status

# Simulate coin (testing)
curl -X POST http://localhost:3001/api/hardware/simulate-coin
```

## ✅ Final Verification

### System Health Check
- [ ] **All Services Running**: Backend, frontend, and hardware manager
- [ ] **No Error Logs**: System running without critical errors
- [ ] **Revenue Tracking**: Accurate coin and session recording
- [ ] **User Experience**: Smooth connection flow for customers

### Business Readiness
- [ ] **Rates Configured**: Appropriate pricing for your market
- [ ] **Branding Applied**: Portal customized with your business info
- [ ] **Location Setup**: Hardware positioned for customer access
- [ ] **Staff Trained**: Someone knows how to monitor and maintain

---

## 🎉 Deployment Complete!

Once all items are checked, your NEXUS PISOWIFI system is ready for production use!

**Next Steps:**
1. Monitor the system closely for the first few days
2. Collect user feedback and adjust settings as needed
3. Set up regular maintenance schedule
4. Consider backup hardware for critical deployments

**Emergency Contacts:**
- Keep local technical support contact information
- Document hardware supplier contact details
- Maintain backup internet connection options

---

*Remember: Always test thoroughly before deploying to production environments!*