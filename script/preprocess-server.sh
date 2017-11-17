#!/bin/sh

. script/Versions.sh

PREPROCESS="filepp -pb"
#PREPROCESS="cpp -E -P -C -w"

BUILDDIR=build/server
echo "Building server version $BUILDDIR..."

if [ ! -d $BUILDDIR ]; then
	mkdir -p $BUILDDIR
fi

# Fixed sources
cp -R -p server/* $BUILDDIR
cp -R -p common/* $BUILDDIR
cp -R -p public_group $BUILDDIR

for srcfile in src/raster*.js
do
	destfile=$BUILDDIR/js/`basename $srcfile`
	if [ $srcfile -nt $destfile ]; then
		$PREPROCESS -DSERVER $srcfile > $destfile
		# Check whether the sources are correct, and correctly preprocessed
		script/lint/jsl -nologo -nosummary -conf script/lint/jsl.default.conf -process "$destfile" || exit 1
	fi
done

srcfile=src/index.inc
destfile=$BUILDDIR/index.inc
if [ $srcfile -nt $destfile ]; then
	$PREPROCESS -DSERVER $srcfile > $destfile
fi

chmod -R a+rX $BUILDDIR

echo "...done"
