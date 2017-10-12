#!/bin/sh


for f in raster*.js translation*.js
do
	lint/jsl -nologo -nosummary -conf lint/jsl.default.conf -process "$f" || exit 1
done
