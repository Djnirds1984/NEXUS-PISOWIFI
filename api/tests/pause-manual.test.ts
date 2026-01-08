import { sessionManager } from '../sessionManager.js';
import { networkManager } from '../networkManager.js';

const runManualPauseTests = async () => {
  console.log('🧪 Running Manual Pause Functionality Tests...');
  console.log('==========================================');
  
  let passed = 0;
  let failed = 0;

  const assert = (name: string, actual: any, expected: any) => {
    if (actual === expected) {
      console.log(`✅ ${name}: Passed`);
      passed++;
    } else {
      console.error(`❌ ${name}: Failed (Expected "${expected}", got "${actual}")`);
      failed++;
    }
  };

  const assertNotEqual = (name: string, actual: any, expected: any) => {
    if (actual !== expected) {
      console.log(`✅ ${name}: Passed`);
      passed++;
    } else {
      console.error(`❌ ${name}: Failed (Expected not "${expected}", got "${actual}")`);
      failed++;
    }
  };

  try {
    // Test 1: Start a session
    console.log('\n📋 Test 1: Starting a session...');
    const testMac = 'aa:bb:cc:dd:ee:ff';
    const testIp = '10.0.0.100';
    const session = await sessionManager.startSession(testMac, 10, testIp);
    
    assert('Session created successfully', !!session, true);
    assert('Session is active', session.active, true);
    assert('Session is not paused', session.paused, false);
    assert('Session has correct MAC', session.macAddress, testMac.toLowerCase());
    assert('Session has correct pesos', session.pesos, 10);

    // Test 2: Pause session
    console.log('\n📋 Test 2: Pausing session...');
    const timeBeforePause = sessionManager.getSessionTimeRemaining(testMac);
    await sessionManager.pauseSession(testMac);
    
    const pausedSession = sessionManager.getSession(testMac);
    assert('Session is still active after pause', pausedSession?.active, true);
    assert('Session is paused', pausedSession?.paused, true);
    assert('Pause time is recorded', !!pausedSession?.pausedAt, true);
    assert('Pause duration is initialized', pausedSession?.pausedDuration, 0);
    assert('Time remaining is preserved', sessionManager.getSessionTimeRemaining(testMac), timeBeforePause);

    // Test 3: Verify internet access is blocked
    console.log('\n📋 Test 3: Checking internet access blocking...');
    const isAllowed = networkManager.isMacAllowed(testMac);
    assert('MAC address is blocked when paused', isAllowed, false);

    // Test 4: Resume session
    console.log('\n📋 Test 4: Resuming session...');
    console.log('Waiting 2 seconds before resuming...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await sessionManager.resumeSession(testMac);
    
    const resumedSession = sessionManager.getSession(testMac);
    assert('Session is still active after resume', resumedSession?.active, true);
    assert('Session is not paused after resume', resumedSession?.paused, false);
    assert('Pause time is cleared', resumedSession?.pausedAt, undefined);
    assert('Pause duration is updated', (resumedSession?.pausedDuration || 0) > 0, true);

    // Test 5: Verify internet access is restored
    console.log('\n📋 Test 5: Checking internet access restoration...');
    const isAllowedAfterResume = networkManager.isMacAllowed(testMac);
    assert('MAC address is allowed after resume', isAllowedAfterResume, true);

    // Test 6: Test error conditions
    console.log('\n📋 Test 6: Testing error conditions...');
    
    // Try to pause non-existent session
    try {
      await sessionManager.pauseSession('non:existent:mac');
      assert('Should throw error for non-existent session', true, false); // This should fail
    } catch (error) {
      assert('Throws error for non-existent session', (error as Error).message.includes('not found'), true);
    }

    // Try to pause already paused session
    await sessionManager.pauseSession(testMac);
    try {
      await sessionManager.pauseSession(testMac);
      assert('Should throw error for already paused session', true, false); // This should fail
    } catch (error) {
      assert('Throws error for already paused session', (error as Error).message.includes('already paused'), true);
    }

    // Try to resume non-paused session
    await sessionManager.resumeSession(testMac);
    try {
      await sessionManager.resumeSession(testMac);
      assert('Should throw error for non-paused session', true, false); // This should fail
    } catch (error) {
      assert('Throws error for non-paused session', (error as Error).message.includes('not paused'), true);
    }

    // Test 7: Test session extension after pause
    console.log('\n📋 Test 7: Testing session extension after pause...');
    const originalEndTime = resumedSession?.endTime;
    await sessionManager.pauseSession(testMac);
    console.log('Waiting 3 seconds before resuming...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await sessionManager.resumeSession(testMac);
    
    const extendedSession = sessionManager.getSession(testMac);
    assert('Session end time is extended after pause/resume', 
      (extendedSession?.endTime.getTime() || 0) > (originalEndTime?.getTime() || 0), true);

    // Test 8: Test time remaining calculation for paused session
    console.log('\n📋 Test 8: Testing time remaining calculation for paused session...');
    await sessionManager.pauseSession(testMac);
    const timeRemainingWhilePaused = sessionManager.getSessionTimeRemaining(testMac);
    console.log('Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const timeRemainingAfterWait = sessionManager.getSessionTimeRemaining(testMac);
    assert('Time remaining stays constant while paused', timeRemainingWhilePaused, timeRemainingAfterWait);

    // Cleanup
    console.log('\n📋 Cleaning up test session...');
    await sessionManager.endSession(testMac);
    const endedSession = sessionManager.getSession(testMac);
    assert('Session is ended properly', endedSession?.active, false);

    console.log('\n==========================================');
    console.log(`📊 Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      console.log('❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('✅ All pause functionality tests passed!');
      console.log('🎉 The pause functionality is working correctly!');
    }

  } catch (error) {
    console.error('❌ Test suite failed with error:', error);
    process.exit(1);
  }
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runManualPauseTests().catch(console.error);
}

export { runManualPauseTests };