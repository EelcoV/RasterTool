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
define("NilUUID", "00000000-0000-0000-0000-000000000000");

define("NOPROJECT", "NO PROJECT");
define("UPDATED", "UPDATED");
define("TRANSACTION", "TRANSACTION");
define("DELETED", "DELETED");
define("NOP", "NOP");

// Globals
$projName = "";		// project name
$projCreator = "";	// project creator
$projDate = "";		// data-time of creation of Raster file and project
$projDescr = "";	// project description
$projRname = "";	// filename of Raster project on the server
$projTname = "";	// filename of transactions on the server

set_time_limit(0);  // No limit on execution time. Lifetime is limited to NOPINTERVAL

/* existsAndNotemptyRasterFile: checks whether a file named '$fname' exists *and* containts data
 *
 * File can be a project file (*.raster) or a transactions file (*.tr).
 * Returns the true if the file exists and has a non-zero size, false otherwise and on errors.
 */
function existsAndNotemptyRasterFile($fname) {
	$s = filesize(RASTERDIR . $fname);
	if ($s===false) return false;
	return ($s>0);
}

/* readRasterFile: safely read contents of a file named '$fname'
 *
 * Returns the contents of the file on success, false on error.
 */
function readRasterFile($fname) {
	$filename = RASTERDIR . $fname;
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
function getTransactions($trname) {
	if (!existsAndNotemptyRasterFile($trname))
		return array();
	$contents = readRasterFile($trname);
	if ($contents===false)
		return false;
	$transactions = json_decode($contents);
	if ($transactions===null) {
		return false;
	}
	return $transactions;
}

function getLatestTransactionID($trfname) {
	$transactions = getTransactions($trfname);
	if ($transactions===false) {
		return NilUUID;
	}
	$tr = array_pop($transactions);
	if ($tr==null) {
		return NilUUID;
	}
	return $tr->{'id'};
}


header('X-Accel-Buffering: no');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache'); // recommended to prevent caching of event data.

$name = $_REQUEST['name'];
$indexmtime = filemtime(INDEXFILE);
lookupDetails($name);
if ($projRname == "") {
	send(NOPROJECT);
	exit(0);
}

// We know the file names. Find their modification time
$Rfilemtime = filemtime(RASTERDIR . $projRname);
$Tfilemtime = filemtime(RASTERDIR . $projTname);
if (DEBUGINFO) error_log("starting watch for file $projRname, project $projName");

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
		if ($projRname=="") {
			send(DELETED);
		}
		$indexmtime = $curtime;
	}

	// Check current mtime of the Transaction file
	$curtimeTr = filemtime(RASTERDIR . $projTname);
	if ($curtimeTr > $Tfilemtime) {
		// File was updated, notify update.
		send(TRANSACTION); // will exit the script
	}

	// Check current mtime of the Raster file
	// only notifyif project file is newer than the transaction file
	$curtime = filemtime(RASTERDIR . $projRname);
	if ($curtime>$curtimeTr && $curtime>$Rfilemtime) {
		// File was updated, notify update.
		
		// We send a JSON object with 6 fields:
		// name
		// creator
		// date
		// description
		// ID of last transaction
		// contents
		$contents = readRasterFile($projRname);
		if ($contents == FALSE) {
			// An error occurred. Pretend that the project was deleted, which is not too far from
			// the truth.
			send(DELETED); // will exit the script
		}
		$str = sprintf(
			"{\"name\": \"%s\", \"creator\": \"%s\", \"date\": \"%s\", \"description\": \"%s\", \"trlast\": \"%s\", \"contents\": \"%s\"}",
			slashadd($projName), slashadd($projCreator), slashadd($projDate), slashadd($projDescr), getLatestTransactionID($projTname), slashadd($contents)
		);
		send($str); // will exit the script
	}
}

// Add slashes to special characters, but NOT to single quotes.
function slashadd($str) {
	return str_replace("\\'","'",addslashes($str));
}

function send($mesg) {
	global $projRname, $projName;
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
	if (DEBUGINFO) error_log("sent [$mesg] for file $projRname, project $projName");
	exit(0);
}

/* Read details from the project index file, and set global variables.
 * Globals are set to the empty string if project $name is not found, or on other errors
 */
function lookupDetails($name) {
	global $projName,$projCreator,$projDate,$projDescr,$projRname,$projTname;
	$fh = fopen(INDEXFILE, "r");
	if ($fh==false) {
		// Cannot read index file. Assume that the list is empty, and that there are no projects.
		$projName = $projCreator = $projDate = $projDescr = $projRname = $projTname = "";
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
		$projRname = $record[4];
		$projTname = str_replace('.raster','.tr',$projRname);
	} else {
		// Project did not appear in the index file
		$projName = $projCreator = $projDate = $projDescr = $projRname = $projTname = "";
	}
}

?>
