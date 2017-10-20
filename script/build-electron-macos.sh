#!/bin/sh

VERSION=1.7.9

CreateAppVersion()
{
	LANG=$1
	BUILDDIR=build/app-$LANG
	echo "************************** Building $LANG version for standalone into $BUILDDIR..."

	if [ ! -d $BUILDDIR ]; then
		mkdir -p $BUILDDIR
	fi

	# Fixed sources
	cp -p standalone/* $BUILDDIR
	cp -R -p common/* $BUILDDIR

	for srcfile in src/raster*.js
	do
		destfile=$BUILDDIR/js/`basename $srcfile`
		if [ $srcfile -nt $destfile ]; then
			cpp -E -P -C -w -DSTANDALONE $srcfile $destfile
			# Check whether the sources are correct, and correctly preprocessed
			script/lint/jsl -nologo -nosummary -conf script/lint/jsl.default.conf -process "$destfile" || exit 1
		fi
	done

#	for srcfile in src/standalone/*
#	do
#		destfile=$BUILDDIR/`basename $srcfile .html`-$LANG.html
#		if [ $srcfile -nt $destfile ]; then
#			cpp -E -P -C -w -DLANG=$LANG -DSTANDALONE $srcfile $destfile
#		fi
#	done

	cp -p src/standalone/e-translation-$LANG.js $BUILDDIR/e-translation.js

	if [ ! -d $BUILDDIR/app ]; then
		mkdir -p $BUILDDIR/app
	fi
	srcfile=src/index.inc
	destfile=$BUILDDIR/app/app.html
	if [ $srcfile -nt $destfile ]; then
		cpp -E -P -C -w -DLANG_$LANG -DSTANDALONE $srcfile $destfile
	fi


	echo "************************** ...done"
}

CreateMacOSVersion()
{
	LANG=$1
	BUILDDIR=build/app-$LANG
	BASEDIR=build/electron-v$VERSION-darwin-x64-$LANG
	APPDIR=$BASEDIR/Raster.app/Contents/Resources/app

	echo "************************** Building $LANG version for MacOS..."

	script/lint/jsl -nologo -nosummary -conf script/lint/jsl.default.conf -process standalone/main.js || exit 1

	if [ ! -d $BUILDDIR ]; then
		echo "Build directory $BUILDDIR does not exist." && exit 1
	fi

	if [ -d $BASEDIR ]
	then
		rm -fr $APPDIR
	else
		mkdir -p $BASEDIR
		( cd $BASEDIR && unzip ../../script/electron-v$VERSION-darwin-x64.zip )
		mv $BASEDIR/Electron.app $BASEDIR/Raster.app
		xattr -d com.apple.quarantine $BASEDIR/Raster.app
	fi

	mkdir $APPDIR
	mkdir $APPDIR/js
	mkdir $APPDIR/img
	mkdir $APPDIR/help
	mkdir $APPDIR/app

	cp -R -p $BUILDDIR/* $APPDIR
	cp -p standalone/* $APPDIR

	if [ script/iconset -nt script/electron.icns ]; then
		iconutil --convert icns --output script/electron.icns script/iconset
	fi
	cp script/electron.icns $APPDIR/../electron.icns
	# This is silly, but it works to force an icon refresh onto the Finder
	mkdir $BASEDIR/Raster.app/junk
	rmdir $BASEDIR/Raster.app/junk


	INFO=`pwd`/$BASEDIR/Raster.app/Contents/Info.plist
	defaults write $INFO "CFBundleDisplayName" "Raster"
	defaults write $INFO "CFBundleName" "Raster"
	defaults write $INFO "CFBundleExecutable" "Raster"
	defaults write $INFO "CFBundleShortVersionString" "2.0 beta"
	defaults write $INFO "CFBundleVersion" "October 2017"
	mv $BASEDIR/Raster.app/Contents/MacOS/Electron $BASEDIR/Raster.app/Contents/MacOS/Raster 2> /dev/null || true

	VOLDIR="/Volumes/Raster $LANG"

	cp script/base.$LANG.dmg build/temp.dmg
	# An image may have been mounted during debugging
	hdiutil detach -quiet "$VOLDIR" || true
	if [ -d "$VOLDIR" ]; then
		echo "Mount directory already in use."
		exit 1
	fi
	hdiutil attach build/temp.dmg
	cp -R -p $BASEDIR/Raster.app "$VOLDIR"
	sync && sync
	hdiutil detach "$VOLDIR"
	rm -f build/Raster.$LANG.dmg
	hdiutil convert build/temp.dmg -format UDRO -o build/Raster.$LANG.dmg
	rm -f build/temp.dmg

	echo "************************** ...done."
}

CreateWin32Version()
{
	LANG=$1
	BUILDDIR=build/app-$LANG
	BASEDIR=build/electron-v$VERSION-win32-ia32-$LANG
	APPDIR=$BASEDIR/resources/app

	echo "************************** Building $LANG version for Win32..."

	script/lint/jsl -nologo -nosummary -conf script/lint/jsl.default.conf -process standalone/main.js || exit 1

	if [ ! -d $BUILDDIR ]; then
		echo "Build directory $BUILDDIR does not exist." && exit 1
	fi

	if [ -d $BASEDIR ]
	then
		rm -fr $APPDIR
	else
		mkdir -p $BASEDIR
		( cd $BASEDIR && unzip ../../script/electron-v$VERSION-win32-ia32.zip )
		mv $BASEDIR/electron.exe $BASEDIR/raster.exe 
	fi

	mkdir $APPDIR
	mkdir $APPDIR/js
	mkdir $APPDIR/img
	mkdir $APPDIR/help
	mkdir $APPDIR/app

	cp -R -p $BUILDDIR/* $APPDIR
	cp -p standalone/* $APPDIR
	#mv $APPDIR/standalone.html $APPDIR/index.html

	echo "************************** ...done."
}

CreateAll()
{
	LANG=$1
	CreateAppVersion $LANG
	CreateMacOSVersion $LANG
	CreateWin32Version $LANG
}

CreateAll "EN"
CreateAll "NL"

