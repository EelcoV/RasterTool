<?php
/* $Id: share.inc,v 1.1.2.1 2012/09/11 08:47:38 vriezekolke Exp $
 * 
 * GLOBALS
 * =======
 *
 */
$projName = array();
$projCreator = array();
$projDate = array();
$projDescr = array();
$projFname = array();

define("RASTERDIR", "SharedProjects/");	// Prefix for location of shared Raster files
define("INDEXFILE", RASTERDIR . "projectindex.csv");	// Location of Index file
define("DEBUGINFO", true);		// Show extra info when errors are reported

error_reporting(E_ERROR | E_PARSE);		// Hide warnings

/* readIndexFile: Read the list of projects from the index file
 *
 * Returns true when successful, false on error.
 * When successful, global arrays $projName...$projFname will have been set.
 */
function readIndexFile() {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
	$fh = fopen(INDEXFILE, "r");
	if ($fh==false)
		return true; // Assume that the list is empty, no projects.
	$n = 0;
	while (($record = fgetcsv($fh)) !== false) {
		if (count($record)!=5) {
			$projName = array();
			$projCreator = array();
			$projDate = array();
			$projDescr = array();
			$projFname = array();
			return false;
		}
		$projName[$n] = $record[0];
		$projCreator[$n] = $record[1];
		$projDate[$n] = $record[2];
		$projDescr[$n] = $record[3];
		$projFname[$n] = $record[4];
		$n++;
	}
	fclose($fh);
	return true;
}

/* rewriteIndexFile: Recreate the index file from the list of projects.
 *
 * Returns true when successful, false on error.
 * On error, the index file may be only partially written or empty.
 */
function rewriteIndexFile() {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
	$fh = fopen(INDEXFILE, "w");
	if ($fh==false)
		return false;
	foreach ($projName as $n => $pName) {
		$line = array($pName, $projCreator[$n], $projDate[$n], $projDescr[$n], $projFname[$n]);
		if (!fputcsv($fh,$line)) {
			fclose($fh);
			return false;
		}
	}
	return fclose($fh);
}

/* appendToIndexFile: Add a line to the end of the index file.
 *
 * Returns true when successful, false on error.
 * On error, the contents of the index file may be corrupted.
 */
function appendToIndexFile($name,$creator,$date,$descr,$fname) {
	$fh = fopen(INDEXFILE, "a");
	if ($fh==false)
		return false;
	$line = array($name, $creator, $date, $descr,$fname);
	if (!fputcsv($fh,$line)) {
		fclose($fh);
		return false;
	}
	return fclose($fh);
}

/* deleteFile: Remove the file named '$del'.
 *
 * Unlink the file, and update the globals as well as the index file.
 * Returns true on success, false on error.
 * On error, the contents of the index file may be incorrect.
 */
function deleteFile($del) {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
	foreach ($projFname as $n => $pFname) {
		if ($pFname != $del) continue;
		// Delete all $n'th elements
		array_splice($projName,$n,1);
		array_splice($projCreator,$n,1);
		array_splice($projDate,$n,1);
		array_splice($projDescr,$n,1);
		array_splice($projFname,$n,1);
		// Now modify the filesystem, and return true on success
		return unlink(RASTERDIR . $del) && rewriteIndexFile();
	}
	// File '$del' wasn't found, and that is an error.
	return false;
}

/* getSharedProjects: Returns the contents of the index file in JSON format
 *
 * The filename is not returned. The string contains an array of objects, where
 * each object contains the name, creator and date of a shared project.
 * Example: [ {"name": "Name", "creator": "Creator", "date": "Datetime", "description": "Free form text"} ]
 * Returns a JSON string on success, an empty string on errors.
 */
function getSharedProjects() {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
	if (!readIndexFile())
		return "";
	
	$r = "[";
	$firstproj = true;
	foreach ($projName as $n => $pName) {
		$pCreator = $projCreator[$n];
		$pDate = $projDate[$n];
		$pDescr = $projDescr[$n];
		$pFname = $projFname[$n];

		$r .= ($firstproj ? "\n" : ",\n"); 
		$r .= sprintf(
			" {\"name\": \"%s\", \"creator\": \"%s\", \"date\": \"%s\", \"description\": \"%s\"}",
			addslashes($pName), addslashes($pCreator), addslashes($pDate), addslashes($pDescr)
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
	$res = file_put_contents(RASTERDIR . $fname, $content);
	return ($res===false ? false : true);
}

/* readRasterFile: read contents of a file named '$fname'
 *
 * Returns the contents of the file on success, false on error.
 */
function readRasterFile($fname) {
	return file_get_contents(RASTERDIR . $fname);
}

function getRandomString($length) {
    $characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    $str = "";    
    for ($i=0; $i<$length; $i++) {
        $str .= substr($characters, mt_rand(0, strlen($characters)-1), 1);
    }
    return $str;
}

function doGetProps() {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
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
			addslashes($pName), addslashes($pCreator), addslashes($pDate), addslashes($pDescr)
		);
		exit(0);
	}
	// A project with that name was not found, return null.
	header('Content-type: text/x-raster',true,200);
	echo "null";
	exit(0);
}

function doDel() {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
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
	foreach ($projName as $n => $pName) {
		if ($pName != $gname) continue;
		if ($projCreator[$n] != $gcreator) continue;
		if ($projDate[$n] != $gdate) continue;
		$fname = $projFname[$n];
		
		// Remove from the global arrays
		array_splice($projName,$n,1);
		array_splice($projCreator,$n,1);
		array_splice($projDate,$n,1);
		array_splice($projDescr,$n,1);
		array_splice($projFname,$n,1);
		// Now modify the filesystem, and return true on success
		if (!unlink(RASTERDIR . $fname))
			sendError("Failed to remove the raster datafile.");
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
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
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
		$res = readRasterFile($projFname[$n]);
		if ($res===false)
			sendError("Failed to read that project's file.");
		header('Content-type: text/x-raster',true,200);
		echo $res;
		exit(0);
	}
	// Project wasn't found.
	sendError("No matching project was found.");
}

function doPut() {
	global $projName,$projCreator,$projDate,$projDescr,$projFname;
	if ($_SERVER["REQUEST_METHOD"] != "POST")
		sendError("The 'put' operation must use the POST method.");
	$name=$_REQUEST['name'];
	$creator=$_REQUEST['creator'];
	$descr=$_REQUEST['description'];
	if (is_null($name) || $name=="") sendError("Required parameter 'name' is missing.");
	if (is_null($creator) || $creator=="") sendError("Required parameter 'creator' is missing.");
	if (is_null($descr)) sendError("Required parameter 'description' is missing.");
	if (!readIndexFile())
		sendError("Index file cannot be read or contains invalid entries.");
	$date = strftime("%Y%m%d %H%M %S");
	$fname = getRandomString(20) . ".raster";
	$content = file_get_contents('php://input');
	// 1. create the new raster file on disk
	$res = writeRasterFile($fname,$content);
	if (!$res)
		sendError("Failed to store file on server.");
	// 2. remove the old project from the in-memory index (if any)
	$oldFname = "";
	foreach ($projName as $n => $pname) {
		if ($pname != $name) continue;
		// Remember the raster file
		$oldFname = $projFname[$n];
		// Delete all $n'th elements
		array_splice($projName,$n,1);
		array_splice($projCreator,$n,1);
		array_splice($projDate,$n,1);
		array_splice($projDescr,$n,1);
		array_splice($projFname,$n,1);
	}
	// 3. add the new raster file to the in-memory index
	$n = count($projName);
	$projName[$n] = $name;
	$projCreator[$n] = $creator;
	$projDate[$n] = $date;
	$projDescr[$n] = $descr;
	$projFname[$n] = $fname;
	// 4. rewrite the index to reflect both changes.
	$res = rewriteIndexFile();
	if (!$res)
		sendError("Failed to rewrite the index file.");
	// 5. unlink the old raster file (if any)
	if ($oldFname != "") {
		$res = unlink(RASTERDIR . $oldFname);
		if (!$res)
			sendError("Failed to unlink previous raster file.");
	}

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
		foreach ($_SERVER as $key => $val)
			echo "$key = $val\n";
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
	$name=addslashes($_REQUEST['name']);
	if (is_null($name) || $name=="") sendError("Required parameter 'name' is missing.");
	if (get_magic_quotes_gpc()) {
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