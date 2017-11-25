#!/bin/sh

# Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
# See LICENSE.md

distribution=`date +%Y%m%d_%H%M`

files="\
index.inc share.inc sse_projmon.inc index.html \
Raster-EN-1.1.pdf Raster-NL-1.1.pdf Raster-EN-1.1.epub Raster-NL-1.1.epub \
help/*.html \
img/*.png img/blue/*.png img/green/*.png img/grey/*.png img/none/*.png img/orange/*.png img/purple/*.png img/red/*.png img/yellow/*.png \
public_group/htaccess public_group/*.php public_group/SharedProjects/README.md \
css/*.css css/*/*.css css/*/images \
js/encodedecode.js js/eventsource.js js/jquery.localisation.js js/jquery.editinplace-2.2.1.js \
js/jquery-3.2.1.min.js js/jquery-ui-1.12.1.min.js js/jquery.jsPlumb-1.7.5.js \
js/rasterMain.js js/rasterComponent.js js/rasterNode.js js/rasterNodeCluster.js \
js/rasterPreferencesObject.js js/rasterProject.js js/rasterService.js js/rasterThreatEvaluation.js \
js/translation-nl.js \
ReleaseNotes.txt LICENSE.md README.md \
"

export COPY_EXTENDED_ATTRIBUTES_DISABLE=true
export COPYFILE_DISABLE=true

tar -c --exclude '._' -z -f Raster-$distribution.tar.gz $files