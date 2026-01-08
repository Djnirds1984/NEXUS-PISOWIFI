#!/bin/bash

echo "🧪 Running Pause Functionality Tests..."
echo "========================================"

# Run backend tests
echo "📋 Running backend pause tests..."
cd api
if command -v tsx &> /dev/null; then
  npx tsx tests/pause.test.ts
else
  echo "⚠️  tsx not found, skipping backend tests"
fi
cd ..

# Run frontend tests
echo "📋 Running frontend tests..."
cd src
if command -v tsx &> /dev/null; then
  npx tsx utils/timeUtils.test.ts
else
  echo "⚠️  tsx not found, skipping frontend tests"
fi
cd ..

echo "========================================"
echo "✅ All pause functionality tests completed!"