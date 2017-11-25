<?php
/*
Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md
*/

/* The end() function needs a variable */
$dummy = explode(DIRECTORY_SEPARATOR,dirname(__FILE__));

/* The name of the current directory is the name of this access group */
define("GROUP", end($dummy) );
define("LANGUAGE", $_SERVER['HTTP_ACCEPT_LANGUAGE'] );

require "../index.inc";
?>
