#!/bin/sh -e

. script/Versions.sh

PREPROCESS="filepp -pb"
#PREPROCESS="cpp -E -P -C -w"

# Set $ESLINT to blank to skip the verification.
ESLINT="/usr/local/bin/eslint"
#ESLINT=""

WINE="/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine"
#WINE=""

# Use RLANG iso LANG, because setting LANG interferes with Perl's locale settings.

CreateAppVersion()
{
	RLANG=$1
	BUILDDIR=build/app-$RLANG
	echo "************************** Building $RLANG version for standalone into $BUILDDIR..."

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
			$PREPROCESS -DLANG_$RLANG -DSTANDALONE $srcfile > $destfile
			if [ -n "$ESLINT" ]; then
				# Check whether the sources are correct, and correctly preprocessed
				$ESLINT --config script/eslintrc --format script/eslint-xcode-format.js "$destfile" || { rm "$destfile";exit 1; }
			fi
		fi
	done

#	for srcfile in src/standalone/*
#	do
#		destfile=$BUILDDIR/`basename $srcfile .html`-$RLANG.html
#		if [ $srcfile -nt $destfile ]; then
#			$PREPROCESS -DLANG=$RLANG -DSTANDALONE $srcfile > $destfile
#		fi
#	done

	cp -p src/standalone/e-translation-$RLANG.js $BUILDDIR/e-translation.js

	if [ ! -d $BUILDDIR/app ]; then
		mkdir -p $BUILDDIR/app
	fi
	srcfile=src/index.inc
	destfile=$BUILDDIR/app/app.html
	if [ $srcfile -nt $destfile ]; then
		$PREPROCESS -DLANG_$RLANG -DSTANDALONE $srcfile > $destfile
	fi


	echo "************************** ...done"
}

CreateMacOSVersion()
{
	RLANG=$1
	BUILDDIR=build/app-$RLANG
	BASEDIR=build/electron-v$ELECTRONVERSION-darwin-x64-$RLANG
	APPDIR=$BASEDIR/Raster.app/Contents/Resources/app

	echo "************************** Building $RLANG version for MacOS..."

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
		xattr -d com.apple.quarantine $BASEDIR/Raster.app || true
	fi

echo creating dirs
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

	VOLDIR="/Volumes/Raster $RLANG"

	cp script/base.$RLANG.dmg build/temp.dmg
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
	rm -f build/Raster-v$RASTERNUMVERSION.$RLANG.dmg
	hdiutil convert build/temp.dmg -format UDRO -o build/Raster-v$RASTERNUMVERSION.$RLANG.dmg
	rm -f build/temp.dmg

	echo "************************** ...done."
}

CreateWin32Version()
{
	RLANG=$1
	BUILDDIR=build/app-$RLANG
	BASEDIR=build/electron-v$ELECTRONVERSION-win32-ia32-$RLANG
	APPDIR=$BASEDIR/resources/app

	echo "************************** Building $RLANG version for Win32..."

	if [ ! -x "$WINE" ]; then
		cat >cache/versions-$RLANG.bat <<-EOT
			set basedir=$BASEDIR
			set builddir=$BUILDDIR
			set appdir=$APPDIR
			set electronversion=$ELECTRONVERSION
			set rasternumversion=$RASTERNUMVERSION
			set rasterversion=$RASTERVERSION
			set rasterseason=$RASTERSEASON
			set lang=$RLANG
			EOT
	fi

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
		if [ -x "$WINE" ]; then
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
			  --set-icon $BASEDIR/resources/icon.ico
			 )
		fi
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

	if [ -x "$WINE" ]; then
		(
		 cd $BASEDIR
		 "$WINE" ../../cache/nsis/makensis.exe /nocd ../../script/Raster.$RLANG.nsis
		)

		(
		 cd build
		 ln -s electron-v$ELECTRONVERSION-win32-ia32-$RLANG Raster

		 rm -f raster-win32-v$RASTERNUMVERSION-$RLANG.zip
		 zip -r raster-win32-v$RASTERNUMVERSION-$RLANG.zip Raster

		 rm -f raster-v$RASTERNUMVERSION-$RLANG-unpack.exe
		 # Filenames containing "instal" require admin privileges!?
		 "$WINE" ../cache/7z/7z.exe a -sfx7z.sfx raster-v$RASTERNUMVERSION-$RLANG-unpack.exe Raster
		 "$WINE" ../script/rcedit-x86.exe raster-v$RASTERNUMVERSION-$RLANG-unpack.exe --set-icon ../script/installraster.ico

		 rm Raster
		)
	fi

	echo "************************** ...done."
}

CreateAll()
{
	RLANG=$1
	CreateAppVersion $RLANG
	CreateMacOSVersion $RLANG
	CreateWin32Version $RLANG
	rm -fr $BUILDDIR
}

CreateAll "EN"
CreateAll "NL"

if [ ! -x "$WINE" ]; then
	# If Parallels Desktop is running, then the following may trigger it to run the winbuild.bat batch file.
	open -a 'Parallels Desktop' script/winbuild.bat
fi

