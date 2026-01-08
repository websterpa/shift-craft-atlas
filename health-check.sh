#!/bin/bash

# Shift Craft - Health Check Script
# Runs syntax checks and tests to verify system integrity.

echo "🏥 Starting Health Check..."

# 1. Syntax Check (Lint)
echo "🔍 Checking JS Syntax..."
find src -name "*.js" -print0 | xargs -0 node -c
if [ $? -eq 0 ]; then
    echo "✅ Syntax OK"
else
    echo "❌ Syntax Errors Found"
    exit 1
fi

# 2. Check Critical Core Files
echo "📂 Verifying Core Files..."
REQUIRED_FILES=(
    "src/js/app.js"
    "src/js/core/ErrorBoundary.js"
    "src/js/core/ServiceRegistry.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing Critical File: $file"
        exit 1
    fi
done
echo "✅ Core Files Present"

echo "🎉 Health Check Passed!"
exit 0
