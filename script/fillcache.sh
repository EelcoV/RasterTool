#!/bin/sh

. script/Versions.sh

cd cache
if [ ! -f electron-v$ELECTRONVERSION-darwin-x64.zip ]; then
	curl -O -L https://github.com/electron/electron/releases/download/v$ELECTRONVERSION/electron-v$ELECTRONVERSION-darwin-x64.zip
fi

if [ ! -f electron-v$ELECTRONVERSION-win32-ia32.zip ]; then
	curl -O -L https://github.com/electron/electron/releases/download/v$ELECTRONVERSION/electron-v$ELECTRONVERSION-win32-ia32.zip
fi

if [ ! -d nsis ]; then
	unzip ../script/nsis.zip
fi

if [ ! -d 7z ]; then
	unzip ../script/7z.zip
fi

