import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { getSettings, updateSettings } from './database.js';

const execAsync = promisify(exec);

export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wireless' | 'vlan' | 'bridge';
  status: 'up' | 'down' | 'unknown';
  ipAddress?: string;
  macAddress?: string;
  gateway?: string;
  dns?: string[];
  vlanId?: number;
  parent?: string;
}

export interface NetworkStatus {
  interfaces: NetworkInterface[];
  defaultGateway: string;
  dnsServers: string[];
  internetConnected: boolean;
  hotspotActive: boolean;
  captivePortalActive: boolean;
}

export interface HotspotConfig {
  interface: string;
  ssid: string;
  password?: string;
  security?: 'open' | 'wpa2';
  channel: number;
  ipAddress: string;
  dhcpRange: string;
}

export class NetworkManager {
  private currentConfig: HotspotConfig | null = null;
  private iptablesRules: string[] = [];

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    const settings = getSettings();
    this.currentConfig = {
      interface: settings.network.lanInterface,
      ssid: 'PisoWiFi-Hotspot',
      password: 'pisowifi123',
      channel: 6,
      ipAddress: settings.network.gateway,
      dhcpRange: settings.network.dhcpRange
    };
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    try {
      const interfaces = await this.getNetworkInterfaces();
      const defaultGateway = await this.getDefaultGateway();
      const dnsServers = await this.getDNSServers();
      const internetConnected = await this.checkInternetConnection();
      const hotspotActive = await this.isHotspotActive();
      const captivePortalActive = await this.isCaptivePortalActive();

      return {
        interfaces,
        defaultGateway,
        dnsServers,
        internetConnected,
        hotspotActive,
        captivePortalActive
      };
    } catch (error) {
      console.error('Error getting network status:', error);
      throw error;
    }
  }

  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    try {
      const { stdout } = await execAsync('ip -j addr show');
      const interfaces = JSON.parse(stdout);
      
      return interfaces.map((iface: any) => ({
        name: iface.ifname,
        type: this.getInterfaceType(iface.ifname),
        status: iface.operstate?.toLowerCase() || 'unknown',
        ipAddress: iface.addr_info?.[0]?.local,
        macAddress: iface.address,
        vlanId: iface.linkinfo?.info_data?.id,
        parent: iface.master || iface.parent
      }));
    } catch (error) {
      console.error('Error getting network interfaces:', error);
      return [];
    }
  }

  private getInterfaceType(name: string): 'ethernet' | 'wireless' | 'vlan' | 'bridge' {
    if (name.startsWith('wlan') || name.startsWith('wifi')) return 'wireless';
    if (name.includes('.')) return 'vlan'; // VLAN interfaces have format like eth0.10
    if (name.startsWith('br')) return 'bridge';
    return 'ethernet';
  }

  async getDefaultGateway(): Promise<string> {
    try {
      const { stdout } = await execAsync('ip route show default');
      const match = stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
      return match ? match[1] : '';
    } catch (error) {
      console.error('Error getting default gateway:', error);
      return '';
    }
  }

  async getDNSServers(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('cat /etc/resolv.conf');
      const matches = stdout.match(/nameserver (\d+\.\d+\.\d+\.\d+)/g);
      return matches ? matches.map(match => match.split(' ')[1]) : [];
    } catch (error) {
      console.error('Error getting DNS servers:', error);
      return [];
    }
  }

  async checkInternetConnection(): Promise<boolean> {
    try {
      await execAsync('ping -c 1 8.8.8.8');
      return true;
    } catch (error) {
      return false;
    }
  }

  async isHotspotActive(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('systemctl is-active hostapd');
      return stdout.trim() === 'active';
    } catch (error) {
      return false;
    }
  }

  async isCaptivePortalActive(): Promise<boolean> {
    try {
      // Check if iptables rules for captive portal are active
      const { stdout } = await execAsync('iptables -t nat -L PREROUTING -n');
      return stdout.includes('10.0.0.1') && stdout.includes('dpt:80');
    } catch (error) {
      return false;
    }
  }

  async configureWAN(interfaceName: string, config: {
    type: 'dhcp' | 'static';
    ipAddress?: string;
    netmask?: string;
    gateway?: string;
    dns?: string[];
  }): Promise<void> {
    try {
      if (config.type === 'dhcp') {
        await this.configureDHCP(interfaceName);
      } else {
        // Ensure required fields are present for static IP
        if (!config.ipAddress || !config.netmask) {
          throw new Error('IP address and netmask are required for static IP configuration');
        }
        await this.configureStaticIP(interfaceName, {
          ipAddress: config.ipAddress,
          netmask: config.netmask,
          gateway: config.gateway,
          dns: config.dns
        });
      }

      // Update database
      const settings = getSettings();
      updateSettings({
        network: {
          ...settings.network,
          wanInterface: interfaceName
        }
      });

      console.log(`WAN interface ${interfaceName} configured as ${config.type}`);
    } catch (error) {
      console.error('Error configuring WAN:', error);
      throw error;
    }
  }

  private async configureDHCP(interfaceName: string): Promise<void> {
    try {
      // Use NetworkManager if available
      await execAsync(`nmcli connection modify "${interfaceName}" ipv4.method auto`);
      await execAsync(`nmcli connection up "${interfaceName}"`);
    } catch (error) {
      // Fallback to traditional method
      const config = `
auto ${interfaceName}
iface ${interfaceName} inet dhcp
`;
      await this.writeNetworkConfig(config);
      await execAsync('systemctl restart networking');
    }
  }

  private async configureStaticIP(interfaceName: string, config: {
    ipAddress: string;
    netmask: string;
    gateway?: string;
    dns?: string[];
  }): Promise<void> {
    try {
      // Use NetworkManager if available
      const dnsString = config.dns?.join(' ') || '8.8.8.8 8.8.4.4';
      await execAsync(`nmcli connection modify "${interfaceName}" ipv4.method manual ipv4.addresses ${config.ipAddress}/${config.netmask} ipv4.gateway ${config.gateway || ''} ipv4.dns "${dnsString}"`);
      await execAsync(`nmcli connection up "${interfaceName}"`);
    } catch (error) {
      // Fallback to traditional method
      const configText = `
auto ${interfaceName}
iface ${interfaceName} inet static
    address ${config.ipAddress}
    netmask ${config.netmask}
    ${config.gateway ? `gateway ${config.gateway}` : ''}
    ${config.dns ? `dns-nameservers ${config.dns.join(' ')}` : 'dns-nameservers 8.8.8.8 8.8.4.4'}
`;
      await this.writeNetworkConfig(configText);
      await execAsync('systemctl restart networking');
    }
  }

  private async writeNetworkConfig(config: string): Promise<void> {
    try {
      // Backup existing configuration
      await execAsync('cp /etc/network/interfaces /etc/network/interfaces.backup');
      
      // Write new configuration
      await execAsync(`echo "${config}" >> /etc/network/interfaces`);
    } catch (error) {
      console.error('Error writing network configuration:', error);
      throw error;
    }
  }

  async createVLAN(parentInterface: string, vlanId: number): Promise<void> {
    try {
      const vlanName = `${parentInterface}.${vlanId}`;
      
      // Create VLAN interface
      await execAsync(`ip link add link ${parentInterface} name ${vlanName} type vlan id ${vlanId}`);
      await execAsync(`ip link set ${vlanName} up`);

      // Update database
      const settings = getSettings();
      const vlanInterfaces = settings.network.vlanInterfaces || [];
      vlanInterfaces.push({
        parent: parentInterface,
        vlanId,
        name: vlanName
      });

      updateSettings({
        network: {
          ...settings.network,
          vlanInterfaces
        }
      });

      console.log(`VLAN ${vlanId} created on ${parentInterface} as ${vlanName}`);
    } catch (error) {
      console.error('Error creating VLAN:', error);
      throw error;
    }
  }

  async removeVLAN(vlanName: string): Promise<void> {
    try {
      await execAsync(`ip link delete ${vlanName}`);

      // Update database
      const settings = getSettings();
      const vlanInterfaces = (settings.network.vlanInterfaces || []).filter(
        vlan => vlan.name !== vlanName
      );

      updateSettings({
        network: {
          ...settings.network,
          vlanInterfaces
        }
      });

      console.log(`VLAN ${vlanName} removed`);
    } catch (error) {
      console.error('Error removing VLAN:', error);
      throw error;
    }
  }

  async setupHotspot(config: Partial<HotspotConfig> = {}): Promise<void> {
    try {
      const finalConfig = { ...this.currentConfig, ...config };
      
      // Install required packages if not present
      await this.installHotspotPackages();
      // Verify adapter supports AP mode
      await this.verifyAPSupport(finalConfig.interface);

      // Configure hostapd
      await this.configureHostapd(finalConfig);

      // Configure dnsmasq
      await this.configureDnsmasq(finalConfig);

      // Configure interface
      await this.configureHotspotInterface(finalConfig);

      // Enable IP forwarding
      await execAsync('sysctl -w net.ipv4.ip_forward=1');

      // Start services
      await execAsync('systemctl stop hostapd || true');
      await execAsync('systemctl stop dnsmasq || true');
      await execAsync('systemctl start hostapd');
      await execAsync('systemctl restart dnsmasq');
      await execAsync('systemctl enable hostapd');
      await execAsync('systemctl enable dnsmasq');

      this.currentConfig = finalConfig;

      console.log(`Hotspot configured: ${finalConfig.ssid} on ${finalConfig.interface}`);
    } catch (error) {
      console.error('Error setting up hotspot:', error);
      const message = (error as any)?.stderr || (error as any)?.stdout || (error as Error).message;
      throw new Error(`Hotspot setup failed: ${String(message).trim()}`);
    }
  }

  private async installHotspotPackages(): Promise<void> {
    try {
      await execAsync('which hostapd');
      await execAsync('which dnsmasq');
      await execAsync('which iw');
    } catch (error) {
      console.log('Installing hostapd and dnsmasq...');
      await execAsync('apt update && apt install -y hostapd dnsmasq iw');
    }
    // Ensure hostapd is not masked and ready
    await execAsync('systemctl unmask hostapd || true');
    await execAsync('systemctl disable wpa_supplicant || true');
    await execAsync('systemctl stop wpa_supplicant || true');
    await execAsync('systemctl stop dhcpcd || true');
    await execAsync('systemctl stop NetworkManager || true');
    await execAsync('rfkill unblock wifi || true');
    // Ensure dnsmasq loads configs from /etc/dnsmasq.d
    await execAsync('grep -q "conf-dir=/etc/dnsmasq.d" /etc/dnsmasq.conf || echo "conf-dir=/etc/dnsmasq.d,*.conf" >> /etc/dnsmasq.conf');
  }

  private async configureHostapd(config: HotspotConfig): Promise<void> {
    const isOpen = (config.security === 'open') || !config.password;
    const hostapdConfig = `
interface=${config.interface}
driver=nl80211
ssid=${config.ssid}
hw_mode=g
channel=${config.channel}
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
${isOpen ? 'wpa=0' : 'wpa=2'}
${isOpen ? '' : `wpa_passphrase=${config.password}`}
${isOpen ? '' : 'wpa_key_mgmt=WPA-PSK'}
${isOpen ? '' : 'wpa_pairwise=TKIP'}
${isOpen ? '' : 'rsn_pairwise=CCMP'}
`;

    await execAsync(`echo "${hostapdConfig}" > /etc/hostapd/hostapd.conf`);
    await execAsync('echo "DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"" > /etc/default/hostapd');
  }

  private async configureDnsmasq(config: HotspotConfig): Promise<void> {
    const [start, end] = config.dhcpRange.split('-');
    const dnsmasqConfig = `
interface=${config.interface}
bind-interfaces
dhcp-range=${start},${end},255.255.255.0,24h
dhcp-option=3,${config.ipAddress}
dhcp-option=6,${config.ipAddress}
server=8.8.8.8
server=8.8.4.4
address=/#/${config.ipAddress}
`;
    // Write to dedicated config to avoid overwriting global
    await execAsync(`echo "${dnsmasqConfig}" > /etc/dnsmasq.d/pisowifi.conf`);
  }

  private async configureHotspotInterface(config: HotspotConfig): Promise<void> {
    // Configure interface IP without editing system files
    await execAsync(`ip link set ${config.interface} down || true`);
    await execAsync(`ip addr flush dev ${config.interface} || true`);
    // Only add address if not already present
    const { stdout } = await execAsync(`ip -4 addr show dev ${config.interface}`);
    if (!stdout.includes(`${config.ipAddress}/24`)) {
      await execAsync(`ip addr add ${config.ipAddress}/24 dev ${config.interface}`);
    }
    await execAsync(`ip link set ${config.interface} up`);
  }
 
  private async verifyAPSupport(interfaceName: string): Promise<void> {
    if (process.env.CAPTIVE_SKIP_AP_VERIFY === 'true') {
      return;
    }
    try {
      const { stdout } = await execAsync('iw list');
      if (!stdout.includes('AP')) {
        const devInfo = await execAsync(`iw dev ${interfaceName} info`).catch(() => ({ stdout: '' }));
        const phyInfo = await execAsync('iw phy').catch(() => ({ stdout: '' }));
        const ok = devInfo.stdout.includes('type AP') || phyInfo.stdout.includes('AP');
        if (!ok) {
          throw new Error('Wireless adapter does not support AP mode');
        }
      }
    } catch (error) {
      if (process.env.CAPTIVE_SKIP_AP_VERIFY === 'true') {
        return;
      }
      throw new Error('Cannot verify AP mode support. Ensure iw is installed and adapter supports AP.');
    }
  }

  async enableCaptivePortal(): Promise<void> {
    try {
      const settings = getSettings();
      const gateway = settings.network.gateway;

      // Clear existing rules
      await this.clearCaptivePortalRules();

      // Add iptables rules for captive portal
      const rules = [
        `iptables -t nat -A PREROUTING -i ${settings.network.lanInterface} -p tcp --dport 80 -j DNAT --to-destination ${gateway}:80`,
        `iptables -t nat -A PREROUTING -i ${settings.network.lanInterface} -p tcp --dport 443 -j DNAT --to-destination ${gateway}:443`,
        `iptables -t nat -A POSTROUTING -o ${settings.network.wanInterface} -j MASQUERADE`,
        `iptables -A FORWARD -i ${settings.network.lanInterface} -o ${settings.network.wanInterface} -j ACCEPT`,
        `iptables -A FORWARD -i ${settings.network.wanInterface} -o ${settings.network.lanInterface} -m state --state RELATED,ESTABLISHED -j ACCEPT`
      ];

      for (const rule of rules) {
        await execAsync(rule);
        this.iptablesRules.push(rule);
      }

      console.log('Captive portal enabled');
    } catch (error) {
      console.error('Error enabling captive portal:', error);
      throw error;
    }
  }

  async disableCaptivePortal(): Promise<void> {
    try {
      await this.clearCaptivePortalRules();
      console.log('Captive portal disabled');
    } catch (error) {
      console.error('Error disabling captive portal:', error);
      throw error;
    }
  }

  async clearCaptivePortalRules(): Promise<void> {
    try {
      // Clear NAT rules
      await execAsync('iptables -t nat -F PREROUTING');
      await execAsync('iptables -t nat -F POSTROUTING');
      
      // Clear filter rules
      await execAsync('iptables -F FORWARD');
      
      this.iptablesRules = [];
    } catch (error) {
      console.error('Error clearing captive portal rules:', error);
    }
  }

  async allowMACAddress(macAddress: string): Promise<void> {
    try {
      const settings = getSettings();
      
      // Allow traffic from this MAC address
      await execAsync(`iptables -I FORWARD -m mac --mac-source ${macAddress} -j ACCEPT`);
      
      console.log(`MAC address ${macAddress} allowed through captive portal`);
    } catch (error) {
      console.error('Error allowing MAC address:', error);
      throw error;
    }
  }

  async blockMACAddress(macAddress: string): Promise<void> {
    try {
      // Remove rules for this MAC address
      await execAsync(`iptables -D FORWARD -m mac --mac-source ${macAddress} -j ACCEPT`);
      
      console.log(`MAC address ${macAddress} blocked from captive portal`);
    } catch (error) {
      console.error('Error blocking MAC address:', error);
      // Ignore errors if rule doesn't exist
    }
  }

  async restartNetworking(): Promise<void> {
    try {
      await execAsync('systemctl restart networking');
      await execAsync('systemctl restart NetworkManager');
      console.log('Networking services restarted');
    } catch (error) {
      console.error('Error restarting networking:', error);
      throw error;
    }
  }

  async getIptablesRules(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('iptables -L -n -v');
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Error getting iptables rules:', error);
      return [];
    }
  }
}

// Export singleton instance
export const networkManager = new NetworkManager();
