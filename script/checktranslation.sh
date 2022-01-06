#!/bin/sh

CheckLanguage()
{
	CHECKLANG_U=$1
	CHECKLANG_L=$2

	perl -ne 'print "$1\n" while (/_\("([^"]*)"/g)' src/raster*.js | sort | uniq > build/server-translations-needed.txt
	perl script/create-translations.pl build/server-translations-needed.txt src/translation-$CHECKLANG_L.js > build/server-suggestions.js

	perl -ne 'print "$1\n" while (/_\("([^"]*)"/g)' standalone/main.js | sort | uniq > build/standalone-translations-needed.txt
	perl script/create-translations.pl build/standalone-translations-needed.txt src/standalone/e-translation-$CHECKLANG_U.js > build/standalone-suggestions.js

	rm build/server-translations-needed.txt build/standalone-translations-needed.txt
}


CheckLanguage "NL" "nl"
