import { getPauseResumeButtonClasses } from '../src/utils/uiHelpers.ts';

const runVisibilityTests = () => {
  console.log('Running Portal Button Visibility Tests...');
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    if (condition) {
      console.log(`✅ ${name}: Passed`);
      passed++;
    } else {
      console.error(`❌ ${name}: Failed`);
      failed++;
    }
  };

  // Scenario 1: Paused, not processing -> should pulse and use green gradient
  {
    const classes = getPauseResumeButtonClasses(true, false);
    assert('Paused shows pulse animation', classes.includes('animate-pulse'));
    assert('Paused uses green gradient', classes.includes('from-green-500') && classes.includes('to-green-600'));
    assert('Not disabled when not processing', !classes.includes('cursor-not-allowed'));
  }

  // Scenario 2: Active, not processing -> no pulse, uses orange gradient
  {
    const classes = getPauseResumeButtonClasses(false, false);
    assert('Active does not pulse', !classes.includes('animate-pulse'));
    assert('Active uses orange gradient', classes.includes('from-orange-500') && classes.includes('to-orange-600'));
    assert('Not disabled when not processing', !classes.includes('cursor-not-allowed'));
  }

  // Scenario 3: Paused and processing -> disabled, no pulse
  {
    const classes = getPauseResumeButtonClasses(true, true);
    assert('Processing shows disabled state', classes.includes('cursor-not-allowed') && classes.includes('opacity-75'));
    assert('Processing does not pulse', !classes.includes('animate-pulse'));
    assert('Paused still uses green gradient while processing', classes.includes('from-green-500') && classes.includes('to-green-600'));
  }

  // Scenario 4: Active and processing -> disabled, orange gradient
  {
    const classes = getPauseResumeButtonClasses(false, true);
    assert('Active processing shows disabled state', classes.includes('cursor-not-allowed') && classes.includes('opacity-75'));
    assert('Active processing uses orange gradient', classes.includes('from-orange-500') && classes.includes('to-orange-600'));
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
};

runVisibilityTests();
