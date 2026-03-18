#!/bin/bash
# Build the MarkView web app and package it into the Chrome extension
# Usage: ./build-extension.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../web"
EXT_DIR="$SCRIPT_DIR"

echo "🔨 Expecting MarkView web app to be built already..."
# cd "$WEB_DIR"
# npm run build

echo "📦 Copying static export to extension..."
rm -rf "$EXT_DIR/app"
mkdir -p "$EXT_DIR/app"
cp -r "$WEB_DIR/out/"* "$EXT_DIR/app/"

echo "🔧 Fixing inline scripts for Chrome MV3 CSP..."
python3 "$EXT_DIR/fix-inline-scripts.py" "$EXT_DIR/app"

echo "✅ Extension build complete!"
echo ""
echo "To install:"
echo "  1. Go to chrome://extensions/"
echo "  2. Enable Developer mode"
echo "  3. Click 'Load unpacked' → select: $EXT_DIR"
