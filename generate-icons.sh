#!/bin/bash
# generate-icons.sh - Generate PWA and Favicon Icons for Top Autocare Garage
# Usage: ./generate-icons.sh [source-image.png]
# Source: High-res PNG (e.g., 1024x1024) - square, transparent background recommended
# Requirements: ImageMagick (brew install imagemagick on macOS, apt install on Linux)
# Output: /assets/images/ with PNG icons and favicon.ico
# Author: PWA Generator Script v1.0

# Configuration
SOURCE_IMAGE="${1:-source-icon.png}"  # Default source if no arg
OUTPUT_DIR="assets/images"           # Output directory (relative to script)
ERROR_COLOR="\033[0;31m"             # Red for errors
SUCCESS_COLOR="\033[0;32m"           # Green for success
INFO_COLOR="\033[0;36m"              # Cyan for info
NC="\033[0m"                         # No Color

# Icon sizes (PWA + Favicon + Apple Touch)
SIZES_PNG=(16 32 96 192 512)
SIZES_APPLE=(180)
SIZES_FAVICON_ICO=(16 32 48 64 128)  # Multi-sizes for ICO

# Check if source exists
if [[ ! -f "$SOURCE_IMAGE" ]]; then
  echo -e "${ERROR_COLOR}Error: Source image '$SOURCE_IMAGE' not found!${NC}"
  echo "Usage: $0 [path/to/source-icon.png]"
  exit 1
fi

# Check ImageMagick
if ! command -v convert &> /dev/null; then
  echo -e "${ERROR_COLOR}Error: ImageMagick not installed! Install it first.${NC}"
  echo "macOS: brew install imagemagick"
  echo "Ubuntu/Debian: sudo apt install imagemagick"
  echo "Windows: Install via Chocolatey or download from imagemagick.org"
  exit 1
fi

# Create output dir if needed
mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR" || exit 1

echo -e "${INFO_COLOR}Generating icons from '$SOURCE_IMAGE' to '$OUTPUT_DIR'...${NC}"

# Generate PNG icons for PWA/Manifest
for size in "${SIZES_PNG[@]}"; do
  output="app-icon-${size}.png"
  convert "$SOURCE_IMAGE" -resize "${size}x${size}" -background none -gravity center -extent "${size}x${size}" "$output"
  if [[ $? -eq 0 ]]; then
    echo -e "${SUCCESS_COLOR}✓ Generated ${output} (${size}x${size})${NC}"
  else
    echo -e "${ERROR_COLOR}✗ Failed to generate ${output}${NC}"
  fi
done

# Generate Apple Touch Icons
for size in "${SIZES_APPLE[@]}"; do
  output="apple-touch-icon-${size}.png"
  convert "$SOURCE_IMAGE" -resize "${size}x${size}" -background none -gravity center -extent "${size}x${size}" "$output"
  if [[ $? -eq 0 ]]; then
    echo -e "${SUCCESS_COLOR}✓ Generated ${output} (${size}x${size})${NC}"
  else
    echo -e "${ERROR_COLOR}✗ Failed to generate ${output}${NC}"
  fi
done

# Generate Favicon (multi-sized ICO)
echo -e "${INFO_COLOR}Generating favicon.ico (multi-size)...${NC}"
rm -f favicon.ico  # Remove if exists

# Create temporary icon sizes for ICO
for size in "${SIZES_FAVICON_ICO[@]}"; do
  temp_icon="favicon-temp-${size}.png"
  convert "$SOURCE_IMAGE" -resize "${size}x${size}" -background none -gravity center -extent "${size}x${size}" "$temp_icon"
done

# Combine into ICO
convert "${SIZES_FAVICON_ICO[@]/#/favicon-temp-}.png" favicon.ico
if [[ $? -eq 0 ]]; then
  echo -e "${SUCCESS_COLOR}✓ Generated favicon.ico${NC}"
  
  # Clean up temp files
  for size in "${SIZES_FAVICON_ICO[@]}"; do
    rm -f "favicon-temp-${size}.png"
  done
else
  echo -e "${ERROR_COLOR}✗ Failed to generate favicon.ico${NC}"
fi

# Generate logo.png (if needed, e.g., 96x96 for legacy)
if [[ ! -f "logo.png" ]]; then
  convert "$SOURCE_IMAGE" -resize 96x96 -background none -gravity center -extent 96x96 logo.png
  echo -e "${SUCCESS_COLOR}✓ Generated logo.png (96x96)${NC}"
fi

# Generate maskable icons (for Android, rounded corners)
echo -e "${INFO_COLOR}Generating maskable icons...${NC}"
for size in 192 512; do
  maskable="app-icon-${size}-maskable.png"
  # Simple maskable: resize and ensure safe area (add padding if needed)
  convert "$SOURCE_IMAGE" \
    -resize "${size}x${size}" \
    -background none \
    -gravity center \
    -extent "${size}x${size}" \
    -bordercolor none \
    -border 8 \
    "$maskable"
  echo -e "${SUCCESS_COLOR}✓ Generated ${maskable} (${size}x${size} maskable)${NC}"
done

# Summary
PNG_COUNT=${#SIZES_PNG[@]}
APPLE_COUNT=${#SIZES_APPLE[@]}
TOTAL_ICONS=$((PNG_COUNT + APPLE_COUNT + 1 + 1 + 2))  # + favicon + logo + 2 maskable

echo -e "${SUCCESS_COLOR}🎉 Icon generation complete!${NC}"
echo "Generated $TOTAL_ICONS icons in $OUTPUT_DIR/"
echo "Files:"
ls -la *.png favicon.ico | grep -E "(app-icon|apple|logo|favicon)" || true
echo ""
echo "📝 Next steps:"
echo "1. Update manifest.json with new icon paths"
echo "2. Update HTML <link rel='apple-touch-icon' href='/assets/images/apple-touch-icon-180.png'>"
echo "3. Test PWA: Chrome DevTools > Application > Manifest"
echo "4. Validate: Use https://manifest-validator.appspot.com/ or Lighthouse"
