<?php
/*
Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md
*/

/* 
 * 
 * GLOBALS
 * =======
 *
 */
$projName = array();
$projCreator = array();
$projDate = array();
$projDescr = array();
$projRname = array();	// Filename of Raster project on the server
$projTname = array();	// Filename of transactions on the server

define("RASTERDIR", "SharedProjects/");	// Prefix for location of shared Raster files
define("INDEXFILE", RASTERDIR . "projectindex.csv");	// Location of Index file
define("DEBUGINFO", true);		// Show extra info when errors are reported
define("MAXTRANSACTIONS", 100);	// Maximum number of transactions to save
//define("NilUUID", "00000000-0000-0000-0000-000000000000");

error_reporting(E_ERROR | E_PARSE);		// Hide warnings


/* readIndexFile: Read the list of projects from the index file
 *
 * Returns true when successful, false on error.
 * When successful, global arrays $projName...$projTname will have been set.
 */
function readIndexFile() {
	global $projName,$projCreator,$projDate,$projDescr,$projRname,$projTname;
	$fh = fopen(INDEXFILE, "r");
	if ($fh==false)
		return true; // Assume that the list is empty, no projects.
	if (!flock($fh,LOCK_SH)) {
		fclose($fh);
		return false;
	}
	$n = 0;
	while (($record = fgetcsv($fh)) !== false) {
		if (count($record)!=5) {
			$projName = array();
			$projCreator = array();
			$projDate = array();
			$projDescr = array();
			$projRname = array();
			$projTname = array();
			return false;
		}
		$projName[$n] = $record[0];
		$projCreator[$n] = $record[1];
		$projDate[$n] = $record[2];
		$projDescr[$n] = $record[3];
		$projRname[$n] = $record[4];
		$projTname[$n] = str_replace('.raster','.tr',$record[4]);
		$n++;
	}
	fclose($fh); // releases the lock
	return true;
}

/* rewriteIndexFile: Recreate the index file from the list of projects.
 *
 * Returns true when successful, false on error.
 * On error, the index file may be only partially written or empty.
 */
function rewriteIndexFile() {
	global $projName,$projCreator,$projDate,$projDescr,$projRname;
	$fh = fopen(INDEXFILE, "c");
	if ($fh==false)
		return false;
	if (!flock($fh,LOCK_EX)) {
		fclose($fh);
		return false;
	}
	// At this point, if the file existed it has not been modified yet.
	if (!ftruncate($fh,0)) {
		fclose($fh);
		return false;
	}
	foreach ($projName as $n => $pName) {
		$line = array($pName, $projCreator[$n], $projDate[$n], $projDescr[$n], $projRname[$n]);
		if (!fputcsv($fh,$line)) {
			fclose($fh);
			return false;
		}
	}
	return fclose($fh); // release the lock
}

/* getSharedProjects: Returns the contents of the index file in JSON format
 *
 * The filename is not returned. The string contains an array of objects, where
 * each object contains the name, creator and date of a shared project.
 * Example: [ {"name": "Name", "creator": "Creator", "date": "Datetime", "description": "Free form text"} ]
 * Returns a JSON string on success, an empty string on errors.
 */
function getSharedProjects() {
	global $projName,$projCreator,$projDate,$projDescr,$projRname;
	if (!readIndexFile())
		return "";
	
	$r = "[";
	$firstproj = true;
	foreach ($projName as $n => $pName) {
		$pCreator = $projCreator[$n];
		$pDate = $projDate[$n];
		$pDescr = $projDescr[$n];
		$pFname = $projRname[$n];

		$r .= ($firstproj ? "\n" : ",\n"); 
		$r .= sprintf(
			" {\"name\": \"%s\", \"creator\": \"%s\", \"date\": \"%s\", \"description\": \"%s\"}",
			slashadd($pName), slashadd($pCreator), slashadd($pDate), slashadd($pDescr)
		);
		$firstproj = false;
	}
	$r .= "\n]\n";
	return $r;
}

/* writeRasterFile: write $contents into a file named '$fname'
 *
 * Returns true on success, false on error.
 */
function writeRasterFile($fname,$content) {
	$fh = fopen(RASTERDIR . $fname, 'c');
	if ($fh===false) {
		return false;
	}
	if (!flock($fh, LOCK_EX)) { // failed to get lock
		fclose($fh);
		return false;
	}
	// At this point, if the file existed it has not been modified yet.
	$res = ftruncate($fh,0);
	if ($res!==false) $res = fwrite($fh,$content);
	if ($res!==false) $res = fflush($fh);
	$resc = fclose($fh); // this will release the lock
	return ($res!==false && $resc!==false);
}

/* appendRasterFile: append $contents to a file named '$fname'
 *
 * Returns true on success, false on error.
 */
function appendRasterFile($fname,$content) {
	$fh = fopen(RASTERDIR . $fname, 'a');
	if ($fh===false) {
		return false;
	}
	if (!flock($fh, LOCK_EX)) { // failed to get lock
		fclose($fh);
		return false;
	}
	// At this point, if the file existed it has not been modified yet.
	$res = fwrite($fh,$content);
	if ($res!==false) $res = fflush($fh);
	$resc = fclose($fh); // this will release the lock
	return ($res!==false && $resc!==false);
}

/* readRasterFile: safely read contents of a file named '$fname'
 *
 * File can be a project file (*.raster) or a transactions file (*.tr).
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

function getRandomString($length) {
    $characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    $str = "";    
    for ($i=0; $i<$length; $i++) {
        $str .= substr($characters, mt_rand(0, strlen($characters)-1), 1);
    }
    return $str;
}

// Add slashes to special characters, but NOT to single quotes.
function slashadd($str) {
	return str_replace("\\'","'",addslashes($str));
}

function doGetTransactions() {
	global $projName,$projTname;
	if ($_SERVER["REQUEST_METHOD"] != "GET")
		sendError("The 'gettrs' operation must use the GET method.");
	$gname=$_REQUEST['name'];
	if (is_null($gname) || $gname=="") sendError("Required parameter 'name' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n => $pName) {
		if ($pName != $gname) continue;
		// We have a match. Read project's transactions
		$transactions = getTransactions($projTname[$n]);
		if ($transactions===false)
			sendError("Failed to read and parse that transactions file.");
		// Return JSON of all id & prev
		header('Content-type: text/x-raster',true,200);
		echo "[\n";
		foreach ($transactions as $n => $tr) {
			if ($n!=0)
				echo ",\n";
			echo "{\"id\": \"" . $tr->{'id'} . "\", \"prev\": \"" . $tr->{'prev'} . "\"}\n";
		}
		echo "]\n";
		exit(0);
	}
	// A project with that name was not found, return null.
	header('Content-type: text/x-raster',true,200);
	echo "null";
	exit(0);
}

function doGetTransactionsFrom() {
	global $projName,$projTname;
	if ($_SERVER["REQUEST_METHOD"] != "GET")
		sendError("The 'gettrs' operation must use the GET method.");
	$gname=$_REQUEST['name'];
	$gtr=$_REQUEST['tr'];
	if (is_null($gname) || $gname=="") sendError("Required parameter 'name' is missing.");
	if (is_null($gtr) || $gtr=="") sendError("Required parameter 'tr' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n => $pName) {
		if ($pName != $gname) continue;
		// We have a match. Read project's transactions
		$transactions = getTransactions($projTname[$n]);
		if ($transactions===false)
			sendError("Failed to read and parse that transactions file.");
		$first = true;
		$contents = "";
		do {
			$found = false;
			foreach ($transactions as $n => $tr) {
				if ($tr->{'prev'}==$gtr) {
					$str = json_encode($tr,JSON_PRETTY_PRINT);
					if ($str===false)
						sendError("Failed to encode transaction.");
					if ($first)
						$contents = $contents . "\n,\n";
					$contents = $contents . $str;
					$found = true;
					$gtr = $tr->{'id'};
					break;
				}
			}
		} while ($found);
		header('Content-type: text/x-raster',true,200);
		echo "[" . $str . "]";
		exit(0);
	}
	// A project with that name was not found, return empty array.
	header('Content-type: text/x-raster',true,200);
	echo "[]";
	exit(0);
}

function doAppendTransaction() {
	global $projName,$projTname;
	if ($_SERVER["REQUEST_METHOD"] != "POST")
		sendError("The 'appendtr' operation must use the POST method.");
	$name=$_REQUEST['name'];
	if (is_null($name) || $name=="") sendError("Required parameter 'name' is missing.");
	$content = file_get_contents('php://input');
	$tr = json_decode($content);
	if ($tr===null)
		sendError("Failed to parse new transaction");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n => $pName) {
		if ($pName != $name) continue;
		// We have a match. Read project's transactions
		$transactions = getTransactions($projTname[$n]);
		if ($transactions===false)
			// assume that the file did not exist
			$transactions = array();
		// check that there is no existing transaction claiming the same prev,
		// and that the prev exists (unless we are adding the very first transaction)
		$prevexists = false;
		foreach ($transactions as $i => $t) {
			if ($t->{'id'}==$tr->{'prev'})
				$prevexists = true;
			if ($t->{'prev'}==$tr->{'prev'})
				sendError('Cannot add transaction: previous transaction already covered');
		}
		if (count($transactions)>0 && !prevexists)
			sendError('Cannot add transaction: previous transaction does not exist');
		array_push($transactions, $tr);
		// Keep at most the last MAXTRANSACTIONS transactions
		if (count($transactions)>MAXTRANSACTIONS) {
			splice($transactions, 0, count($transactions)-MAXTRANSACTIONS);
		}
		$contents = json_encode($transactions,JSON_PRETTY_PRINT);
		if ($contents===false)
			sendError("Failed to encode new transactions file.");
		$res = writeRasterFile($projTname[$n],$contents);
		if ($res===false)
			sendError("Failed to update transactions file.");
		header('Content-type: text/x-raster',true,200);
		echo $res;
		exit(0);
	}
	// Project wasn't found.
	sendError("No matching project was found.");
}

function doPutTransactions() {
	global $projName,$projTname;
	if ($_SERVER["REQUEST_METHOD"] != "POST")
		sendError("The 'puttrs' operation must use the POST method.");
	$name=$_REQUEST['name'];
	if (is_null($name) || $name=="") sendError("Required parameter 'name' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n => $pName) {
		if ($pName != $name) continue;
		$fname = $projTname[$n];
		$content = file_get_contents('php://input');
		$res = writeRasterFile($fname,$content);
		if ($res===false)
			sendError("Failed to write transactions file.");
		header('Content-type: text/x-raster',true,200);
		echo $res;
		exit(0);
	}
	// Project wasn't found.
	sendError("No matching project was found.");
}

function doGetProps() {
	global $projName,$projCreator,$projDate,$projDescr;
	if ($_SERVER["REQUEST_METHOD"] != "GET")
		sendError("The 'getprops' operation must use the GET method.");
	$gname=$_REQUEST['name'];
	if (is_null($gname) || $gname=="") sendError("Required parameter 'name' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n => $pName) {
		if ($pName != $gname) continue;
		$pCreator = $projCreator[$n];
		$pDate = $projDate[$n];
		$pDescr = $projDescr[$n];
		// We have a match. Return this project's details
		header('Content-type: text/x-raster',true,200);
		echo sprintf(
			"{\"name\": \"%s\", \"creator\": \"%s\", \"date\": \"%s\", \"description\": \"%s\"}",
			slashadd($pName), slashadd($pCreator), slashadd($pDate), slashadd($pDescr)
		);
		exit(0);
	}
	// A project with that name was not found, return null.
	header('Content-type: text/x-raster',true,200);
	echo "null";
	exit(0);
}

function doDel() {
	global $projName,$projCreator,$projDate,$projDescr,$projRname,$projTname;
	if ($_SERVER["REQUEST_METHOD"] != "POST")
		sendError("The 'del' operation must use the POST method.");
	$gname=$_REQUEST['name'];
	$gcreator=$_REQUEST['creator'];
	$gdate=$_REQUEST['date'];
	if (is_null($gname) || $gname=="") sendError("Required parameter 'name' is missing.");
	if (is_null($gcreator) || $gcreator=="") sendError("Required parameter 'creator' is missing.");
	if (is_null($gdate) || $gdate=="") sendError("Required parameter 'date' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n
	=> $pName) {
		if ($pName != $gname) continue;
		if ($projCreator[$n] != $gcreator) continue;
		if ($projDate[$n] != $gdate) continue;
		$fname = $projRname[$n];
		$tname = $projTname[$n];
		
		// Remove from the global arrays
		array_splice($projName,$n,1);
		array_splice($projCreator,$n,1);
		array_splice($projDate,$n,1);
		array_splice($projDescr,$n,1);
		array_splice($projRname,$n,1);
		// Now modify the filesystem, and return true on success
		if (!unlink(RASTERDIR . $fname))
			sendError("Failed to remove the raster datafile.");
		if (file_exists(RASTERDIR . $tname) && !unlink(RASTERDIR . $tname))
			sendError("Failed to remove the raster transactions file.");
		if (!rewriteIndexFile())
			sendError("Failed to update the index file.");
		// Success!
		header('Content-type: text/x-raster',true,200);
		echo "";
		exit(0);
	}
	// Project wasn't found.
	sendError("No matching project was found.");
}

function doGet() {
	global $projName,$projCreator,$projDate,$projRname;
	if ($_SERVER["REQUEST_METHOD"] != "GET")
		sendError("The 'get' operation must use the GET method.");
	$gname=$_REQUEST['name'];
	$gcreator=$_REQUEST['creator'];
	$gdate=$_REQUEST['date'];
	if (is_null($gname) || $gname=="") sendError("Required parameter 'name' is missing.");
	if (is_null($gcreator) || $gcreator=="") sendError("Required parameter 'creator' is missing.");
	if (is_null($gdate) || $gdate=="") sendError("Required parameter 'date' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	foreach ($projName as $n => $pName) {
		if ($pName != $gname) continue;
		if ($projCreator[$n] != $gcreator) continue;
		if ($projDate[$n] != $gdate) continue;
		$res = readRasterFile($projRname[$n]);
		if ($res===false)
			sendError("Failed to read that project's file.");
		header('Content-type: text/x-raster',true,200);
		echo $res;
		exit(0);
	}
	// Project wasn't found.
	sendError("No matching project was found.");
}

/* Description cannot be a multiline string. Any newline characters must be escaped
 * by the client, and restored after retrieving data from this PHP script.
 * To prevent issues, any remaining newlines (which are a bug in the client) will be
 * replaced by spaces.
 */
function doPut() {
	global $projName,$projCreator,$projDate,$projDescr,$projRname,$projTname;
	if ($_SERVER["REQUEST_METHOD"] != "POST")
		sendError("The 'put' operation must use the POST method.");
	$name=$_REQUEST['name'];
	$creator=$_REQUEST['creator'];
	$descr=str_replace("\n"," ",$_REQUEST['description']);
	if (is_null($name) || $name=="") sendError("Required parameter 'name' is missing.");
	if (is_null($creator) || $creator=="") sendError("Required parameter 'creator' is missing.");
	if (is_null($descr)) sendError("Required parameter 'description' is missing.");
	$date = strftime("%Y%m%d %H%M %S");
	$content = file_get_contents('php://input');
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	// Find the old project in the in-memory index (if any)
	$fname = "";
	$i = -1;
	foreach ($projName as $n => $pname) {
		if ($pname != $name) continue;
		$fname = $projRname[$n];
		break;
	}
	if ($fname=="") $fname = getRandomString(20) . ".raster";
	// 1. create the new raster file on disk
	$res = writeRasterFile($fname,$content);
	if (!$res)
		sendError("Failed to store file on server.");
	// 2. remove the old project from the in-memory index (if any)
	foreach ($projName as $n => $pname) {
		if ($pname != $name) continue;
		// Delete all $n'th elements
		array_splice($projName,$n,1);
		array_splice($projCreator,$n,1);
		array_splice($projDate,$n,1);
		array_splice($projDescr,$n,1);
		array_splice($projRname,$n,1);
		array_splice($projTname,$n,1);
	}
	// 3. add the new raster file to the in-memory index
	$n = count($projName);
	$projName[$n] = $name;
	$projCreator[$n] = $creator;
	$projDate[$n] = $date;
	$projDescr[$n] = $descr;
	$projRname[$n] = $fname;
	$projTname[$n] = str_replace('.raster','.tr',$fname);
	// 4. rewrite the index to reflect both changes.
	$res = rewriteIndexFile();
	if (!$res)
		sendError("Failed to rewrite the index file.");

	// Return 200 as HTTP return code with a document containing the timestamp for the project.
	header('Content-type: text/x-raster',true,200);
	echo $date;
	exit(0);
}

function doList() {
	if ($_SERVER["REQUEST_METHOD"] != "GET")
		sendError("The 'list' operation must use the GET method.");
	$str = getSharedProjects();
	if ($str=="")
		sendError("Index file cannot be read or contains invalid entries.");
	header('Content-type: text/x-raster',true,200);
	echo $str;
	exit(0);
}

function sendError($errorMessage) {
	header('Content-type: text/x-raster',true,500);
	echo $errorMessage . "\n";
	if (DEBUGINFO) {
		echo "\n";
		foreach ($_REQUEST as $key => $val)
			echo "REQUEST $key = [$val]\n";
		echo "\n";
//		foreach ($_SERVER as $key => $val)
//			echo "$key = $val\n";
	}
	exit(0);
}

/* Helper function
 *
 * Used to download a file from the app. Because we cannot start a proper download
 * initiated through the browser itself, we upload the file to the server, and
 * immediately have it sent back to us, but this time including all the desired
 * headers.
 *
 * reflect: download that what we uploaded in this very same request, add the
 *	current date and time to the filename.
 *
 */
function doReflect() {
	$name=slashadd($_REQUEST['name']);
	if (is_null($name) || $name=="") sendError("Required parameter 'name' is missing.");
	if (function_exists("get_magic_quotes_gpc") && get_magic_quotes_gpc()) {
		$content=stripslashes($_REQUEST['contents']);
	} else {
		$content=$_REQUEST['contents'];
	}
	if (is_null($content) || $content=="") sendError("Required parameter 'content' is missing.");
	
	$datetime = strftime("%Y%m%d %H%M %S");
	header('Content-Description: Project exported');
	header('Content-Type: text/x-raster');
	header("Content-Disposition: attachment; filename=\"${name} ${datetime}.raster\"");
	header("Content-Length: " . strlen($content));
	echo $content;
	exit(0);
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * MAIN BODY
 *
 */
switch ($_REQUEST['op']) {
case "gettrs":
	doGetTransactions();
	break;
case "gettrsfrom":
	doGetTransactionsFrom();
	break;
case "puttrs":
	doPutTransactions();
	break;
case "appendtr":
	doAppendTransaction();
	break;
case "getprops":
	doGetProps();
	break;
case "del":
	doDel();
	break;
case "put":
	doPut();
	break;
case "get":
	doGet();
	break;
case "reflect":
	doReflect();
	break;
default:
	doList();
}

?>
