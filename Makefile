.PHONY: pack

pack:
	@echo "Building and packaging chrome extension..."
	pnpm run build
	@timestamp=$$(date +%Y%m%d%H%M); \
	zip -r pack/xnote_extension_$$timestamp.zip dist
