
/**
 * Formats seconds into a standard HH:MM:SS format
 * @param seconds Total seconds
 * @returns string formatted as HH:MM:SS
 */
export const formatTimeRemaining = (seconds: number): string => {
  if (!seconds || seconds < 0 || isNaN(seconds)) return '00:00:00';
  
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  
  return `${hh}:${mm}:${ss}`;
};

/**
 * Formats seconds into a user-friendly verbose string
 * @param seconds Total seconds
 * @returns string like "2h 30m 15s" or "45m 10s"
 */
export const formatTimeVerbose = (seconds: number): string => {
  if (!seconds || seconds < 0 || isNaN(seconds)) return '0s';
  
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  
  return parts.join(' ');
};

/**
 * Calculates percentage of time remaining for progress bars
 * @param current Current seconds remaining
 * @param total Total seconds allocated (optional)
 * @returns number 0-100
 */
export const calculateTimeProgress = (current: number, total: number): number => {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
};
