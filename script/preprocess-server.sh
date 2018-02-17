#!/bin/sh

. script/Versions.sh

PREPROCESS="filepp -pb"
#PREPROCESS="cpp -E -P -C -w"

BUILDDIR=build/server
echo "Building server version $RASTERVERSION into $BUILDDIR..."

if [ ! -d $BUILDDIR ]; then
	mkdir -p $BUILDDIR
fi

# Fixed sources
cp -R -p server/* $BUILDDIR
cp -R -p common/* $BUILDDIR
cp -R -p public_group $BUILDDIR
chmod a+rwX $BUILDDIR/public_group/SharedProjects

for srcfile in src/*.js
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

export COPY_EXTENDED_ATTRIBUTES_DISABLE=true
export COPYFILE_DISABLE=true

(
	cd build
	mv server server-v$RASTERNUMVERSION
	tar -c --exclude '._' --exclude='.DS_Store' -z -f server-v$RASTERNUMVERSION.tar.gz server-v$RASTERNUMVERSION
	mv server-v$RASTERNUMVERSION server
)

echo "...done"
