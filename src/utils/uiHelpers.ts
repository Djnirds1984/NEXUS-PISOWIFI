export const getPauseResumeButtonClasses = (isPaused: boolean, pausingSession: boolean) => {
  const base = 'w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center';
  const state =
    isPaused
      ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
      : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white';
  const disabled = pausingSession ? 'opacity-75 cursor-not-allowed' : '';
  const pulse = isPaused && !pausingSession ? 'animate-pulse' : '';
  return [base, state, disabled, pulse].filter(Boolean).join(' ');
};

