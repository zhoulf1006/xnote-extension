# Chrome Extension ID Management

## Current Stable Extension ID
```
gdigjgodfajnnbkhidjfnkcnhpbjkecd
```

## Why the Extension ID is Now Stable

The extension ID is generated from the public key in `manifest.json`. With the proper RSA public key now in place, your extension will maintain this ID across:
- Extension reloads
- Chrome restarts
- Different development machines (as long as they use the same manifest.json)

## How It Works

1. **Public Key**: The base64-encoded RSA public key in `manifest.json` determines the extension ID
2. **ID Generation**: Chrome generates the ID by hashing the public key
3. **Stability**: As long as the key remains the same, the ID remains the same

## Important Files

- **Public Key**: In `manifest.json` (the `key` field)
- **Private Key**: `.keys/extension.pem` (KEEP SECRET - used for signing packaged extensions)
- **Extension ID**: `.keys/extension-id.txt` (for reference)

## Google Cloud Console Configuration

You need to update your OAuth2 client configuration in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID (the one ending in `.apps.googleusercontent.com`)
4. Edit the client
5. In "Authorized JavaScript origins" or "Application ID", update to:
   ```
   chrome-extension://gdigjgodfajnnbkhidjfnkcnhpbjkecd
   ```
6. Save the changes

## Troubleshooting

If the extension ID changes unexpectedly:
1. Check that the `key` field in `manifest.json` hasn't been modified
2. Ensure you're loading the extension from the `dist/` folder after building
3. Make sure you're not using "Pack Extension" in Chrome (which generates a new key)

## Regenerating Keys (If Needed)

If you ever need to generate a new key pair:
```bash
node scripts/generate-extension-key.js
```

This will create new keys and show you the new extension ID.

## Security Note

- **Never commit the private key** (`.keys/extension.pem`) to version control
- The `.keys/` directory is already in `.gitignore`
- The public key in `manifest.json` is safe to commit