#!/usr/bin/perl
#
# Usage: create-translations.pl «translationsneeded» «currenttranslations»

if ($#ARGV != 1) {
	print STDERR "Usage: $#ARGV\n";
	print STDERR "Usage: create-translations.pl «translationsneeded» «currenttranslations»\n";
	exit;
}

$needed = shift;
$provided = shift;


%trans = ();
open(PROVIDED,$provided) || die "Cannot read $provided";
while (<PROVIDED>) {
	$trans{$1} = $2 if (/^_t\["([^"]*)"\]\s*=\s*"(.*)";/);
}

open(NEEDED,$needed) || die "Cannot read $needed";
while ($str = <NEEDED>) {
	chomp $str;
	$tr = $trans{$str};
	if ($tr) {
		print "_t[\"$str\"] = \"$tr\";\n";
	} else {
		print "_t[\"$str\"] = \"$str\";\t//TRANSLATION NEEDED\n";
	}
}
