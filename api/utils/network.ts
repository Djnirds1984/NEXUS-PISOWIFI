import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export async function resolveMACByIP(ip: string): Promise<string | null> {
  try {
    // Try ip neigh first
    const { stdout } = await execAsync(`ip neigh show ${ip}`);
    const match = stdout.match(/(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})/);
    if (match) return match[1].toLowerCase();
  } catch {}
  try {
    const { stdout } = await execAsync('arp -n');
    const line = stdout.split('\n').find(l => l.includes(ip));
    if (line) {
      const mac = line.match(/(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})/);
      if (mac) return mac[1].toLowerCase();
    }
  } catch {}
  try {
    const { stdout } = await execAsync('cat /var/lib/misc/dnsmasq.leases');
    const lease = stdout.split('\n').find(l => l.includes(ip));
    if (lease) {
      const parts = lease.trim().split(/\s+/);
      if (parts.length >= 3) return parts[1].toLowerCase();
    }
  } catch {}
  return null;
}

