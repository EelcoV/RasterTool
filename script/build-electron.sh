#!/bin/sh

. script/Versions.sh

PREPROCESS="filepp -pb"
#PREPROCESS="cpp -E -P -C -w"

# Set $ESLINT to blank to skip the verification.
ESLINT="/usr/local/bin/eslint"
#ESLINT=""

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

	echo "{\"name\":\"Raster\",\"version\":\"$RASTERVERSION ($RASTERSEASON)\",\"main\":\"main.js\"}" >$BUILDDIR/package.json

	for srcfile in src/*.js
	do
		destfile=$BUILDDIR/js/`basename $srcfile`
		if [ $srcfile -nt $destfile ]; then
			$PREPROCESS -DLANG_$LANG -DSTANDALONE $srcfile > $destfile
			if [ -n "$ESLINT" ]; then
				# Check whether the sources are correct, and correctly preprocessed
				$ESLINT --config script/eslintrc --format script/eslint-xcode-format.js "$destfile" || { rm "$destfile";exit 1; }
			fi
		fi
	done

#	for srcfile in src/standalone/*
#	do
#		destfile=$BUILDDIR/`basename $srcfile .html`-$LANG.html
#		if [ $srcfile -nt $destfile ]; then
#			$PREPROCESS -DLANG=$LANG -DSTANDALONE $srcfile > $destfile
#		fi
#	done

	cp -p src/standalone/e-translation-$LANG.js $BUILDDIR/e-translation.js

	if [ ! -d $BUILDDIR/app ]; then
		mkdir -p $BUILDDIR/app
	fi
	srcfile=src/index.inc
	destfile=$BUILDDIR/app/app.html
	if [ $srcfile -nt $destfile ]; then
		$PREPROCESS -DLANG_$LANG -DSTANDALONE $srcfile > $destfile
	fi


	echo "************************** ...done"
}

CreateMacOSVersion()
{
	LANG=$1
	BUILDDIR=build/app-$LANG
	BASEDIR=build/electron-v$ELECTRONVERSION-darwin-x64-$LANG
	APPDIR=$BASEDIR/Raster.app/Contents/Resources/app

	echo "************************** Building $LANG version for MacOS..."

	if [ -n "$ESLINT" ]; then
		$ESLINT --config script/eslintrc --format script/eslint-xcode-format.js standalone/main.js || exit 1
	fi

	if [ ! -d $BUILDDIR ]; then
		echo "Build directory $BUILDDIR does not exist." && exit 1
	fi

	if [ -d $BASEDIR ]
	then
		rm -fr $APPDIR
	else
		mkdir -p $BASEDIR
		( cd $BASEDIR && unzip ../../cache/electron-v$ELECTRONVERSION-darwin-x64.zip )
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

	if [ script/electron.iconset -nt cache/raster.icns ]; then
		iconutil --convert icns --output cache/raster.icns script/electron.iconset
	fi
	rm -f $APPDIR/../electron.icns
	cp cache/raster.icns $APPDIR/../raster.icns
	# This is silly, but it works to force an icon refresh onto the Finder
	mkdir $BASEDIR/Raster.app/junk
	rmdir $BASEDIR/Raster.app/junk


	INFO=`pwd`/$BASEDIR/Raster.app/Contents/Info.plist
	defaults write $INFO "CFBundleDisplayName" "Raster"
	defaults write $INFO "CFBundleName" "Raster"
	defaults write $INFO "CFBundleExecutable" "Raster"
	defaults write $INFO "CFBundleShortVersionString" "$RASTERVERSION"
	defaults write $INFO "CFBundleVersion" "$RASTERSEASON"
	defaults write $INFO "CFBundleIconFile" "raster.icns"
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
	rm -fr "$VOLDIR/Raster.app"
	cp -R -p $BASEDIR/Raster.app "$VOLDIR"
	sync && sync
	hdiutil detach "$VOLDIR"
	rm -f build/Raster-v$RASTERNUMVERSION.$LANG.dmg
	hdiutil convert build/temp.dmg -format UDRO -o build/Raster-v$RASTERNUMVERSION.$LANG.dmg
	rm -f build/temp.dmg

	echo "************************** ...done."
}

CreateWin32Version()
{
	LANG=$1
	BUILDDIR=build/app-$LANG
	BASEDIR=build/electron-v$ELECTRONVERSION-win32-ia32-$LANG
	APPDIR=$BASEDIR/resources/app

	cat >cache/versions-$LANG.bat <<-EOT
		set basedir=$BASEDIR
		set builddir=$BUILDDIR
		set appdir=$APPDIR
		set electronversion=$ELECTRONVERSION
		set rasternumversion=$RASTERNUMVERSION
		set rasterversion=$RASTERVERSION
		set rasterseason=$RASTERSEASON
		set lang=$LANG
		EOT

	echo "************************** Building $LANG version for Win32..."

	if [ -n "$ESLINT" ]; then
		$ESLINT --config script/eslintrc --format script/eslint-xcode-format.js standalone/main.js || exit 1
	fi

	if [ ! -d $BUILDDIR ]; then
		echo "Build directory $BUILDDIR does not exist." && exit 1
	fi

	if [ -d $BASEDIR ]
	then
		rm -fr $APPDIR
	else
		mkdir -p $BASEDIR
		( cd $BASEDIR && unzip ../../cache/electron-v$ELECTRONVERSION-win32-ia32.zip )
		mv $BASEDIR/electron.exe $BASEDIR/raster.exe
		# At this stage, it would be cool to convert the icon PNGs into an ICO file
		cp script/raster.ico $BASEDIR/resources/icon.ico
	fi

	mkdir $APPDIR
	mkdir $APPDIR/js
	mkdir $APPDIR/img
	mkdir $APPDIR/help
	mkdir $APPDIR/app

	cp -R -p $BUILDDIR/* $APPDIR
	cp -p standalone/* $APPDIR
	#mv $APPDIR/standalone.html $APPDIR/index.html

	find "$BASEDIR" -name .DS_Store -delete

	echo "************************** ...done."
}

CreateAll()
{
	LANG=$1
	CreateAppVersion $LANG
	CreateMacOSVersion $LANG
	CreateWin32Version $LANG
	rm -fr $BUILDDIR
}

CreateAll "EN"
CreateAll "NL"

