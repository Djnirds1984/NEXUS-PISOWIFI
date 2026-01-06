#!/bin/bash

# NEXUS PISOWIFI System - Automated Setup Script
# Run with: sudo bash setup.sh

echo "🚀 NEXUS PISOWIFI System Setup Script"
echo "======================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Clone the Repository
echo "📥 Cloning NEXUS PISOWIFI repository..."
cd ~
git clone https://github.com/Djnirds1984/NEXUS-PISOWIFI.git
cd NEXUS-PISOWIFI

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
echo "🔧 Installing essential packages..."
apt install -y curl wget git build-essential python3-pip net-tools iptables dnsmasq hostapd network-manager

# Install Node.js 18.x
echo "📥 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify Node.js installation
if command -v node &> /dev/null; then
    echo "✅ Node.js installed: $(node --version)"
else
    echo "❌ Node.js installation failed"
    exit 1
fi

# Install GPIO libraries based on platform
echo "🔌 Installing GPIO libraries..."

# Detect platform
if grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "🍓 Detected Raspberry Pi"
    apt install -y wiringpi
elif grep -q "Orange Pi" /proc/device-tree/model 2>/dev/null; then
    echo "🟠 Detected Orange Pi"
    # Install WiringOP for Orange Pi
    if [ ! -d "/tmp/wiringOP" ]; then
        git clone https://github.com/orangepi-xunlong/wiringOP /tmp/wiringOP
        cd /tmp/wiringOP
        ./build
        cd -
    fi
else
    echo "⚠️  Unknown platform - GPIO features will run in mock mode"
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Set permissions
if [ -d "data" ]; then
    chown -R $SUDO_USER:$SUDO_USER data
fi

# Install npm dependencies
echo "📚 Installing npm dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    echo "❌ package.json not found. Make sure you're in the project directory."
    exit 1
fi

# Create systemd service
echo "⚙️  Creating systemd service..."
cat > /etc/systemd/system/nexus-pisowifi.service << 'EOF'
[Unit]
Description=NEXUS PISOWIFI System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/nexus-pisowifi
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Update service user if not pi
if [ "$SUDO_USER" != "pi" ]; then
    sed -i "s/User=pi/User=$SUDO_USER/g" /etc/systemd/system/nexus-pisowifi.service
    sed -i "s|/home/pi/nexus-pisowifi|$(pwd)|g" /etc/systemd/system/nexus-pisowifi.service
fi

# Enable and start service
echo "🚀 Enabling and starting service..."
systemctl daemon-reload
systemctl enable nexus-pisowifi

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 3001/tcp comment "Admin Dashboard"
ufw allow 80/tcp comment "User Portal"
ufw allow 443/tcp comment "HTTPS Portal"

# Add user to gpio group if exists
if getent group gpio > /dev/null 2>&1; then
    usermod -a -G gpio $SUDO_USER
    echo "✅ Added $SUDO_USER to gpio group"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Configure hardware pins in Admin Dashboard"
echo "2. Set up network interfaces"
echo "3. Configure rates and portal settings"
echo "4. Test coin detection"
echo ""
echo "Access points:"
echo "- Admin Dashboard: http://$(hostname -I | awk '{print $1}'):3001/admin"
echo "- User Portal: http://$(hostname -I | awk '{print $1}'):3001/portal"
echo ""
echo "To start the service:"
echo "sudo systemctl start nexus-pisowifi"
echo ""
echo "To check status:"
echo "sudo systemctl status nexus-pisowifi"
echo ""
echo "To view logs:"
echo "journalctl -u nexus-pisowifi -f"