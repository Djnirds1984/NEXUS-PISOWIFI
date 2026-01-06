# NEXUS PISOWIFI System - Technical Architecture

## System Overview
NEXUS PISOWIFI is a comprehensive WiFi management system designed for coin-operated internet access on Raspberry Pi, Orange Pi, and Ubuntu x64 platforms. The system provides automated network management, GPIO-based coin detection, and a complete admin/user portal interface.

## Architecture Components

### 1. Hardware Abstraction Layer
- **Purpose**: Cross-platform GPIO and hardware management
- **File**: `api/hardwareManager.js`
- **Features**:
  - Auto-detection of platform (Raspberry Pi, Orange Pi, Ubuntu x64)
  - GPIO pin management using rpio library
  - Mock mode for development/testing on x64 systems
  - Configurable coin slot and LED pin mapping

### 2. Network Management Module
- **Purpose**: Advanced networking and router functionality
- **File**: `api/networkManager.js`
- **Features**:
  - WAN/LAN interface management
  - VLAN configuration support
  - Hotspot automation (hostapd + dnsmasq)
  - Default gateway enforcement (10.0.0.1)
  - Captive portal with iptables redirection

### 3. Core Application Layer
- **Backend**: Express.js API server
- **Frontend**: React admin dashboard + user portal
- **Database**: LowDB (JSON-based) for SD card longevity

### 4. Session Management
- **Purpose**: User session tracking and internet access control
- **Features**:
  - MAC address-based session tracking
  - Automated internet cutoff via iptables
  - Background timer for session expiration

## Technical Specifications

### GPIO Configuration
- **Coin Slot Pin**: Configurable via admin interface
- **Status LED Pin**: Configurable via admin interface
- **Pin Numbering**: Physical pin numbering for cross-platform compatibility
- **Interrupt Handling**: High-speed pulse detection for coin slot

### Network Configuration
- **Default Gateway**: 10.0.0.1
- **Hotspot Interface**: Automated hostapd configuration
- **DNS**: dnsmasq for DHCP and DNS services
- **VLAN Support**: eth0.x format for tagged VLANs
- **Captive Portal**: Port 80/443 redirection to Node.js server

### Database Schema
```json
{
  "settings": {
    "hardware": {
      "coinSlotPin": 15,
      "statusLEDPin": 16,
      "platform": "auto-detect"
    },
    "network": {
      "wanInterface": "eth0",
      "lanInterface": "wlan0",
      "gateway": "10.0.0.1",
      "dhcpRange": "10.0.0.10-10.0.0.250"
    },
    "rates": {
      "timePerPeso": 30,
      "rates": [
        {"pesos": 1, "minutes": 30},
        {"pesos": 5, "minutes": 240}
      ]
    },
    "portal": {
      "title": "Welcome to PisoWiFi",
      "backgroundImage": "/assets/default-bg.jpg",
      "welcomeMessage": "Insert coin to start browsing"
    }
  },
  "sessions": [
    {
      "macAddress": "xx:xx:xx:xx:xx:xx",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-01-01T02:00:00Z",
      "pesos": 5,
      "minutes": 240,
      "active": true
    }
  ]
}
```

### API Endpoints

#### Hardware Management
- `GET /api/hardware/status` - Get hardware status
- `POST /api/hardware/config` - Update hardware configuration
- `GET /api/hardware/pins` - Get available GPIO pins

#### Network Management
- `GET /api/network/status` - Get network interfaces status
- `POST /api/network/vlan` - Add/remove VLAN
- `POST /api/network/wan` - Configure WAN interface
- `POST /api/network/hotspot` - Configure hotspot
- `GET /api/network/iptables` - Get iptables rules

#### Session Management
- `POST /api/session/start` - Start new session
- `GET /api/session/active` - Get active sessions
- `DELETE /api/session/:mac` - End specific session
- `POST /api/coin/detected` - Handle coin detection

#### Admin Configuration
- `GET /api/admin/rates` - Get current rates
- `POST /api/admin/rates` - Update rates configuration
- `GET /api/admin/portal` - Get portal settings
- `POST /api/admin/portal` - Update portal settings
- `GET /api/admin/dashboard` - Get dashboard statistics

#### User Portal
- `GET /portal` - User landing page
- `POST /portal/connect` - Connect to WiFi
- `GET /portal/status` - Get connection status

## Security Considerations

### Network Security
- iptables rules for traffic isolation
- MAC address-based access control
- Session timeout enforcement
- Captive portal authentication

### Hardware Security
- GPIO pin access restrictions
- Platform-specific security measures
- Mock mode isolation for development

### Data Security
- JSON-based database for reliability
- Session data encryption
- Configuration backup mechanisms

## Cross-Platform Compatibility

### Raspberry Pi (Raspbian)
- Full GPIO support via rpio
- NetworkManager integration
- Hardware-specific optimizations

### Orange Pi (Armbian)
- Allwinner chipset support
- GPIO compatibility layer
- Armbian-specific network tools

### Ubuntu x64 PC
- Mock GPIO mode for development
- Network simulation capabilities
- Full functionality without hardware

## Performance Requirements

### Response Times
- Coin detection: < 100ms
- Session start: < 500ms
- Portal page load: < 2s
- Admin dashboard: < 1s

### Resource Usage
- Memory: < 256MB for full system
- CPU: < 10% on Raspberry Pi 3
- Storage: < 100MB for complete installation
- Database: < 10MB for typical usage

## Deployment Architecture

### Development Environment
- Mock mode for hardware simulation
- Local development server
- Hot reload for frontend development

### Production Environment
- Systemd service for auto-start
- Nginx reverse proxy (optional)
- Automated backup scripts
- Log rotation configuration

## Monitoring and Maintenance

### Health Monitoring
- Hardware status monitoring
- Network connectivity checks
- Session expiration monitoring
- Error logging and alerting

### Maintenance Tasks
- Database cleanup for expired sessions
- Log file rotation
- Configuration backup
- System health reports

## Future Enhancements

### Planned Features
- Multi-language support
- Advanced reporting and analytics
- Remote management capabilities
- Mobile app for admin control
- Payment gateway integration
- Bandwidth throttling per user
- Content filtering options

### Scalability Considerations
- Multi-device support
- Load balancing capabilities
- Database migration to SQLite
- API rate limiting
- Caching mechanisms