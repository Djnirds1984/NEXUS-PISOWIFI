import { setTimeout as sleep } from 'timers/promises';

function getArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  return fallback;
}

async function main() {
  const pinArg = getArg('pin');
  const ledArg = getArg('led');
  const debounceArg = getArg('debounce', '50');
  const durationArg = getArg('duration');

  const coinPin = pinArg ? parseInt(pinArg, 10) : 3;
  const ledPin = ledArg ? parseInt(ledArg, 10) : 16;
  const debounceMs = debounceArg ? parseInt(debounceArg, 10) : 50;
  const durationMs = durationArg ? parseInt(durationArg, 10) * 1000 : 0;

  let rpio: any;
  try {
    rpio = await import('rpio');
  } catch (e) {
    console.error('rpio module not available. Run on Raspberry Pi with rpio installed.');
    process.exit(1);
  }

  rpio.init({ gpiomem: true, mapping: 'physical' });
  rpio.open(coinPin, rpio.INPUT, rpio.PULL_UP);
  let ledOpened = false;
  if (ledPin && Number.isFinite(ledPin)) {
    try {
      rpio.open(ledPin, rpio.OUTPUT, rpio.LOW);
      ledOpened = true;
    } catch {}
  }

  let count = 0;
  let lastTs = 0;
  let running = true;

  const blink = async (ms: number) => {
    if (!ledOpened) return;
    try {
      rpio.write(ledPin, rpio.HIGH);
      await sleep(ms);
      rpio.write(ledPin, rpio.LOW);
    } catch {}
  };

  const onPulse = async (pin: number) => {
    const state = rpio.read(pin);
    if (state !== 0) return;
    const now = Date.now();
    if (now - lastTs < debounceMs) return;
    lastTs = now;
    count++;
    console.log(`Pulse #${count} on pin ${pin} at ${new Date(now).toISOString()}`);
    await blink(120);
  };

  rpio.poll(coinPin, onPulse as any, rpio.POLL_LOW);

  const cleanup = () => {
    if (!running) return;
    running = false;
    try {
      rpio.poll(coinPin, null);
    } catch {}
    try {
      rpio.close(coinPin);
    } catch {}
    if (ledOpened) {
      try {
        rpio.write(ledPin, rpio.LOW);
        rpio.close(ledPin);
      } catch {}
    }
    console.log(`Stopped. Total pulses: ${count}`);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  console.log(`Coin pulse test running. Coin pin: ${coinPin}, LED pin: ${ledPin || 'none'}, debounce: ${debounceMs}ms${durationMs ? `, duration: ${durationMs / 1000}s` : ''}`);
  if (durationMs > 0) {
    setTimeout(() => {
      cleanup();
      process.exit(0);
    }, durationMs).unref();
  }
}

main().catch(err => {
  console.error('Coin pulse test error:', err);
  process.exit(1);
});
