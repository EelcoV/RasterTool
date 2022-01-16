<?php
/*
Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md
*/

/* 
 *
 * A client can use this URL for Server-Sent Events.
 * https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events
 *
 * The client calls this script with one parameter 'name', the title of the project to watch.
 * The messages sent from the server to the client are single lines:
 * - NO PROJECT: the project to watch does not exists (yet).
 * - NOP: sent periodically, to monitor connectivity to the client.
 * - UPDATED: when the project to watch has been changed.
 * - DELETED: the project disappeared. Some client deleted it.
 *
 * After sending an event the script will end. Each event specifies a retry parameter, so the
 * browser will reopen a connection to the server. The lifetime of this script is therefore
 * limited to the NOPINTERVAL, and will be shorter if a file event occurs.
 */

define("RASTERDIR", "SharedProjects/");	// Prefix for location of shared Raster files
define("INDEXFILE", RASTERDIR . "projectindex.csv");	// Location of Index file
define("DEBUGINFO", false);		// Show extra info when errors are reported
define("NOPINTERVAL", 30);	// Interval between successive NOPs (in *seconds*)
define("IDLETIME", 200000);	// Interval between checks for file changes (in *microseconds*)

define("NOPROJECT", "NO PROJECT");
define("UPDATED", "UPDATED");
define("DELETED", "DELETED");
define("NOP", "NOP");

// Globals
$projName = "";
$projCreator = "";
$projDate = "";
$projDescr = "";
$projFname = "";

set_time_limit(0);  // No limit on execution time. Lifetime is limited to NOPINTERVAL

header('X-Accel-Buffering: no');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache'); // recommended to prevent caching of event data.

$name = $_REQUEST['name'];
$indexmtime = filemtime(INDEXFILE);
lookupDetails($name);
if ($projFname == "") {
	send(NOPROJECT);
	exit(0);
}

// We know the file name. Find its modification time
$filemtime = filemtime(RASTERDIR . $projFname);
if (DEBUGINFO) error_log("starting watch for file $projFname, project $projName");

$noptime = time();

while (true) {
    usleep(IDLETIME);
    // Send NOP, if necessary.
    if (time()-$noptime > NOPINTERVAL) {
    	send(NOP); // will exit the script
    }
    // Check whether the index file was updated, and update project details
    clearstatcache(); // Because mtimes are cached by PHP
    $curtime = filemtime(INDEXFILE);
    if ($curtime != $indexmtime) {
    	lookupDetails($name);
    	if ($projFname=="") {
    		send(DELETED);
    	}
		$indexmtime = $curtime;
    }
    // Check current mtime of the file
    $curtime = filemtime(RASTERDIR . $projFname);
    if ($curtime == $filemtime)
    	continue;
    // File was updated
    $filemtime = $curtime;
    // Notify update.
    // We send a JSON object with 5 fields:
    // name
    // creator
    // date
    // description
    // contents
    $contents = file_get_contents(RASTERDIR . $projFname);
    if ($contents == FALSE) {
    	// An error occurred. Pretend that the project was deleted, which is not too far from
    	// the truth.
    	send(DELETED); // will exit the script
    }
    $str = sprintf(
		"{\"name\": \"%s\", \"creator\": \"%s\", \"date\": \"%s\", \"description\": \"%s\", \"contents\": \"%s\"}",
		slashadd($projName), slashadd($projCreator), slashadd($projDate), slashadd($projDescr), slashadd($contents)
	);
    send($str); // will exit the script
} 

// Add slashes to special characters, but NOT to single quotes.
function slashadd($str) {
	return str_replace("\\'","'",addslashes($str));
}

function send($mesg) {
	global $projFname, $projName;
	// Replace control characters by string literals
	$mesg = str_replace("\n", '\n', $mesg);
	$mesg = str_replace("\t", '\t', $mesg);
	$mesg = str_replace("\r", '\r', $mesg);
	echo "data: $mesg" . PHP_EOL;
	echo "retry: 100" . PHP_EOL;
	echo PHP_EOL;
	ob_flush();
	flush();
	$mesg = substr($mesg,0,15);
	if (DEBUGINFO) error_log("sent [$mesg] for file $projFname, project $projName");
	exit(0);
}

/* Read details from the project index file, and set global variables.
 * Globals are set to the empty string if project $name is not found, or on other errors
 */
function lookupDetails($name) {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
	$fh = fopen(INDEXFILE, "r");
	if ($fh==false) {
		// Cannot read index file. Assume that the list is empty, and that there are no projects.
		$projName = $projCreator = $projDate = $projDescr = $projFname = "";
		return;
	}
	while (($record = fgetcsv($fh)) !== false) {
		if (count($record)==5 && $record[0]==$name)
			break;
	}
	fclose($fh);
	if ($record[0]==$name) {
		$projName = $record[0];
		$projCreator = $record[1];
		$projDate = $record[2];
		$projDescr = $record[3];
		$projFname = $record[4];		
	} else {
		// Project did not appear in the index file
		$projName = $projCreator = $projDate = $projDescr = $projFname = "";
	}
}

?>
