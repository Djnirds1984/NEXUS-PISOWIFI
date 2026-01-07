import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export async function resolveMACByIP(ip: string): Promise<string | null> {
  // 1. Try ip neigh first (most accurate for active connections)
  try {
    const { stdout } = await execAsync(`ip neigh show ${ip}`);
    const match = stdout.match(/(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})/);
    if (match) return match[1].toLowerCase();
  } catch {}

  // 2. Try ARP table
  try {
    const { stdout } = await execAsync('arp -n');
    const line = stdout.split('\n').find(l => l.includes(ip));
    if (line) {
      const mac = line.match(/(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})/);
      if (mac) return mac[1].toLowerCase();
    }
  } catch {}

  // 3. Try dnsmasq leases (check multiple common paths)
  const leasePaths = [
    '/var/lib/misc/dnsmasq.leases',
    '/var/lib/dnsmasq/dnsmasq.leases',
    '/tmp/dnsmasq.leases',
    '/var/run/dnsmasq.leases'
  ];

  for (const path of leasePaths) {
    try {
      const { stdout } = await execAsync(`cat ${path}`);
      const lease = stdout.split('\n').find(l => l.includes(ip));
      if (lease) {
        const parts = lease.trim().split(/\s+/);
        // dnsmasq.leases format: timestamp mac ip hostname client-id
        if (parts.length >= 3) return parts[1].toLowerCase();
      }
    } catch {}
  }

  // 4. Try hostapd_cli (if it's a wifi client)
  try {
    const { stdout } = await execAsync('hostapd_cli all_sta');
    // Output is block-based, but we can search for the IP in the block of a MAC
    // Or just iterate active clients.
    // Easier: Get all stations, then check their IP (if hostapd tracks it - often it doesn't track IP directly)
    // Actually, hostapd tracks MACs. We need IP->MAC. 
    // This step is hard for IP->MAC. Skip for now, rely on ARP/Leases.
  } catch {}

  return null;
}

