#!/bin/sh


for f in raster*.js
do
	lint/jsl -nologo -nosummary -conf lint/jsl.default.conf -process "$f"
done
