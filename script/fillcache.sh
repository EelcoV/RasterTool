#!/bin/sh

echo "** Creating caches... "
. script/Versions.sh

if [ ! -d cache ]; then
	mkdir -p cache
fi

cd cache
if [ ! -f electron-v$ELECTRONVERSION-darwin-x64.zip ]; then
	curl -s -S -O -L https://github.com/electron/electron/releases/download/v$ELECTRONVERSION/electron-v$ELECTRONVERSION-darwin-x64.zip &
fi

if [ ! -f electron-v$ELECTRONVERSION-darwin-arm64.zip ]; then
	curl -s -S -O -L https://github.com/electron/electron/releases/download/v$ELECTRONVERSION/electron-v$ELECTRONVERSION-darwin-arm64.zip &
fi

if [ ! -f electron-v$ELECTRONVERSION-win32-ia32.zip ]; then
	curl -s -S -O -L https://github.com/electron/electron/releases/download/v$ELECTRONVERSION/electron-v$ELECTRONVERSION-win32-ia32.zip &
fi

if [ ! -f electron-v$ELECTRONVERSION-win32-x64.zip ]; then
	curl -s -S -O -L https://github.com/electron/electron/releases/download/v$ELECTRONVERSION/electron-v$ELECTRONVERSION-win32-x64.zip &
fi

if [ ! -d nsis ]; then
	unzip -q ../script/nsis.zip &
fi

if [ ! -d 7z ]; then
	unzip -q ../script/7z.zip &
fi

if [ script/electron.iconset -nt cache/raster.icns ]; then
	iconutil --convert icns --output cache/raster.icns script/electron.iconset &
fi

wait

echo "** ...done."
