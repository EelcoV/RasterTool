#!/bin/sh

CreateLanguageVersion()
{
	LANG=$1
	BUILDDIR=build/standalone/$LANG
	echo "Building $LANG version for standalone into $BUILDDIR..."

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


	echo "...done"
}


CreateLanguageVersion "EN"
CreateLanguageVersion "NL"

