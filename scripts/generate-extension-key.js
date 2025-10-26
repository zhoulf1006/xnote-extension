#!/usr/bin/env node

/**
 * Generate a stable extension key for Chrome Extension
 * This ensures the extension ID remains constant across reloads
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate a new RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'der'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert public key to base64 (Chrome extension format)
const publicKeyBase64 = publicKey.toString('base64');

// Calculate the extension ID from the public key
const hash = crypto.createHash('sha256');
hash.update(publicKey);
const extensionId = hash.digest('hex').substring(0, 32);

// Convert hex to Chrome extension ID format (a-p characters)
const chromeExtensionId = extensionId.split('').map(char => {
  const code = parseInt(char, 16);
  return String.fromCharCode(97 + code); // 'a' = 97 in ASCII
}).join('');

console.log('🔑 Extension Key Generation Results:');
console.log('=====================================\n');
console.log('Public Key (add this to manifest.json):');
console.log('----------------------------------------');
console.log(publicKeyBase64);
console.log('\nExtension ID (stable):');
console.log('----------------------');
console.log(chromeExtensionId);
console.log('\nPrivate Key (keep this secret, save for signing):');
console.log('--------------------------------------------------');
console.log(privateKey);

// Save keys to files
const keysDir = path.join(__dirname, '..', '.keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

fs.writeFileSync(path.join(keysDir, 'extension.pub'), publicKeyBase64);
fs.writeFileSync(path.join(keysDir, 'extension.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'extension-id.txt'), chromeExtensionId);

console.log('\n✅ Keys saved to .keys/ directory');
console.log('\n📝 Next steps:');
console.log('1. Copy the public key above');
console.log('2. Replace the "key" field in manifest.json with this public key');
console.log('3. Reload the extension - the ID will now be stable');
console.log('\n⚠️  Important: Add .keys/ to .gitignore to keep your private key secure');