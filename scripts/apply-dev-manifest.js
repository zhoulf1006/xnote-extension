#!/usr/bin/env node

// Marks the dist/ build as a dev build so it is distinguishable from the
// Chrome Web Store version: appends " (Dev)" to the extension name and swaps
// in the orange icon set. prepare-store-manifest.js reverses both for store
// packaging. Runs standalone (Makefile) or via import (build.js).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distManifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
const devIconsDir = path.join(__dirname, '..', 'public', 'icons-dev');
const distIconsDir = path.join(__dirname, '..', 'dist', 'icons');

const manifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));

if (!manifest.name.endsWith(' (Dev)')) {
  manifest.name = `${manifest.name} (Dev)`;
}
fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2) + '\n');

fs.cpSync(devIconsDir, distIconsDir, { recursive: true });

console.log(`✓ Dev build marked: name="${manifest.name}", orange icon set applied`);
