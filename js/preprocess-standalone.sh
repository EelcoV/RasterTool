#!/bin/sh

for f in raw/raster*.js
do
	cpp -E -P -C -w -DSTANDALONE $f ../standalone/`basename ${f}`
done

# Check whether the sources are correct, and correctly preprocessed
for f in ../standalone/raster*.js translation*.js
do
	lint/jsl -nologo -nosummary -conf lint/jsl.default.conf -process "$f" || exit 1
done

