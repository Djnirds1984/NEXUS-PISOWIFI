import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { getSettings, updateSettings, upsertDevice, getDevices, updateDevice } from './database.js';

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
      const sysctlCmd = await this.getSysctlCmd();
      if (sysctlCmd) {
        await execAsync(`${sysctlCmd} -w net.ipv4.ip_forward=1`);
      } else {
        await execAsync('echo 1 > /proc/sys/net/ipv4/ip_forward');
      }

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
    const hostapdCmd = await this.getHostapdCmd();
    const dnsmasqCmd = await this.getDnsmasqCmd();
    const iwCmd = await this.getIwCmd();
    if (!hostapdCmd || !dnsmasqCmd) {
      console.log('hostapd/dnsmasq not found in PATH; proceeding without installation');
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
    const country = process.env.CAPTIVE_COUNTRY_CODE || 'US';
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
country_code=${country}
ieee80211d=1
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
      const iwAvailable = await execAsync('which iw').then(() => true).catch(() => false);
      if (!iwAvailable) {
        return;
      }
      const listOut = await execAsync('iw list').catch(() => ({ stdout: '' }));
      if (listOut.stdout && listOut.stdout.includes('AP')) {
        return;
      }
      const devInfo = await execAsync(`iw dev ${interfaceName} info`).catch(() => ({ stdout: '' }));
      const phyInfo = await execAsync('iw phy').catch(() => ({ stdout: '' }));
      const ok = devInfo.stdout.includes('type AP') || phyInfo.stdout.includes('AP');
      if (ok) {
        return;
      }
      const links = await execAsync('ip -j link').catch(() => ({ stdout: '[]' }));
      const exists = (() => {
        try {
          const arr = JSON.parse((links as any).stdout);
          return Array.isArray(arr) && arr.some((i: any) => i.ifname === interfaceName);
        } catch {
          return true;
        }
      })();
      if (!exists) {
        throw new Error(`Interface ${interfaceName} not found`);
      }
      return;
    } catch (error) {
      if (process.env.CAPTIVE_SKIP_AP_VERIFY === 'true') return;
      return;
    }
  }

  private async getIptablesCmd(): Promise<string | null> {
    const candidates = [
      'iptables',
      '/usr/sbin/iptables',
      '/sbin/iptables',
      '/usr/bin/iptables',
      '/bin/iptables',
      '/usr/sbin/iptables-nft',
      '/usr/sbin/iptables-legacy'
    ];
    for (const cmd of candidates) {
      const ok = await execAsync(`${cmd} --version`).then(() => true).catch(() => false);
      if (ok) return cmd;
    }
    return null;
  }
 
  private async getHostapdCmd(): Promise<string | null> {
    const candidates = ['hostapd', '/usr/sbin/hostapd', '/sbin/hostapd', '/usr/bin/hostapd', '/bin/hostapd'];
    for (const cmd of candidates) {
      const ok = await execAsync(`${cmd} -v`).then(() => true).catch(() => false);
      if (ok) return cmd;
    }
    return null;
  }
 
  private async getDnsmasqCmd(): Promise<string | null> {
    const candidates = ['dnsmasq', '/usr/sbin/dnsmasq', '/sbin/dnsmasq', '/usr/bin/dnsmasq', '/bin/dnsmasq'];
    for (const cmd of candidates) {
      const ok = await execAsync(`${cmd} --version`).then(() => true).catch(() => false);
      if (ok) return cmd;
    }
    return null;
  }
 
  private async getIwCmd(): Promise<string | null> {
    const candidates = ['iw', '/usr/sbin/iw', '/sbin/iw', '/usr/bin/iw', '/bin/iw'];
    for (const cmd of candidates) {
      const ok = await execAsync(`${cmd} --version`).then(() => true).catch(() => false);
      if (ok) return cmd;
    }
    return null;
  }
 
  private async getSysctlCmd(): Promise<string | null> {
    const candidates = ['sysctl', '/usr/sbin/sysctl', '/sbin/sysctl', '/usr/bin/sysctl', '/bin/sysctl'];
    for (const cmd of candidates) {
      const ok = await execAsync(`${cmd} --version`).then(() => true).catch(() => false);
      if (ok) return cmd;
    }
    return null;
  }
 
  async enableCaptivePortal(): Promise<void> {
    try {
      const settings = getSettings();
      const gateway = settings.network.gateway;

      const ipt = await this.getIptablesCmd();
      if (!ipt) {
        console.log('iptables not found; captive portal rules skipped.');
        return;
      }

      // Clear existing rules
      await this.clearCaptivePortalRules();

      // Add iptables rules for captive portal
      const rules = [
        `${ipt} -t nat -A PREROUTING -i ${settings.network.lanInterface} -p tcp --dport 80 -j DNAT --to-destination ${gateway}:80`,
        `${ipt} -t nat -A PREROUTING -i ${settings.network.lanInterface} -p tcp --dport 443 -j DNAT --to-destination ${gateway}:443`,
        `${ipt} -t nat -A POSTROUTING -o ${settings.network.wanInterface} -j MASQUERADE`,
        `${ipt} -A FORWARD -i ${settings.network.lanInterface} -o ${settings.network.wanInterface} -j ACCEPT`,
        `${ipt} -A FORWARD -i ${settings.network.wanInterface} -o ${settings.network.lanInterface} -m state --state RELATED,ESTABLISHED -j ACCEPT`
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
      const ipt = await this.getIptablesCmd();
      if (!ipt) return;

      // Clear NAT rules
      await execAsync(`${ipt} -t nat -F PREROUTING`);
      await execAsync(`${ipt} -t nat -F POSTROUTING`);
      
      // Clear filter rules
      await execAsync(`${ipt} -F FORWARD`);
      
      this.iptablesRules = [];
    } catch (error) {
      console.error('Error clearing captive portal rules:', error);
    }
  }

  async allowMACAddress(macAddress: string): Promise<void> {
    try {
      const settings = getSettings();
      
      // Allow traffic from this MAC address
      const ipt = await this.getIptablesCmd();
      if (!ipt) return;
      await execAsync(`${ipt} -I FORWARD -m mac --mac-source ${macAddress} -j ACCEPT`);
      
      console.log(`MAC address ${macAddress} allowed through captive portal`);
    } catch (error) {
      console.error('Error allowing MAC address:', error);
      throw error;
    }
  }

  async blockMACAddress(macAddress: string): Promise<void> {
    try {
      // Remove rules for this MAC address
      const ipt = await this.getIptablesCmd();
      if (!ipt) return;
      await execAsync(`${ipt} -D FORWARD -m mac --mac-source ${macAddress} -j ACCEPT`);
      
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
      const ipt = await this.getIptablesCmd();
      if (!ipt) return [];
      const { stdout } = await execAsync(`${ipt} -L -n -v`);
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Error getting iptables rules:', error);
      return [];
    }
  }

  async listActiveDevices(): Promise<Array<{ macAddress: string; ipAddress: string; hostname?: string }>> {
    const settings = getSettings();
    const lan = settings.network.lanInterface;
    // Prefer ip neigh (kernel neighbor table)
    try {
      const { stdout } = await execAsync(`ip -json neigh show dev ${lan}`);
      const arr = JSON.parse(stdout);
      const res = (Array.isArray(arr) ? arr : []).map((n: any) => ({
        macAddress: (n.lladdr || '').toLowerCase(),
        ipAddress: n.dst || '',
        hostname: ''
      })).filter((x: any) => x.macAddress && x.ipAddress);
      if (res.length) return res;
    } catch {}
    // Try global neighbor table (no dev filter)
    try {
      const { stdout } = await execAsync('ip -json neigh show');
      const arr = JSON.parse(stdout);
      const res = (Array.isArray(arr) ? arr : []).map((n: any) => ({
        macAddress: (n.lladdr || '').toLowerCase(),
        ipAddress: n.dst || '',
        hostname: ''
      })).filter((x: any) => x.macAddress && x.ipAddress);
      if (res.length) return res;
    } catch {}
    // Fallback: ip neigh (text)
    try {
      const { stdout } = await execAsync(`ip neigh show dev ${lan}`);
      const lines = stdout.split('\n').filter(Boolean);
      const res = lines.map(line => {
        const ip = (line.split(' ')[0] || '').trim();
        const macMatch = line.match(/lladdr\s+(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})/);
        const mac = macMatch ? macMatch[1].toLowerCase() : '';
        return { macAddress: mac, ipAddress: ip, hostname: '' };
      }).filter(x => x.macAddress && x.ipAddress);
      if (res.length) return res;
    } catch {}
    // Fallback: /proc/net/arp
    try {
      const { stdout } = await execAsync('cat /proc/net/arp');
      const lines = stdout.split('\n').slice(1).filter(Boolean);
      const res = lines.map(l => {
        const parts = l.trim().split(/\s+/);
        const ip = parts[0];
        const mac = (parts[3] || '').toLowerCase();
        return { macAddress: mac, ipAddress: ip, hostname: '' };
      }).filter(x => x.macAddress && x.ipAddress);
      if (res.length) return res;
    } catch {}
    // Fallback: dnsmasq leases
    const leasePaths = [
      '/var/lib/misc/dnsmasq.leases',
      '/var/lib/dnsmasq/dnsmasq.leases',
      '/var/run/dnsmasq/dnsmasq.leases'
    ];
    for (const p of leasePaths) {
      try {
        const { stdout } = await execAsync(`cat ${p}`);
        const lines = stdout.split('\n').filter(Boolean);
        const res = lines.map(l => {
          const parts = l.split(' ');
          return { macAddress: (parts[1] || '').toLowerCase(), ipAddress: parts[2] || '', hostname: parts[3] || '' };
        }).filter(x => x.macAddress && x.ipAddress);
        if (res.length) return res;
      } catch {}
    }
    // Last resort: arp -an
    try {
      const { stdout } = await execAsync('arp -an');
      const lines = stdout.split('\n').filter(Boolean);
      const res = lines.map(l => {
        const ipMatch = l.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
        const macMatch = l.match(/(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})/);
        return { macAddress: macMatch ? macMatch[1].toLowerCase() : '', ipAddress: ipMatch ? ipMatch[1] : '' };
      }).filter(x => x.macAddress && x.ipAddress);
      return res;
    } catch {
      return [];
    }
  }

  async refreshDeviceStatus(): Promise<void> {
    const list = await this.listActiveDevices();
    const now = new Date().toISOString();
    for (const d of list) {
      upsertDevice({
        macAddress: d.macAddress,
        ipAddress: d.ipAddress,
        hostname: d.hostname || '',
        lastSeen: now,
        firstSeen: now,
        connected: true
      });
    }
    const all = getDevices();
    for (const dev of all) {
      const active = list.find(x => x.macAddress.toLowerCase() === dev.macAddress.toLowerCase());
      updateDevice(dev.macAddress, {
        connected: !!active,
        lastSeen: active ? now : dev.lastSeen
      });
    }
  }

  async enableCakeQoS(params: { interface: string; bandwidthKbps: number; diffserv?: string }): Promise<void> {
    const iface = params.interface;
    const bw = params.bandwidthKbps;
    const ds = params.diffserv || 'besteffort';
    try {
      await execAsync(`tc qdisc replace dev ${iface} root cake bandwidth ${bw}kbit ${ds} nat dual-srchost dual-dsthost`);
    } catch (e) {
      throw e;
    }
  }

  async disableCakeQoS(iface: string): Promise<void> {
    try {
      await execAsync(`tc qdisc del dev ${iface} root || true`);
    } catch {}
  }

  async setDeviceBandwidthCap(iface: string, ip: string, capKbps: number): Promise<void> {
    try {
      await execAsync(`tc qdisc add dev ${iface} handle ffff: ingress || true`);
      await execAsync(`tc filter replace dev ${iface} parent ffff: protocol ip prio 1 u32 match ip src ${ip} police rate ${capKbps}kbit burst 10k drop flowid :1`);
      await execAsync(`tc qdisc replace dev ${iface} root handle 1: htb default 30 || true`);
      const rate = Math.max(capKbps, 64);
      await execAsync(`tc class replace dev ${iface} parent 1: classid 1:1 htb rate ${rate}kbit ceil ${rate}kbit`);
    } catch (e) {
      throw e;
    }
  }

  async getDeviceUsage(iface: string, ip: string): Promise<{ bytes: number }> {
    try {
      const { stdout } = await execAsync(`iptables -L FORWARD -v -n | grep ${ip} | awk '{print $2}' | head -n 1`);
      const bytes = parseInt(stdout.trim(), 10);
      return { bytes: isNaN(bytes) ? 0 : bytes };
    } catch {
      return { bytes: 0 };
    }
  }
}

// Export singleton instance
export const networkManager = new NetworkManager();
