.PHONY: pack

pack:
	@echo "Building and packaging chrome extension..."
	pnpm run build
	@echo "Preparing manifest for Chrome Web Store..."
	@node scripts/prepare-store-manifest.js
	@timestamp=$$(date +%Y%m%d%H%M); \
	(cd dist && zip -qr ../pack/xnote_extension_$$timestamp.zip . -x '.DS_Store' '*/.DS_Store'); \
	echo "✓ Created pack/xnote_extension_$$timestamp.zip (Chrome Web Store ready)"
	@echo "Restoring development manifest..."
	@cp manifest.json dist/manifest.json
	@node scripts/apply-dev-manifest.js
	@echo "✓ Restored dist/manifest.json with 'key' field and dev marker for local development"


dev-pack:
	@echo "Building and packaging chrome extension..."
	pnpm run build
	@timestamp=$$(date +%Y%m%d%H%M); \
	zip -r pack/xnote_extension_dev_$$timestamp.zip dist; \
	echo "✓ Created pack/xnote_extension_dev_$$timestamp.zip (Chrome Web Store ready)"
