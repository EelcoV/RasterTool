#!/bin/sh

BUILDDIR=build/server

if [ ! -d $BUILDDIR ]; then
	mkdir -p $BUILDDIR
fi

CHECKLANG_U="NL"
CHECKLANG_L="nl"

SRCFILES="src/raster*.js standalone/main.js"
TRANSFILES="src/translation-$CHECKLANG_L.js src/standalone/e-translation-$CHECKLANG_U.js"

perl -ne 'print "_t[\"$1\"]\n" while (/_\("([^"]*)"/g)' $SRCFILES | sort | uniq > $BUILDDIR/translations-used.txt

# See  https://stackoverflow.com/questions/1250079/how-to-escape-single-quotes-within-single-quoted-strings
perl -ne 'print "_t[\"$1\"]\n" if (/^_t\["([^"]*)"\]/);print "_t[\"$1\"]\n" if (/^_t\['"'"'([^'"'"']*)'"'"'\]/)' $TRANSFILES | sort | uniq > $BUILDDIR/translations-provided.txt

echo Checking translations...
diff $BUILDDIR/translations-used.txt $BUILDDIR/translations-provided.txt
rm $BUILDDIR/translations-used.txt $BUILDDIR/translations-provided.txt
