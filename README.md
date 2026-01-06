# 🚀 NEXUS PISOWIFI System

**Professional Coin-Operated WiFi Management System**

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000.svg)](https://expressjs.com/)

## 📋 Overview

NEXUS PISOWIFI is a comprehensive, professional-grade coin-operated WiFi management system designed for small businesses, internet cafés, and public WiFi providers. Built with modern web technologies and cross-platform hardware support, it provides a complete solution for monetizing WiFi access through coin-operated terminals.

### ✨ Key Features

- **🔌 Cross-Platform Hardware Support**: Works on Raspberry Pi, Orange Pi, and Ubuntu systems
- **💰 Coin-Based Payment System**: Supports standard coin acceptors with pulse output
- **🌐 Advanced Networking**: VLAN support, WAN/LAN management, and captive portal
- **📱 User-Friendly Portal**: Beautiful, responsive captive portal interface
- **⚙️ Comprehensive Admin Dashboard**: Full system management and monitoring
- **🔒 Security-First Design**: MAC address-based session control and firewall integration
- **📊 Real-Time Analytics**: Revenue tracking, session monitoring, and usage statistics
- **🎨 Customizable Branding**: Portal themes, welcome messages, and background images

## 🏗️ Architecture

### Backend (Node.js + Express + TypeScript)
- **Hardware Abstraction Layer**: Cross-platform GPIO control with rpio library
- **Network Management**: VLAN creation, hotspot configuration, iptables integration
- **Session Controller**: MAC address tracking with automatic expiration
- **Database**: LowDB JSON-based storage for SD card longevity
- **API Layer**: RESTful endpoints for all system operations

### Frontend (React + TypeScript + Tailwind CSS)
- **Admin Dashboard**: Tabbed interface with Dashboard, Hardware, Network, Rates, and Portal tabs
- **User Portal**: Responsive captive portal with connection flow and session management
- **Real-Time Updates**: Automatic data refresh and status monitoring

## 🚀 Quick Start

### Option 1: Automated Installation (Recommended)
```bash
# One-line installation
curl -sSL https://raw.githubusercontent.com/your-repo/nexus-pisowifi/main/setup.sh | sudo bash
```

### Option 2: Manual Installation
```bash
# Install dependencies
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# Clone and install
git clone https://github.com/Djnirds1984/NEXUS-PISOWIFI.git
cd NEXUS-PISOWIFI
npm install

# Start system
npm start
```

### Access Points
- **Admin Dashboard**: http://your-pi-ip:3001/admin
- **User Portal**: http://your-pi-ip:3001/portal

## 📚 Documentation

### 📖 Installation Guide
Complete step-by-step installation instructions for all platforms:
- [INSTALLATION.md](INSTALLATION.md) - Comprehensive installation guide
- Hardware requirements and wiring diagrams
- Platform-specific setup (Raspberry Pi, Orange Pi, Ubuntu)
- Network configuration and security setup

### ⚡ Quick Start Guide
Fast-track deployment for experienced users:
- [QUICK_START.md](QUICK_START.md) - 5-minute setup guide
- Common commands and troubleshooting
- System status indicators
- First-time configuration checklist

### 🔧 Technical Documentation
Detailed technical specifications:
- [.trae/documents/technical-architecture.md](.trae/documents/technical-architecture.md) - Complete system architecture
- API documentation and endpoint reference
- Database schema and data models
- Security considerations and best practices

## 🎯 System Components

### Hardware Layer
- **Coin Acceptor**: 3-wire pulse output type
- **GPIO Interface**: Physical pin numbering for compatibility
- **LED Indicators**: Status and coin detection feedback
- **Network Interfaces**: WAN/LAN/WiFi management

### Software Components
- **Hardware Manager**: GPIO control and coin detection
- **Network Manager**: VLAN, hotspot, and captive portal
- **Session Manager**: MAC address tracking and expiration
- **Admin Dashboard**: Complete system administration
- **User Portal**: Customer-facing captive portal

### Default Configuration
- **Coin Slot Pin**: GPIO 22 (Physical Pin 15)
- **Status LED Pin**: GPIO 17 (Physical Pin 11)
- **Default Rates**: ₱1.00 = 30 minutes, ₱5.00 = 3 hours
- **Network Ports**: Admin (3001), Portal (80)

## 🔧 Development

### Prerequisites
- Node.js 18.x or higher
- npm or pnpm package manager
- Git for version control

### Development Setup
```bash
# Clone repository
git clone https://github.com/your-repo/nexus-pisowifi.git
cd nexus-pisowifi

# Install dependencies
npm install

# Start development server
npm run dev

# Run TypeScript checks
npm run check
```

### Project Structure
```
nexus-pisowifi/
├── api/                    # Backend (Express + TypeScript)
│   ├── routes/            # API endpoints
│   ├── hardwareManager.ts # GPIO control
│   ├── networkManager.ts  # Network management
│   ├── sessionManager.ts  # Session control
│   └── database.ts        # LowDB configuration
├── src/                   # Frontend (React + TypeScript)
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utility functions
├── data/                  # Database files (JSON)
└── supabase/             # Database migrations
```

## 🧪 Testing

### API Testing
```bash
# Test hardware endpoints
curl http://localhost:3001/api/hardware/status

# Test network endpoints
curl http://localhost:3001/api/network/status

# Test coin simulation
curl -X POST http://localhost:3001/api/hardware/simulate-coin
```

### Frontend Testing
- Access admin dashboard at http://localhost:3001/admin
- Test user portal at http://localhost:3001/portal
- Verify real-time updates and data synchronization

## 🔒 Security Features

- **MAC Address Authentication**: Session-based access control
- **Firewall Integration**: iptables rules for traffic management
- **Input Validation**: Comprehensive API endpoint validation
- **Error Handling**: Secure error responses without data leakage
- **Rate Limiting**: Built-in request throttling

## 📊 Monitoring & Analytics

### Real-Time Dashboard
- System status monitoring
- Revenue tracking and reporting
- Session statistics and usage patterns
- Hardware health indicators

### Historical Data
- Session logs and user activity
- Revenue reports by time period
- System performance metrics
- Error tracking and diagnostics

## 🛠️ Platform Support

### ✅ Fully Supported
- **Raspberry Pi 3B+/4B**: Complete hardware integration
- **Orange Pi**: GPIO support via WiringOP
- **Ubuntu x64**: Development and testing mode

### ⚙️ Requirements
- Linux-based operating system
- Node.js 18.x or higher
- GPIO access (for hardware features)
- Network management capabilities

## 🚀 Deployment Options

### Single Board Computer
- Raspberry Pi with SD card
- Orange Pi with appropriate OS
- Dedicated hardware appliance

### Virtual Environment
- Docker containerization
- Cloud deployment options
- Development and testing environments

## 📈 Performance

### Optimized for SD Cards
- JSON-based database (LowDB)
- Minimal write operations
- Efficient session management
- Automatic cleanup processes

### Scalability
- Supports multiple concurrent sessions
- Efficient memory usage
- Background task processing
- Network traffic optimization

## 🎨 Customization

### Portal Branding
- Custom welcome messages
- Background images and themes
- Business information display
- Multi-language support

### Rate Configuration
- Flexible time-per-peso pricing
- Multiple rate tiers
- Promotional periods
- Dynamic rate adjustments

## 🔧 Maintenance

### Regular Tasks
- System updates and security patches
- Database backup and cleanup
- Hardware health monitoring
- Revenue report generation

### Troubleshooting
- Comprehensive logging system
- Diagnostic tools and health checks
- Common issue resolution guides
- Community support resources

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Legal Notice

Ensure compliance with local regulations for:
- Public WiFi service operation
- Coin-operated device licensing
- Data privacy and user consent
- Network service provider requirements

## 🆘 Support

### Documentation
- [Installation Guide](INSTALLATION.md)
- [Quick Start Guide](QUICK_START.md)
- [Technical Architecture](.trae/documents/technical-architecture.md)

### Community Support
- GitHub Issues: Report bugs and request features
- Discussions: Community Q&A and best practices
- Wiki: Additional documentation and tutorials

### Professional Support
- Installation assistance available
- Custom development services
- Hardware procurement guidance
- Ongoing maintenance contracts

---

**Made with ❤️ for the global WiFi community**

*Empowering small businesses with professional-grade WiFi monetization solutions*