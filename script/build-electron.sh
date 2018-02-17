#!/bin/sh

. script/Versions.sh

PREPROCESS="filepp -pb"
#PREPROCESS="cpp -E -P -C -w"

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
			$PREPROCESS -DSTANDALONE $srcfile > $destfile
			# Check whether the sources are correct, and correctly preprocessed
			script/lint/jsl -nologo -nosummary -conf script/lint/jsl.default.conf -process "$destfile" || exit 1
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

	script/lint/jsl -nologo -nosummary -conf script/lint/jsl.default.conf -process standalone/main.js || exit 1

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

	if [ script/electron.iconset -nt build/raster.icns ]; then
		iconutil --convert icns --output build/raster.icns script/electron.iconset
	fi
	rm -f $APPDIR/../electron.icns
	cp build/raster.icns $APPDIR/../raster.icns
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

	WINE="/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine"
	#WINE=""

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
		( cd $BASEDIR && unzip ../../cache/electron-v$ELECTRONVERSION-win32-ia32.zip )
		mv $BASEDIR/electron.exe $BASEDIR/raster.exe
		cp script/raster.ico $BASEDIR
		# At this stage, it would be cool to convert the icon PNGs into an ICO file
		(
		 "$WINE" script/rcedit-x86.exe $BASEDIR/raster.exe \
		  --set-version-string CompanyName "The Raster Method" \
		  --set-version-string FileDescription Raster \
		  --set-file-version $RASTERNUMVERSION \
		  --set-version-string InternalName Raster \
		  --set-version-string OriginalFilename raster.exe \
		  --set-version-string ProductName Raster \
		  --set-version-string LegalCopyright "Copyright reserved" \
		  --set-product-version "$RASTERVERSION ($RASTERSEASON)" \
		  --set-icon $BASEDIR/raster.ico
		 )
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

	(
	 cd $BASEDIR
	 "$WINE" ../../cache/nsis/makensis.exe /nocd ../../script/Raster.$LANG.nsis
	)

	(
	 cd build
	 ln -s electron-v$ELECTRONVERSION-win32-ia32-$LANG Raster

	 rm -f raster-win32-v$RASTERNUMVERSION-$LANG.zip
	 zip -r raster-win32-v$RASTERNUMVERSION-$LANG.zip Raster

	 rm -f raster-v$RASTERNUMVERSION-$LANG-unpack.exe
	 # Filenames containing "instal" require admin privileges!?
	 "$WINE" ../cache/7z/7z.exe a -sfx7z.sfx raster-v$RASTERNUMVERSION-$LANG-unpack.exe Raster
	 "$WINE" ../script/rcedit-x86.exe raster-v$RASTERNUMVERSION-$LANG-unpack.exe --set-icon ../script/installraster.ico

	 rm Raster
	)

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

