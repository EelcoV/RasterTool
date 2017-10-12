#!/bin/sh

VERSION=1.7.9
LANG=EN

if [ -d electron-v$VERSION-darwin-x64-EN ]
then
	rm -fr electron-v$VERSION-darwin-x64-EN/Electron.app/Contents/Resources/app
else
	mkdir electron-v$VERSION-darwin-x64-EN
	cd electron-v$VERSION-darwin-x64-EN
	unzip ../electron-v$VERSION-darwin-x64.zip
	cd ..
fi

DESTDIR=electron-v$VERSION-darwin-x64-EN/Electron.app/Contents/Resources/app

mkdir $DESTDIR
mkdir $DESTDIR/js
mkdir $DESTDIR/img
mkdir $DESTDIR/help
mkdir $DESTDIR/standalone

cp js/*.js $DESTDIR/js
cp -R css $DESTDIR
cp -R img $DESTDIR
cp -R help $DESTDIR
cp -R standalone $DESTDIR

cp standalone-en.html $DESTDIR/index.html
cp standalone/package.json standalone/main.js $DESTDIR


if [ -d electron-v$VERSION-darwin-x64-NL ]
then
	rm -fr electron-v$VERSION-darwin-x64-NL/Electron.app/Contents/Resources/app
else
	mkdir electron-v$VERSION-darwin-x64-NL
	cd electron-v$VERSION-darwin-x64-NL
	unzip ../electron-v$VERSION-darwin-x64.zip
	cd ..
fi

DESTDIR=electron-v$VERSION-darwin-x64-NL/Electron.app/Contents/Resources/app

mkdir $DESTDIR
mkdir $DESTDIR/js
mkdir $DESTDIR/img
mkdir $DESTDIR/help
mkdir $DESTDIR/standalone

cp js/*.js $DESTDIR/js
cp -R css $DESTDIR
cp -R img $DESTDIR
cp -R help $DESTDIR
cp -R standalone $DESTDIR

cp standalone-nl.html $DESTDIR/index.html
cp standalone/package.json standalone/main.js $DESTDIR
