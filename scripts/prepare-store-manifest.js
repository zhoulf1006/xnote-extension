#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Production OAuth2 client_id (different from dev extension ID)
const PROD_CLIENT_ID = '1014810627971-r1t21etn1m5na323epv2oh3ontcp9nc4.apps.googleusercontent.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const distManifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');

try {
  // Check if dist/manifest.json exists
  if (!fs.existsSync(distManifestPath)) {
    console.error('✗ Error: dist/manifest.json not found. Please run "pnpm run build" first.');
    process.exit(1);
  }

  // Read the manifest.json from dist folder
  const manifestContent = fs.readFileSync(distManifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Remove the "key" field if it exists
  if (manifest.key) {
    delete manifest.key;
    console.log('✓ Removed "key" field from manifest.json');
  } else {
    console.log('ℹ No "key" field found in manifest.json');
  }

  // Update OAuth2 client_id for production
  if (manifest.oauth2 && manifest.oauth2.client_id) {
    const devClientId = manifest.oauth2.client_id;
    manifest.oauth2.client_id = PROD_CLIENT_ID;
    console.log('✓ Updated OAuth2 client_id for production');
    console.log(`  Dev: ${devClientId}`);
    console.log(`  Prod: ${PROD_CLIENT_ID}`);
  }

  // Write the modified manifest back (pretty printed with 2 spaces)
  fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('✓ Updated dist/manifest.json for Chrome Web Store submission');
} catch (error) {
  console.error('✗ Error processing manifest.json:', error.message);
  process.exit(1);
}