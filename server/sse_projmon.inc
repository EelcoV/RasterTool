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
 * - DELETED: the project disappeared. Some client deleted it.
 * - TRANSACTION: a transaction has been posted on the project.
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
define("NilUUID", "00000000-0000-0000-0000-000000000000");

define("NOPROJECT", "NO PROJECT");
define("NOP", "NOP");
define("DELETED", "DELETED");

set_time_limit(0);  // No limit on execution time. Lifetime is limited to NOPINTERVAL

header('X-Accel-Buffering: no');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache'); // recommended to prevent caching of event data.

// Globals
$projTname = "";	// filename of transactions on the server
$name = $_REQUEST['name'];
$indexmtime = filemtime(INDEXFILE);

lookupDetails($name);
if ($projTname == "") {
	send(NOPROJECT);
	exit(0);
}

// We know the file name. Save it, and find its modification time
$filename = RASTERDIR . $projTname;
if (file_exists($filename)) {
	$Tfilemtime = filemtime($filename);
} else {
	$Tfilemtime = 0;
}
if (DEBUGINFO) error_log("starting watch for file $projTname, project $name");

$noptime = time();

while (true) {
	usleep(IDLETIME);
	// Send NOP, if necessary.
	if (time()-$noptime > NOPINTERVAL) {
		send(NOP); // will exit the script
	}
	// Check whether the index file was updated, and update project details
	clearstatcache(); // Because mtimes are cached by PHP
	if (filemtime(INDEXFILE) != $indexmtime) {
		lookupDetails($name);
		if ($projTname=="") {
			send(DELETED);
		}
		$indexmtime = $curtime;
	}

	// Check current mtime of the Transaction file
	if (file_exists($filename) && filemtime($filename) > $Tfilemtime) {
		// File was updated, notify with id of latest transaction
		send(getLatestTransactionID()); // will exit the script
	}
}

function send($mesg) {
	global $projTname, $name;
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
	if (DEBUGINFO) error_log("sent [$mesg] for file $projTname, project [$name]");
	exit(0);
}

/* Read details from the project index file, and set global variables.
 * Globals are set to the empty string if project $name is not found, or on other errors
 */
function lookupDetails($name) {
	global $projTname;
	$fh = fopen(INDEXFILE, "r");
	if ($fh==false) {
		// Cannot read index file. Assume that the list is empty, and that there are no projects.
		$projTname = "";
		return;
	}
	while (($record = fgetcsv($fh)) !== false) {
		if (count($record)==5 && $record[0]==$name)
			break;
	}
	fclose($fh);
	if ($record[0]==$name) {
//		$projName = $record[0];
//		$projCreator = $record[1];
//		$projDate = $record[2];
//		$projDescr = $record[3];
		$projRname = $record[4];
		$projTname = str_replace('.raster','.tr',$projRname);
	} else {
		// Project did not appear in the index file
		$projTname = "";
	}
}

/* existsAndNotemptyRasterFile: checks whether a file named '$fname' exists *and* containts data
 *
 * File can be a project file (*.raster) or a transactions file (*.tr).
 * Returns the true if the file exists and has a non-zero size, false otherwise and on errors.
 */
function existsAndNotemptyRasterFile() {
	global $filename;
	$s = filesize($filename);
	if ($s===false) return false;
	return ($s>0);
}

/* readRasterFile: safely read contents of a file named '$fname'
 *
 * Returns the contents of the file on success, false on error.
 */
function readRasterFile() {
	global $filename;
	$fh = fopen($filename,'r');
	if ($fh===false) return false;
	$res = false;
	if (flock($fh, LOCK_SH)) {
		// File locked and ready for reading
		$res = fread($fh, filesize($filename));
	}
	fclose($fh); // will release the lock
	return $res;
}

/* getTransactions: read a transactions file into an array of objects
 *
 * Returns an (empty) array on success, or false on error.
 */
function getTransactions() {
	if (!existsAndNotemptyRasterFile())
		return array();
	$contents = readRasterFile();
	if ($contents===false)
		return false;
	$transactions = json_decode($contents);
	if ($transactions===null) {
		return false;
	}
	return $transactions;
}

function getLatestTransactionID() {
	$transactions = getTransactions();
	if ($transactions===false) {
		return NilUUID;
	}
	$tr = array_pop($transactions);
	if ($tr==null) {
		return NilUUID;
	}
	return $tr->{'id'};
}


?>
