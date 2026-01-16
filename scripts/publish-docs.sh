#!/bin/bash

# Publish XNote Extension docs to aloong-docs repository
# This script copies documentation to the Docusaurus site

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_REPO="git@github.com:aloong-planet/aloong-docs.git"
TEMP_DIR="/tmp/aloong-docs-publish"
TARGET_DIR="docs/chrome-extensions/xnote"

echo "Publishing XNote Extension docs to aloong-docs..."

# Clean up temp directory if it exists
if [ -d "$TEMP_DIR" ]; then
    echo "Cleaning up existing temp directory..."
    rm -rf "$TEMP_DIR"
fi

# Clone the docs repository
echo "Cloning aloong-docs repository..."
git clone --depth 1 "$DOCS_REPO" "$TEMP_DIR"

# Create target directory structure
echo "Creating directory structure..."
mkdir -p "$TEMP_DIR/$TARGET_DIR"

# Create chrome-extensions category file if it doesn't exist
CHROME_EXT_CATEGORY="$TEMP_DIR/docs/chrome-extensions/_category_.json"
if [ ! -f "$CHROME_EXT_CATEGORY" ]; then
    echo "Creating chrome-extensions category..."
    mkdir -p "$TEMP_DIR/docs/chrome-extensions"
    cat > "$CHROME_EXT_CATEGORY" << 'EOF'
{
  "label": "Chrome Extensions",
  "position": 10,
  "link": {
    "type": "generated-index",
    "description": "Documentation for Chrome extensions developed by the team."
  }
}
EOF
fi

# Create xnote category file
echo "Creating xnote category..."
cat > "$TEMP_DIR/$TARGET_DIR/_category_.json" << 'EOF'
{
  "label": "XNote Extension",
  "position": 1,
  "link": {
    "type": "generated-index",
    "description": "XNote Extension - AI-powered note-taking and productivity Chrome extension."
  }
}
EOF

# Copy intro.md
echo "Copying intro.md..."
cp "$PROJECT_ROOT/docs/intro.md" "$TEMP_DIR/$TARGET_DIR/intro.md"

# Copy and transform PRIVACY_POLICY.md
echo "Copying privacy policy..."
cat > "$TEMP_DIR/$TARGET_DIR/privacy-policy.md" << 'FRONTMATTER'
---
sidebar_position: 2
title: Privacy Policy
description: Privacy Policy for XNote Extension
---

FRONTMATTER

# Append the original content (skip the first line which is the title)
tail -n +1 "$PROJECT_ROOT/PRIVACY_POLICY.md" >> "$TEMP_DIR/$TARGET_DIR/privacy-policy.md"

# Commit and push
echo "Committing changes..."
cd "$TEMP_DIR"
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "No changes to commit."
else
    git commit -m "docs: Update XNote Extension documentation

- Update extension introduction
- Update privacy policy"

    echo "Pushing to remote..."
    git push origin main

    echo "Documentation published successfully!"
fi

# Cleanup
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "Done! Documentation will be available at:"
echo "  - https://aloong-planet.github.io/aloong-docs/docs/chrome-extensions/xnote/intro"
echo "  - https://aloong-planet.github.io/aloong-docs/docs/chrome-extensions/xnote/privacy-policy"
echo ""
echo "Note: It may take a few minutes for GitHub Pages to rebuild."
