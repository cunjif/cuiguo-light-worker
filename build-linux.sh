#!/bin/bash
# Build Linux deb package using Docker
# Usage: ./build-linux.sh [deb|AppImage|all]

set -e

TARGET=${1:-deb}

echo "🐧 Building Linux package: $TARGET"
echo "📦 Project: $(pwd)"

# Create cache directories
mkdir -p .cache/electron
mkdir -p .cache/electron-builder

# Run electron-builder in Docker
docker run --rm \
  -v "$(pwd)":/project \
  -v "$(pwd)/.cache/electron:/root/.cache/electron" \
  -v "$(pwd)/.cache/electron-builder:/root/.cache/electron-builder" \
  electronuserland/builder:wine \
  /bin/bash -c "
    set -e
    cd /project
    echo '📥 Installing dependencies...'
    npm install
    echo '🔨 Building TypeScript...'
    npm run build
    echo '📦 Packaging for Linux (target: $TARGET)...'
    npx electron-builder --linux $TARGET
    echo '✅ Build complete! Check artifacts/ directory'
  "

echo ""
echo "🎉 Build finished!"
echo "📂 Output: ./artifacts/"
ls -lh artifacts/ 2>/dev/null || echo "No artifacts found"
