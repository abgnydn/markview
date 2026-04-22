#!/bin/bash
# Build script for MarkView Context Vault
# Creates a clean build directory with all deps installed flat,
# then packages into a .app bundle.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="/tmp/markview-vault-build"

echo "🔨 Building MarkView Context Vault..."

# 1. Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 2. Copy source files
echo "📦 Copying source files..."
cp "$APP_DIR/main.js" "$BUILD_DIR/"
cp "$APP_DIR/signaling.js" "$BUILD_DIR/"
cp "$APP_DIR/mcp-bridge.js" "$BUILD_DIR/"
cp "$APP_DIR/mcp-bridge-testable.js" "$BUILD_DIR/"
cp "$APP_DIR/privacy-dashboard.html" "$BUILD_DIR/"
cp "$APP_DIR/welcome.html" "$BUILD_DIR/"
cp "$APP_DIR/dashboard-preload.js" "$BUILD_DIR/"
cp "$APP_DIR/package.json" "$BUILD_DIR/"
cp -r "$APP_DIR/assets" "$BUILD_DIR/"

# 3. Install ALL dependencies (including devDependencies for electron)
echo "📥 Installing dependencies..."
cd "$BUILD_DIR"
npm install --ignore-scripts 2>&1 | tail -3

# 4. Package with electron-packager  
echo "📱 Packaging .app..."
npx -y @electron/packager . "MarkView Context Vault" \
  --platform=darwin \
  --arch=arm64 \
  --icon=assets/icon.icns \
  --out="$APP_DIR/dist" \
  --overwrite \
  --prune=true

# 5. Install to /Applications
echo "🚀 Installing to /Applications..."
rm -rf "/Applications/MarkView Context Vault.app"
ditto "$APP_DIR/dist/MarkView Context Vault-darwin-arm64/MarkView Context Vault.app" "/Applications/MarkView Context Vault.app"

echo ""
echo "✅ Done! MarkView Context Vault is now in /Applications"
echo "   Open it from Spotlight (Cmd+Space → MarkView)"

# Cleanup
rm -rf "$BUILD_DIR"
