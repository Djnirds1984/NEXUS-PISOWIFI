
import { formatTimeRemaining, formatTimeVerbose } from './timeUtils.js';

const runTests = () => {
  console.log('Running TimeUtils Tests...');
  let passed = 0;
  let failed = 0;

  const assert = (name: string, actual: string, expected: string) => {
    if (actual === expected) {
      console.log(`✅ ${name}: Passed`);
      passed++;
    } else {
      console.error(`❌ ${name}: Failed (Expected "${expected}", got "${actual}")`);
      failed++;
    }
  };

  // formatTimeRemaining tests
  assert('Standard Time', formatTimeRemaining(3661), '01:01:01');
  assert('Zero Time', formatTimeRemaining(0), '00:00:00');
  assert('Negative Time', formatTimeRemaining(-5), '00:00:00');
  assert('Large Time', formatTimeRemaining(36000), '10:00:00');
  assert('Minutes Only', formatTimeRemaining(65), '00:01:05');

  // formatTimeVerbose tests
  assert('Verbose Standard', formatTimeVerbose(3665), '1h 1m 5s');
  assert('Verbose Minutes', formatTimeVerbose(65), '1m 5s');
  assert('Verbose Seconds', formatTimeVerbose(45), '45s');
  assert('Verbose Days', formatTimeVerbose(90000), '1d 1h'); // 90000 = 86400 + 3600

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

runTests();
