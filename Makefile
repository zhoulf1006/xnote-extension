.PHONY: pack

pack:
	@echo "Building and packaging chrome extension..."
	pnpm run build
	@echo "Preparing manifest for Chrome Web Store..."
	@node scripts/prepare-store-manifest.js
	@timestamp=$$(date +%Y%m%d%H%M); \
	zip -r pack/xnote_extension_$$timestamp.zip dist; \
	echo "✓ Created pack/xnote_extension_$$timestamp.zip (Chrome Web Store ready)"
	@echo "Restoring development manifest..."
	@cp manifest.json dist/manifest.json
	@echo "✓ Restored dist/manifest.json with 'key' field for local development"


dev-pack:
	@echo "Building and packaging chrome extension..."
	pnpm run build
	@timestamp=$$(date +%Y%m%d%H%M); \
	zip -r pack/xnote_extension_dev_$$timestamp.zip dist; \
	echo "✓ Created pack/xnote_extension_dev_$$timestamp.zip (Chrome Web Store ready)"
