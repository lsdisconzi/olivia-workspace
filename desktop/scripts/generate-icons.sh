#!/usr/bin/env bash
# generate-icons.sh — Convert build/icon.svg to .icns, .ico, .png
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
BUILD_DIR="$SCRIPT_DIR/../build"
SVG="$BUILD_DIR/icon.svg"

if [[ ! -f "$SVG" ]]; then
  echo "ERROR: $SVG not found"
  exit 1
fi

# Generate 1024x1024 PNG (base for all other sizes)
echo "Generating icon-1024.png..."
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 1024 -h 1024 "$SVG" -o "$BUILD_DIR/icon-1024.png"
elif command -v inkscape &>/dev/null; then
  inkscape -w 1024 -h 1024 "$SVG" -o "$BUILD_DIR/icon-1024.png"
elif command -v qlmanage &>/dev/null; then
  # macOS built-in
  qlmanage -t -s 1024 -o "$BUILD_DIR" "$SVG"
  mv "$BUILD_DIR/icon.svg.png" "$BUILD_DIR/icon-1024.png" 2>/dev/null || true
else
  echo "WARNING: No SVG→PNG converter found (rsvg-convert, inkscape, qlmanage)."
  echo "  Install one: brew install librsvg"
  exit 1
fi

P1024="$BUILD_DIR/icon-1024.png"

# ── macOS .icns ────────────────────────────────────────────────────────
echo "Generating icon.icns..."
ICONSET="$BUILD_DIR/icon.iconset"
mkdir -p "$ICONSET"
if command -v sips &>/dev/null; then
  sips -z 16 16 "$P1024" --out "$ICONSET/icon_16x16.png" &>/dev/null
  sips -z 32 32 "$P1024" --out "$ICONSET/icon_16x16@2x.png" &>/dev/null
  sips -z 32 32 "$P1024" --out "$ICONSET/icon_32x32.png" &>/dev/null
  sips -z 64 64 "$P1024" --out "$ICONSET/icon_32x32@2x.png" &>/dev/null
  sips -z 128 128 "$P1024" --out "$ICONSET/icon_128x128.png" &>/dev/null
  sips -z 256 256 "$P1024" --out "$ICONSET/icon_128x128@2x.png" &>/dev/null
  sips -z 256 256 "$P1024" --out "$ICONSET/icon_256x256.png" &>/dev/null
  sips -z 512 512 "$P1024" --out "$ICONSET/icon_256x256@2x.png" &>/dev/null
  sips -z 512 512 "$P1024" --out "$ICONSET/icon_512x512.png" &>/dev/null
  sips -z 1024 1024 "$P1024" --out "$ICONSET/icon_512x512@2x.png" &>/dev/null
  iconutil -c icns "$ICONSET" -o "$BUILD_DIR/icon.icns"
  rm -rf "$ICONSET"
  echo "  ✓ icon.icns"
else
  echo "  ⚠ sips not found — skipping .icns"
fi

# ── Windows .ico ───────────────────────────────────────────────────────
echo "Generating icon.ico..."
if command -v convert &>/dev/null || command -v magick &>/dev/null; then
  IMAGEMAGICK="${IMAGEMAGICK:-convert}"
  command -v magick &>/dev/null && IMAGEMAGICK="magick"
  "$IMAGEMAGICK" "$P1024" -resize 256x256 "$BUILD_DIR/icon-256.png"
  "$IMAGEMAGICK" "$P1024" -resize 128x128 "$BUILD_DIR/icon-128.png"
  "$IMAGEMAGICK" "$P1024" -resize 64x64 "$BUILD_DIR/icon-64.png"
  "$IMAGEMAGICK" "$P1024" -resize 48x48 "$BUILD_DIR/icon-48.png"
  "$IMAGEMAGICK" "$P1024" -resize 32x32 "$BUILD_DIR/icon-32.png"
  "$IMAGEMAGICK" "$P1024" -resize 16x16 "$BUILD_DIR/icon-16.png"
  "$IMAGEMAGICK" "$BUILD_DIR/icon-256.png" "$BUILD_DIR/icon-128.png" \
    "$BUILD_DIR/icon-64.png" "$BUILD_DIR/icon-48.png" \
    "$BUILD_DIR/icon-32.png" "$BUILD_DIR/icon-16.png" "$BUILD_DIR/icon.ico"
  rm -f "$BUILD_DIR"/icon-{256,128,64,48,32,16}.png
  echo "  ✓ icon.ico"
else
  echo "  ⚠ ImageMagick not found — skipping .ico"
fi

# ── Linux .png ─────────────────────────────────────────────────────────
echo "Generating icon.png (512x)..."
if command -v sips &>/dev/null; then
  sips -z 512 512 "$P1024" --out "$BUILD_DIR/icon.png" &>/dev/null
elif command -v convert &>/dev/null; then
  convert "$P1024" -resize 512x512 "$BUILD_DIR/icon.png"
elif command -v magick &>/dev/null; then
  magick "$P1024" -resize 512x512 "$BUILD_DIR/icon.png"
fi

echo "Done. Icons generated in $BUILD_DIR/"
ls -la "$BUILD_DIR"/icon.* 2>/dev/null || echo "  (some formats may be missing if tools weren't available)"
