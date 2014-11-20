/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

Property		setter					fieldname in export/localStorage
--------		--------------------	--------------------------------
Project
.id				creator(p.id)			key raster:<version>:P:<p.id>
.title			settitle(str)			.l
.shared			shared(bool)			.a
.description	setdescription(str)		.d
.date			setdate(d)				.w // when = date
.services[i]	addservice(s.id,title)	.s
.threats[i]		(internal)				.t   (careful: also used for 'type')

Threat
.id				creator(type,th.id)		key raster:<version>:T:<th.id>
.project		setproject(p.id)		.p
.type			creator(type,th.id)		.t
.title			settitle(str)			.l
.description	setdescription(str)		.d

Service
.id				creator(s.id)			key raster:<version>:S:<s.id>
.title			settitle(str)			.l
.project		setproject(p.id)		.p

Node
.id				creator(type,n.id)		key raster:<version>:N:<n.id>
.type			creator(type,n.id)		.t
.title			various					.l
.service		Service.cid				.s
.component		setcomponent(ct.id)		.m
.position.x		setposition(x,y)		.x
.position.y		setposition(x,y)		.y
.position.width	   (internal)			.w
.position.height   (internal)			.h
._normw			(internal)				.v // letter just before w
._normh			(internal)				.g // letter just before h
.connect[]		(internal)				.c
.color			setlabel(c)				.o

Component
.id				creator(type,ct.id)		key raster:<version>:C:<ct.id>
.type			creator(type,n.id)		.t
.project		setproject(p.id)		.p
.thrass[]		(internal)				.e
.title			settitle(str)			.l
.nodes[]		addnode(n.id)			.n
.single			setsingle				.i
.accordionopened setaccordionopened(b)	.o

NodeCluster		creator(type,cl.id)		key raster:<version>:L:<ct.id>
.id
.type									.t
.title									.l
.project								.p
.parentcluster							.u	// u = up
.childclusters[]						.c	// c = child
.childnodes[]							.n	// n = nodes
.thrass									.e
.accordionopened setaccordionopened(b)	.o
 
ThreatAssessment
.id				creator(type,te.id)		key raster:<version>:E:<te.id>
.type			creator(type,te.id)		.t
.component		setcomponent(n.id)		.m
.cluster		setcluster(f.id)		.u
.title			settitle(str)			.l
.description	setdescription(str)		.d
.freq			setfreq(str)			.p
.impact			setimpact(str)			.i
.remark			setremark(str)			.r

RasterPreferences						key raster:version:R:0
.theme			"name of theme preference"
.emsize			"em_none", "em_small", "em_large"
.tab			0..3
.crator			"name of creator"

 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

"use strict";
//const DEBUG = true;  // set to false for production version
var DEBUG = true;  // set to false for production version

/* LS is prefixed to all keys of data entered into localStorage. The prefix
 * is versioned. In future, the app can check for presence of keys from
 * previous versions and perform an upgrade.
 */
var LS_prefix = "raster";
var LS_version = 1;
var LS = LS_prefix+":"+LS_version+":";

/* Global preferences */
var Preferences;

/* This jQuery function executes when the document is ready, but before all
 * HTML objects have been painted.
 */
$(function() { 
	$.ajaxSetup({
		timeout: 10000	// Cancel each AJAX request after 10 seconds
	});

	$('#tabs').tabs();
	$('#tabs').addClass('ui-tabs-vertical-sw ui-helper-clearfix');
	$('.ui-tabs-nav').addClass('rot-neg-90');

	$('#tabs').bind("tabsshow", vertTabSelected);

	$('input[type=button]').button();
	$('input[type=submit]').button();
	$('input[type=button]').css("padding","2px 11px");
	$('input[type=submit]').css("padding","2px 11px");

	$('#modaldialog').dialog({ autoOpen:false, modal:true, width: 400 });

	$('#tab_singlefs').click(removetransientwindows);
	$('#tab_ccfs').click(removetransientwindows);
	$('#tab_analysis').click(removetransientwindows);

	// tab_diagrams, tab_singlefs, tab_ccfs
	$("a[href^=#tab_diagrams]").attr('title', "Draw diagrams for the services.");
	$("a[href^=#tab_singlefs]").attr('title', "Assess all single failures.");
	$("a[href^=#tab_ccfs]").attr('title', "Assess all common cause failures.");
	$("a[href^=#tab_analysis]").attr('title', "Reporting and analysis tools.");

	if (!testLocalStorage()) {
		// The splash screen is still visible, and will obscure any interaction.
		$('#splashstatus').html("Error: no local storage available.<br>Adjust cookie or privacy settings?");
		rasterAlert("Cannot continue",
			"HTML5 local storage is not supported by this browser or configuration. "
			+ "This app will not work properly. "
			+ "<p>Try adjusting your cookie or privacy settings.");
	}
	
	// Load preferences
	Preferences = new PreferencesObject();
	var remembertab = Preferences.tab;
	
	initLibraryPanel();
	initOptionsPanel();

	initTabDiagrams();
	initTabSingleFs();
	initTabCCFs();
	initTabAnalysis();
	
	SizeDOMElements();

	/* Loading data from localStorage. Tweaked for perfomance.
	 */
	var strArr = [];
	for (var i=0, alen=localStorage.length; i<alen; i++) {  
		var key = localStorage.key(i);
		strArr.push(key+'\t');
		strArr.push(localStorage[key]+'\n');
	} 
	var str = strArr.join("");
	if (loadFromString(str,true,true,"Browser local storage")!=null) {
		// Loading from localStorage succeeded. Try to active the project
		// indicated by Preferences.currentproject, or take any one project
		// if that one does not exist.
		i = Project.withTitle(Preferences.currentproject);
		var p = (i==null ? Project.firstProject() : Project.get(i) );
		if (p===0)
			loadDefaultProject();
		else {
			p.load();
			p.dorefresh(false); // Check for update on the server
		}
	} else
		loadDefaultProject();
	startAutoSave();
	
	Preferences.settab(remembertab);
	$('#tabs').tabs("select",Preferences.tab);
	forceSelectVerticalTab(Preferences.tab);

	$('#helpimg').hover( function() {
			$('#helpimg').attr("src","../img/qm-hi.png");
		}, function() {
			$('#helpimg').attr("src","../img/qm-lo.png");
	});
	$('#helptabs').tabs({
		cache: true,
		heightStyle: "fill"
	});
	$('#helptabs li:last-of-type').css("margin-left","10px");
	$('#helppanel').dialog({
		title: "Information on using this tool",
		autoOpen: false,
		height: 450,
		minHeight: 120,
		width: 600,
		minWidth: 470,
		maxWidth: 800,
		resize: function(event,ui) {
			$('#helptabs ul').width(ui.size.width-36);
		}
	});
	$('#helppanel').dialog("widget").css("overflow","visible").addClass("donotprint");
	$('#helpbutton img').click( function() {
		$('#helppanel').dialog("open");
	});

	var flashTimer;
	$("#networkactivity").ajaxSend(function(){
		window.clearTimeout(flashTimer);
		$("#networkactivity").removeClass("activityoff activityno").addClass("activityyes");
	});
	$("#networkactivity").ajaxStop(function(){
		// Make sure that the activity light flashes at least some small time
		flashTimer = window.setTimeout(function(){
			$("#networkactivity").removeClass("activityoff activityyes").addClass("activityno");
		},200);
	});

	$('body').keydown(function(evt){
		 if (evt.keyCode==8 && evt.eventPhase!=Event.BUBBLING_PHASE) // Backspace, as it bound in the browser to 'Return to previous page'
		 	return false;	
	});
	$('body').bind('contextmenu', function(e) {
		e.preventDefault();
	});

	$(window).load(function() {
		$('#splash').hide();
	});
	$(window).unload(function() {
		stopWatching(null);
		$('#goodbye').show();
	});
	$(window).resize(SizeDOMElements);

	// The onbeforeprint handler is supported by IE and Firefox only.
	window.onbeforeprint = function() {
		switch (Preferences.tab) {
		case 0:
			var os = $('#scroller_overview'+Service.cid).offset();
			$('#scroller_region'+Service.cid).offset( {top: os.top+1, left: os.left+1});
			$('#diagrams'+Service.cid).scrollTop(0); 
			$('#diagrams'+Service.cid).scrollLeft(0); 
			break;
		case 1:
			expandAllSingleF(Service.cid);
			break;
		case 2:
			expandAllCCF();
			break;
		case 3:
			// Do nothing
			break;
		default:
			bugreport("Unknown Preferences.tab", "window.onbeforeprint");
		}
	};
});

/* testLocalStorage(): returns boolean
 * Checks whether the browser supports storing values in localStorage.
 */
function testLocalStorage() {
	try {
		if (window.location.href.match(/^file/i))
			rasterAlert('Warning',"Warning: Firefox discards your work on page reload.\nYou will lose your work unless you export your project.");
		if (!localStorage) 
			throw("noLocalStorage");
		localStorage[LS+"test"] = "it works";
		if (localStorage[LS+"test"] != "it works")
			throw("noLocalStorage");
		localStorage.removeItem(LS+"test");
		if (localStorage[LS+"test"]) 
			throw("noLocalStorage");
		return true;
	} catch(err) {
		return false;
	}
}

function loadDefaultProject() {
	var s = new Service();
	var p = new Project();
	p.adddefaultthreats();
	p.addservice(s.id);
	s.autosettitle();
	p.autosettitle();
	p.load();
	s.paintall();
}

/* SizeDOMElements()
 * Set the size of various containers, based on the size of the browser window.
 */
function SizeDOMElements() {
	var ww = $(window).width();
	var wh = $(window).height();
	
	// Overall browser window / DOM body
	$('#tabs').width(ww-19);
	$('#tabs').height(wh-19);
	// Vertical navigation tabs
	$('.ui-tabs-nav').width(wh-23);
	var s = "";
	s += 'rotate(-90deg) translateX(-';
	s += wh-18;
	s += 'px)';
	$('.rot-neg-90').css("transform",s); 
	$('.rot-neg-90').css("-ms-transform",s); 
	$('.rot-neg-90').css("-moz-transform",s); 
	$('.rot-neg-90').css("-webkit-transform",s); 
	$('.rot-neg-90').css("-o-transform",s); 
	$('.rot-neg-90').css("border-bottom-left-radius","0px"); 
	$('.rot-neg-90').css("border-bottom-right-radius","0px"); 

	$('.workbody').width(ww-60);
	$('.workbody').height(wh-62);
	$('.workouter').css('padding','0px');
	
	$('#servaddbutton').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	// special setting for tab "Services"
	//$('#tab_diagrams').height(wh-90);
	$('.tabs-bottom > .ui-tabs-nav').width(ww-99);
	$('.tabs-bottom').width(ww-64);
	$('.tabs-bottom').height(wh-66);
	$('.workspace').height(wh-89);
	
	var fh = $('.fancyworkspace').height();
	var fw = $('.fancyworkspace').width();
	var wsh = wh-89;
	var wsw = ww-60;
	var scroller_h = $('.scroller_overview').height();
	var scroller_w = $('.scroller_overview').width();
	$('.scroller_region').height( (wsh/fh) * scroller_h );
	$('.scroller_region').width( (wsw/fw) * scroller_w );
	
	var scroller = $('#scroller_overview'+Service.cid);
	var o = scroller.offset();
	// Make sure that we only touch the top and right attributes and not the left attribute,
	// so that the scroller remains fixed relative to the upper-right corner of the workspace.
	if (o && o.left>0 && o.left<50) {
		scroller.css("right", (wsw-60) + "px");
	}
	if (o && o.top>0 && o.top>wsh-30) {
		var t = wsh-30;
		scroller.css("top", (t<60 ? 60 : t) + "px");
	}
}

function removetransientwindows(evt) {
	$('#nodemenu').hide();
	$('#selectmenu').hide();
	$('.popupsubmenu').hide();
	$('.actpanel').hide();
	$('.activator').removeClass('actactive');
	$('#libraryupdown').removeClass('ui-icon-triangle-1-n').addClass('ui-icon-triangle-1-s');
	$('#optionsupdown').removeClass('ui-icon-triangle-1-n').addClass('ui-icon-triangle-1-s');
}
	
function switchToProject(pid,dorefresh) {
	if (pid==Project.cid)
		return;
	$('#nodereport').dialog("close");
	$('#componentthreats').dialog("close");
	$('#checklist_tWLS').dialog("close");
	$('#checklist_tWRD').dialog("close");
	$('#checklist_tEQT').dialog("close");
	removetransientwindows();
	if (Project.get(Project.cid)!=null)
		// Project might have been deleted by libdel button
		Project.get(Project.cid).unload();
	Project.get(pid).load();
	forceSelectVerticalTab(Preferences.tab);
	if (dorefresh)
		Project.get(pid).dorefresh(false);
}

/* nid2id: translate a DOM id to a numeric id
 */
function nid2id(nid) {
	/* Remove all but the trailing digits, then parse the remainder as an integer.
	 */
	return parseInt(nid.replace(/^.*\D/i,""),10);
}

/* trimwhitespace: remove leading & trailing white space
 */
function trimwhitespace(str) {
	str = str.replace(/^\s+/,'');
	str = str.replace(/\s+$/,'');
	return str;
}

/* Add an 's' or other plural suffix to the end of a string, if necessary
 */
function plural(str,suffix,num) {
	return (num==1 ? str : (str+suffix));
}

/* Prepend string 'a' to 'b' and join with a space, unless 'a' already occurs within 'b'.
*/
function prependIfMissing(a,b) {
	a = trimwhitespace(a);
	b = trimwhitespace(b);
	if (b=="")
		return a;
	else
		return (b.indexOf(a)==-1 ? a+' '+b : b);
}

/* nextUnusedIndex: return first index that doesn't exist or is null
 */
function nextUnusedIndex(arr) {
	for (var i=0,alen=arr.length; i<alen && arr[i]!=null; i++) { /*jsl:pass*/ }
	return i;
}

/* H: make a string safe to use inside HTML code
 * MOVED TO BOTTOM OF THIS FILE.
 */

/* prettyDate: reformat the timestamp string for server projects.
 */
function prettyDate(d) {
	// Format is: YYYYMMDD HHMM SS
	//            1   2 3  4 5  6
	var r = d.match(/^(\d\d\d\d)(\d\d)(\d\d) (\d\d)(\d\d) (\d\d)$/);
	return (r==null ? d : r[3]+'-'+r[2]+'-'+r[1]+' '+r[4]+':'+r[5]);
}

/* Replacement for the standard Javascript alert() function. Several differences:
 * - it won't block the browser (only this tab)
 * - it is themeable
 * - it will take HTML content
 * - you can set the title
 */
function rasterAlert(title,msg) {
	$('#modaldialog').dialog("option", "buttons", [
	{text: "Close", click: function(){ 
		$(this).dialog("close"); 
	} }
	]);
	$('#modaldialog').dialog({
		zIndex: 9999,
		title: String(title),
		height: "auto",
		maxHeight: 600,
		// This works around bug http://bugs.jqueryui.com/ticket/4820
		open: function(event, ui) {
			$(this).css({'max-height': 600, 'overflow-y': 'auto'}); 
    	}
   	});
	$('#modaldialog').html( String(msg) );
//	$('#modaldialog').dialog({close: function() {
//	}});
	$('#modaldialog').dialog("open");
}

/* Replacement for the standard Javascript confirm() function. Several differences:
 * - it won't block the browser (only this tab)
 * - themeable, you can set the title, the buttons and the HTML content
 * - does not return true/false, but takes a callback function as its last parameter
 *   (and optionally a function to call on Cancel/deny)
 */
function rasterConfirm(title,msg,buttok,buttcancel,funcaction,funcnoaction) {
	$('#modaldialog').dialog("option", "buttons", [
	{text: buttcancel, click: function(){ 
		$(this).dialog("close"); 
		if (funcnoaction) funcnoaction();
	} },
	{text: buttok, click: function(){ 
		$(this).dialog("close"); 
		funcaction(); 
	} }
	]);
	$('#modaldialog').dialog( "option", "zIndex", 9999 );
	$('#modaldialog').dialog( "option", "title", String(title) );
	$('#modaldialog').html( String(msg) );
//	$('#modaldialog').dialog({close: function() {
//	}});
	$('#modaldialog').dialog("open");
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
}

function newRasterConfirm(title,msg,buttok,buttcancel) {
	var dfd = $.Deferred();
	$('#modaldialog').dialog("option", "buttons", [
	{text: buttcancel, click: function(){ 
		$(this).dialog("close"); 
		dfd.reject(false);
	} },
	{text: buttok, click: function(){ 
		$(this).dialog("close"); 
		dfd.resolve(true); 
	} }
	]);
	$('#modaldialog').dialog( "option", "zIndex", 9999 );
	$('#modaldialog').dialog( "option", "title", String(title) );
	$('#modaldialog').html( String(msg) );
//	$('#modaldialog').dialog({close: function() {
//	}});
	$('#modaldialog').dialog("open");
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
	return dfd.promise();
}

function bugreport(mess,funcname) {
	if (DEBUG)
		rasterAlert('Please report this bug','You found a bug in this program.\n("'+mess+'" in function "'+funcname+'").');
}

var AutoSaveTimer = null;
var SSEClient = null;
var lastSavedString;

/* Periodically check the current project for changes.
 * This function must be started when:
 *  a. activating a shared project, after having refreshed from the server-version,
 *  b. changing details of the current project from private to shared,
 *  c. on startup, when the current project is shared,
 *  d. periodically, after the project has been refreshed from the server-version,
 *  e. when going online, and the current project is shared.
 * Periodic updates must be stopped when:
 *  f. activating a private project
 *  g. when the current project becomes private
 *	h. when the tool goes offline
 *
 * Cases a/f can be combined by always calling this function after activation
 * of a project, and adding some logic at the beginning of it.
 * Cases f/g/h can be done by calling this function, using the same logic at the
 * beginning of the function.
 * 
 * When local changes are detected the current version is stored onto the server.
 * Storing can have three outcomes:
 * - success (no copy on server, or a less recent version on the server)
 *		No further action required; continue periodic checks.
 * - confirmation required (a more recent version on the server)
 *		As for overwrite, update from server, or change to private. Continue periodic
 *		checks after overwrite/update, but discontinue if the project is made private.
 * - timeout, no response from server
 *		Switch to offline mode. Issue a warning to the user. Project remains shared.
 * - error (internal server error)
 *		Switch project to private. Issue a warning to the user. Tool remains online.
 *
 * Whenever we start periodic checks for local changes to be stored on the server,
 * we must als periodically check for server changes using startWatching().
 * When the remote project is deleted by another client, watching will stop. It must
 * be restarted whenever a local change is propagated to the server again.
 *
 * If the server version is deleted by another client and the local copy is not
 * changed, then the local project will be shown as 'shared' without a server version
 * being present. 
 *
 * NOTE: There should be a smarter way of noticing changes to the project. Perhaps
 * the concept of 'actions' should be introduced, with each action signifying a single
 * change to the project. This would also make it easier to implement an Undo capability.
 */
function startAutoSave() {
//	if (AutoSaveTimer!=null) {
//		window.clearTimeout(AutoSaveTimer);
//		AutoSaveTimer = null;
		stopWatching(null);
//	}
	var p = Project.get(Project.cid);
	if (p==null || !p.shared || !Preferences.online) {
		if (Preferences!=null && !Preferences.online)
			$("#networkactivity").removeClass("activityyes activityno").addClass("activityoff");
		return;
	}
//	// Capture the initial state
//	lastSavedString = exportProject(Project.cid);
//	// Make sure it is on the server
//	p.storeIfNotPresent(lastSavedString,{});
//	// Update very 2 seconds, if modified. 
//	AutoSaveTimer = window.setTimeout(autoSaveFunction,2000);

	startWatching(p);
}

/* We use Server-Sent Events (), to prevent polling over the network. With SSE,
 * the server is doing the periodic checks locally, notifying the client when changes
 * have been made.
 */
function startWatching(p) {
//console.log("Start watching project " + p.id);
	if (SSEClient!=null) {
//console.log("  and closing previous watcher");
		SSEClient.close();
	}
	SSEClient = new EventSource("sse_projmon.php?name=" + urlEncode(p.title));
	
	SSEClient.onmessage = function(msg) {
		if (msg.data=="NO PROJECT") {
			// Project is not on the server. It probably has not been saved yet.
			// Wait a bit, then try again.
			SSEClient.close();
			SSEClient=null;
			window.setTimeout(function(){
				startWatching(p);
			},500);
		} else if (msg.data=="NOP") {
			// Sent periodically for testing connectivity. No action required
			/*jsl:pass*/
		} else  if (msg.data=="DELETED") {
			// Project has been deleted from the server
			stopWatching(Project.cid);
			p.setshared(false,false);
			removetransientwindows();
			rasterAlert('Project has been made private', 
				'Project "'+H(p.title)+'" has been deleted from the server by someone. '+
				'Your local version of the project will now be marked as private. '+
				'If you wish to share your project again, '+
				'you must set it\'s details to "Shared" yourself.<br>'+
				'<p><i>Your changes are not shared with others anymore.</i>'
			);
		} else {
			var xdetails = jQuery.parseJSON(msg.data);
			var p = Project.get(Project.cid);
			var newpid = loadFromString(xdetails.contents);
			if (newpid!=null) {
				var newp = Project.get(newpid);
				newp.shared = true;
				newp.creator = xdetails.creator;
				newp.date = xdetails.date;
				newp.description = xdetails.description;
				var t = p.title;
				p.destroy();
				newp.settitle(t);
				switchToProject(newpid);
	//			p.dorefresh(true);
			} else {
				rasterAlert('Project has been made private', 
					'The server version of project "'+H(p.title)+'" is damaged. '+
					'The project  will now be marked as private. '+
					'<p><i>Your changes are not shared with others anymore.</i>'
				);
				p.setshared(false,false);				
			}
		}
	};
	
//	SSEClient.onerror = function(msg) {
// This seems to be called without valid reason, for example when reloading the page
// when there is an active connection. It seems safe to ignore this altogether.
//		if (SSEClient!=null)
//			SSEClient.close();
//		SSEClient = null;
//		p.setshared(false,false);
//		rasterAlert('Project has been made private', 
//			'Project "'+H(p.title)+'" could not be retrieved from the server. '+
//			'It will now be marked as private. '+
//			'If you wish to share your local version of the project, '+
//			'you must set it\'s details to "Shared" yourself.<br>'+
//			'<p><i>Your changes are not shared with others anymore.</i>'
//		);
//	};
}

/* Stop monitoring a project using Server-Sent Events. Either stop a specific
 * projet using its project id, or stop whatever current watch (pid==null)
 */
function stopWatching(pid) {
//console.log("Possibly stopping project " + pid);
	if ((pid==null || pid==Project.cid) && SSEClient!=null) {
		SSEClient.close();
		SSEClient = null;
//console.log(" yup, stopping");
	}
}

function autoSaveFunction() {
	var p = Project.get(Project.cid);
	if (!p.shared || !Preferences.online) {
//		window.clearTimeout(AutoSaveTimer);
//		AutoSaveTimer=null;
		if (!Preferences.online)
			$("#networkactivity").removeClass("activityyes activityno").addClass("activityoff");
		return;
	}
	var exportstring = exportProject(p.id);
//	if (exportstring!=lastSavedString) {
		// First, stop watching the file so that we do not notify ourselves
		stopWatching(p.id);
		p.storeOnServer(false,exportstring,{
			onUpdate: function() {
				startWatching(p);
			}
		});
//		lastSavedString = exportstring;
//	}
//	AutoSaveTimer = window.setTimeout(autoSaveFunction,2000);
}

function transactionCompleted(transaction) {
//console.debug("Transaction [" + transaction + "]");
	autoSaveFunction();
}

/* loadFromString(str): with string 'str' containing an entire file, try to
 *		read and create the objects in it.
 * Shows error messages, unless 'showerrors' is false.
 *
 * Returns the id of one of the projects loaded, or null on failure.
 */
function loadFromString(str,showerrors,allowempty,strsource) {
	var lProject = [];
	var lService = [];
	var lThreat = [];
	var lComponent = [];
	var lNode = [];
	var lNodeCluster = [];
	var lThrEval = [];
	
	var res, key, val;
	var upgrade_0_1 = false;
	var patt = new RegExp(/^([^\t\n]+)\t([^\n]+)\n/);
	res=patt.exec(str);
	try {
		while (res!=null) {
			if (res.length!=3) 
				throw new Error('Invalid data format');
			key = res[1].split(':');
			if (!key || key[0]!=LS_prefix)
				throw new Error('Invalid key');
			if (key[1]!=LS_version) {
				if (key[1]==0) {
					// Can upgrade from version 0 to version 1
					upgrade_0_1 = true;
				} else {
					throw new Error("The file has version ("+key[1]+"); expected version ("+LS_version+"). You must use a more recent version of the Raster tool.");
				}
			}
			val = jQuery.parseJSON(urlDecode(res[2]));
			val.id = parseInt(key[3],10);
			switch (key[2]) {
			case 'P':
				lProject.push(val); 
				break;
			case 'S':
				lService.push(val); 
				break;
			case 'C':
				lComponent.push(val); 
				break;
			case 'T':
				lThreat.push(val); 
				break;
			case 'N':
				lNode.push(val); 
				break;
			case 'L':
				lNodeCluster.push(val); 
				break;
			case 'E':
				lThrEval.push(val); 
				break;
			case 'F':
				//lCCF.push(val); 
				// These are not used anymore in version 2. We use NodeClusters instead.
				// Silently ignore this line, and create all NodeClusters afterwards.
				break;
			case 'R':
				// Ignore all preferences for purposes of loading projects
				break;
			default:
				throw new Error("Unknown key-entry ("+res[1]+")");
				break;
			}
			str = str.substr(res[0].length);
			res=patt.exec(str);
		}
		str = jQuery.trim(str);
		if (str.length!=0) throw new Error("Invalid text");
		if (lProject.length==0 && allowempty) return null;
	}
	catch(e) {
		if (!showerrors) return null;
		var errdialog = $('<div></div>');
		var s = str.substr(0,40);
		s = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\s+/g," ");
		errdialog.append('<p>' + strsource + ' contains an error:</p>\
			<blockquote>' + e.message + '</blockquote>\
			<p>The incorrect text is:</p>\
			<blockquote>' + s + '...</blockquote>');
		errdialog.dialog({
			title: strsource + " contains an error",
			modal: true,
			width: 500,
			close: function(event, ui) { errdialog.remove(); }
		});
		return null;
	}
	
	/* File has been read. Now check for consistency */
	// Returns: 
	//  there exists j, 0<=j<arr.length, such that arr[j].id == id
	function containsID(arr,id) {
		var exists=false;
		for	(var j=0,alen=arr.length; !exists && j<alen; j++)
			exists = (arr[j].id==id);
		return exists;
	}
	// Returns:
	//  for all j, 0<=j<arr2.length, containsID(arr,arr2[j])
	function containsAllIDs(arr,arr2) {
		var forall=true;
		for	(var j=0,alen=arr2.length; forall && j<alen; j++) {
//			forall = containsID(arr,arr2[j]);	
			for	(var k=0,alen2=arr.length; !forall && k<alen2; k++) {
				forall = (arr[k].id==arr2[j]);
			}
		}
		return forall;
	}
	
	var i,j,k,n;
	var lProjectlen=lProject.length;
	var lThreatlen=lThreat.length;
	var lServicelen=lService.length;
	var lNodelen=lNode.length;
	var lNodeClusterlen=lNodeCluster.length;
	var lComponentlen=lComponent.length;
	var lThrEvallen=lThrEval.length;

	/* When upgrading from a version 0 file to version 1, all ThrEvals for CCFs
	 * should be removed completely.
	 */
	if (upgrade_0_1) {
		i=0;
		while (i<lThrEvallen) {
			if (lThrEval[i].f==null) {
				i++;
				continue;
			}
			// Delete this element
			lThrEval.splice(i,1);
			lThrEvallen--;
		}
	}
	
	try {
		if (lProjectlen==0) throw new Error("There are no projects; there must be at least one");
		if (lServicelen==0) throw new Error("There are no services; there must be at least one");
		for (i=0; i<lProjectlen; i++) {
			/* lProject[i].s[] must contain IDs of services */
			if (!containsAllIDs(lService,lProject[i].s))
				throw new Error('Project '+lProject[i].id+' has an invalid service.');
			/* lProject[i].s must not be empty */
			if (lProject[i].s.length==0)
				throw new Error('Project '+lProject[i].id+' does not contain any services.');
			/* lProject[i].t[] must contain IDs of threats */
			if (!containsAllIDs(lThreat,lProject[i].t))
				throw new Error('Project '+lProject[i].id+' has an invalid checklist vulnerability.');
		}
		for (i=0; i<lThreatlen; i++) {
			/* lThreat[i].p must be the ID of a project */
			if (!containsID(lProject,lThreat[i].p))
				throw new Error('Vulnerability '+lThreat[i].id+' does not belong to a valid project.');
			/* lThreat[i].t must be a valid type */
			if (Rules.nodetypes[lThreat[i].t]==null)
				throw new Error('Vulnerability '+lThreat[i].id+' has an invalid type.');
		}
		for (i=0; i<lServicelen; i++) {
			/* lService[i].p must be the ID of a project */
			if (!containsID(lProject,lService[i].p))
				throw new Error('Service '+lService[i].id+' does not belong to a valid project.');
		}
		for (i=0; i<lNodelen; i++) {
			/* lNode[i].t must be a valid type */
			if (Rules.nodetypes[lNode[i].t]==null)
				throw new Error('Diagram node '+lNode[i].id+' has an invalid type.');
			/* lNode[i].s must be the ID of a service */
			if (!containsID(lService,lNode[i].s))
				throw new Error('Diagram node '+lNode[i].id+' does not belong to a valid service.');
			/* lNode[i].m (if non-null) must be the ID of a Component */
			if (lNode[i].m!=null && !containsID(lComponent,lNode[i].m))
				throw new Error('Diagram node '+lNode[i].id+' does not belong to a valid component.');
			/* lNode[i].c[] must contain IDs of other Nodes */
			if (!containsAllIDs(lNode,lNode[i].c))
				throw new Error('Diagram node '+lNode[i].id+' connects to an invalid node.');
		}
		for (i=0; i<lComponentlen; i++) {
			/* lComponent[i].t must be a valid type */
			if (Rules.nodetypes[lComponent[i].t]==null)
				throw new Error('Component '+lComponent[i].id+' has an invalid type.');
			/* lComponent[i].p must be the ID of a project */
			if (!upgrade_0_1 && !containsID(lProject,lComponent[i].p))
				throw new Error('Component '+lComponent[i].id+' does not belong to a valid project.');
			/* lComponent[i].e[] must contain IDs of threat evaluations */
			if (!containsAllIDs(lThrEval,lComponent[i].e))
				throw new Error('Component '+lComponent[i].id+' has an invalid vulnerability evaluation.');
			/* lComponent[i].n[] must contain IDs of Nodes */
			if (!containsAllIDs(lNode,lComponent[i].n))
				throw new Error('Component '+lComponent[i].id+' contains an invalid node.');
			/* lComponent[i].n must not be empty */
			if (lComponent[i].n.length==0)
				throw new Error('Component '+lComponent[i].id+' does not contain any nodes.');
		}
		for (i=0; i<lThrEvallen; i++) {
			/* lThrEval[i].t must be a valid type */
			if (Rules.nodetypes[lThrEval[i].t]==null)
				throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid type.');
			/* lThrEval[i].m, if non-null, must be the ID of a Component */
			if (lThrEval[i].m!=null && !containsID(lComponent,lThrEval[i].m))
				throw new Error('Vulnerability assessment '+lThrEval[i].id+' does not belong to a valid component.');
			/* lThrEval[i].u, if non-null, must be the ID of a NodeCluster */
			if (lThrEval[i].u!=null && !containsID(lNodeCluster,lThrEval[i].u))
				throw new Error('Vulnerability assessment '+lThrEval[i].id+' does not belong to a valid cluster.');
			/* lThrEval[i].p must be a valid frequency/impact string */
			if (jQuery.inArray(lThrEval[i].p, ThreatAssessment.values)==-1)
				throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid frequency.');
			/* lThrEval[i].i must be a valid frequency/impact string */
			if (jQuery.inArray(lThrEval[i].i, ThreatAssessment.values)==-1)
				throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid impact.');
		}
		for (i=0; i<lNodeClusterlen; i++) {
			/* lNodeCluster[i].t must be a valid type */
			if (Rules.nodetypes[lNodeCluster[i].t]==null)
				throw new Error('Node cluster '+lNodeCluster[i].id+' has an invalid type.');
			/* lNodeCluster[i].p must be the ID of a project */
			if (!containsID(lProject,lNodeCluster[i].p))
				throw new Error('Node cluster '+lNodeCluster[i].id+' does not belong to a valid project.');
			/* lNodeCluster[i].u must be the ID of a node cluster */
			if (lNodeCluster[i].u!=null && !containsID(lNodeCluster,lNodeCluster[i].u))
				throw new Error('Node cluster '+lNodeCluster[i].id+' has an invalid parent.');
			/* lNodeCluster[i].c[] must contain IDs of node cluster */
			if (!containsAllIDs(lNodeCluster,lNodeCluster[i].c))
				throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid child cluster.');
			/* lNodeCluster[i].n[] must contain IDs of Nodes */
			if (!containsAllIDs(lNode,lNodeCluster[i].n))
				throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid node.');
			/* lNodeCluster[i].e must be the ID of a threat assessment */
			if (!containsID(lThrEval,lNodeCluster[i].e))
				throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid vulnerability evaluation.');
		}
	}
	catch (e) {
		if (!showerrors) return null;
		errdialog = $('<div></div>');
		errdialog.append('<p>' + strsource + ' contains an error:</p>\
			<blockquote>' + e.message + '</blockquote>');
		errdialog.dialog({
			title: strsource + " is not valid",
			modal: true,
			width: 500,
			close: function(event, ui) { errdialog.remove(); }
		});
		return null;
	}
	
	for (i=0; i<lThrEvallen; i++) {
		if (lThrEval[i].t!='tUNK') continue;
		// Due to a bug, version 0 files may contain ThreatAssessment objects with type tUNK
		// Try to locate the proper type, else default to tEQT
		var conv = false;
		for (j=0; j<lThreatlen; j++) {
			if (lThreat[j].l==lThrEval[i].l) {
				// got it!
				lThrEval[i].t=lThreat[j].t;
				conv=true;
				break;
			}
		}
		if (!conv)
			lThrEval[i].t = 'tEQT';
	}
	
	/* We loaded data into arrays lProject lService lThreat lNode lNodeCluster lThrEval
	 * that seems to make sense.
	 *
	 * In order to merge these objects into the existing sets, we must make
	 * sure that IDs of the new objects do not conflict with existing ones.
	 * The way we execute this: 
	 * a) create a combined list of all IDs, both current and new.
	 * b) step through the new objects
	 *   c) if the ID of the new object conflicts with an existing one:
	 *	 d) find the lowest unused ID in the combined list
	 *	 e) rekey the new object to use the ID thus found (change the id of this 
	 *		  object, and all other objects that might refer to this one).
	 *	 f) add the new ID to the combined list
	 * Rekeying means that we must also rekey the relevant properties in this
	 * and other objects.
	 */
	/* a) */
	combined = [];
	for (i=0; i<lProjectlen; i++) combined.push(lProject[i].id);
	for (i=0; i<Project._all.length; i++) {
		if (Project._all[i]) combined.push(Project._all[i].id);
	}
	/* b) */
	for (i=0; i<lProjectlen; i++) {
		/* c) */
		if (Project._all[lProject[i].id]==null) continue;
		/* d) */
		lu = lowestunused(combined);
		/* e) Rekey from .id to lu 
		 * Threat.project, Service.project, NodeCluster.project, Component.project, and this Project.id
		 */
		for (k=0; k<lThreatlen; k++) {
			if (lThreat[k].p==lProject[i].id) lThreat[k].p=lu;
		}
		for (k=0; k<lServicelen; k++) {
			if (lService[k].p==lProject[i].id) lService[k].p=lu;
		}
		for (k=0; k<lNodeClusterlen; k++) {
			if (lNodeCluster[k].p==lProject[i].id) lNodeCluster[k].p=lu;
		}
		for (k=0; k<lComponentlen; k++) {
			if (lComponent[k].p==lProject[i].id) lComponent[k].p=lu;
		}
		lProject[i].id = lu;
		/* f) */
		combined.push(lu);
	}

	combined = [];
	for (i=0; i<lThreatlen; i++) combined.push(lThreat[i].id);
	for (i=0; i<Threat._all.length; i++) {
		if (Threat._all[i]) combined.push(Threat._all[i].id);
	}
	for (i=0; i<lThreatlen; i++) {
		if (Threat._all[lThreat[i].id]==null) continue;
		lu = lowestunused(combined);
		// Project.threats[], and this Threat.id
		for (k=0; k<lProjectlen; k++) {
			for (n=0; n<lProject[k].t.length; n++) {
				if (lProject[k].t[n]==lThreat[i].id) lProject[k].t[n]=lu;
			}
		}
		lThreat[i].id = lu;
		combined.push(lu);
	}

	var combined = [];
	var lu;
	for (i=0; i<lServicelen; i++) combined.push(lService[i].id);
	for (i=0; i<Service._all.length; i++) {
		if (Service._all[i]) combined.push(Service._all[i].id);
	}
	for (i=0; i<lServicelen; i++) {
		if (Service._all[lService[i].id]==null) continue;
		lu = lowestunused(combined);
		/* Project.services[], Node.service, and this Service.id */
		for (k=0; k<lProjectlen; k++) {
			for (n=0; n<lProject[k].s.length; n++) {
				if (lProject[k].s[n]==lService[i].id) lProject[k].s[n]=lu;
			}
		}
		for (k=0; k<lNodelen; k++) {
			if (lNode[k].s==lService[i].id) lNode[k].s=lu;
		}
		lService[i].id = lu;
		combined.push(lu);
	}

	combined = [];
	for (i=0; i<lNodelen; i++) combined.push(lNode[i].id);
	for (i=0; i<Node._all.length; i++) {
		if (Node._all[i]) combined.push(Node._all[i].id);
	}
	for (i=0; i<lNodelen; i++) {
		if (Node._all[lNode[i].id]==null) continue;
		lu = lowestunused(combined);
		// Node.connect[], Component.nodes[], NodeCluster.childnodes[], and this Node.id
		for (k=0; k<lNodelen; k++) {
			for (n=0; n<lNode[k].c.length; n++) {
				if (lNode[k].c[n]==lNode[i].id) lNode[k].c[n]=lu;
			}
		}
		for (k=0; k<lComponentlen; k++) {
			for (n=0; n<lComponent[k].n.length; n++) {
				if (lComponent[k].n[n]==lNode[i].id) lComponent[k].n[n]=lu;
			}
		}
		for (k=0; k<lNodeClusterlen; k++) {
			for (n=0; n<lNodeCluster[k].n.length; n++) {
				if (lNodeCluster[k].n[n]==lNode[i].id) lNodeCluster[k].n[n]=lu;
			}
		}
		lNode[i].id = lu;
		combined.push(lu);
	}

	combined = [];
	for (i=0; i<lComponentlen; i++) combined.push(lComponent[i].id);
	for (i=0; i<Component._all.length; i++)  {
		if (Component._all[i]) combined.push(Component._all[i].id);
	}
	for (i=0; i<lComponentlen; i++) {
		if (Component._all[lComponent[i].id]==null) continue;
		lu = lowestunused(combined);
		// Node.component, ThreatAssessment.component, and this Component.id
		for (k=0; k<lNodelen; k++) {
			if (lNode[k].m==lComponent[i].id) lNode[k].m=lu;
		}
		for (k=0; k<lThrEvallen; k++) {
			if (lThrEval[k].m==lComponent[i].id) lThrEval[k].m=lu;
		}
		lComponent[i].id = lu;
		combined.push(lu);
	}

	combined = [];
	for (i=0; i<lThrEvallen; i++) combined.push(lThrEval[i].id);
	for (i=0; i<ThreatAssessment._all.length; i++)  {
		if (ThreatAssessment._all[i]) combined.push(ThreatAssessment._all[i].id);
	}
	for (i=0; i<lThrEvallen; i++) {
		if (ThreatAssessment._all[lThrEval[i].id]==null) continue;
		lu = lowestunused(combined);
		// Component.thrass[], NodeCluster.thrass and this ThreatAssessment.id
		for (k=0; k<lComponentlen; k++) {
			for (n=0; n<lComponent[k].e.length; n++) {
				if (lComponent[k].e[n]==lThrEval[i].id) lComponent[k].e[n]=lu;
			}
		}
		for (k=0; k<lNodeClusterlen; k++) {
			if (lNodeCluster[k].e==lThrEval[i].id) lNodeCluster[k].e=lu;
		}
		lThrEval[i].id = lu;
		combined.push(lu);
	}

	combined = [];
	for (i=0; i<lNodeClusterlen; i++) combined.push(lNodeCluster[i].id);
	for (i=0; i<NodeCluster._all.length; i++)  {
		if (NodeCluster._all[i]) combined.push(NodeCluster._all[i].id);
	}
	for (i=0; i<lNodeClusterlen; i++) {
		if (NodeCluster._all[lNodeCluster[i].id]==null) continue;
		lu = lowestunused(combined);
		// ThreatAssessment.cluster, NodeCluster.parentcluster, NodeCluster.childclusters and NodeCluster.id
		for (k=0; k<lThrEvallen; k++) {
			if (lThrEval[k].u==lNodeCluster[i].id) lThrEval[k].u=lu;
		}
		for (k=0; k<lNodeClusterlen; k++) {
			if (lNodeCluster[k].u==lNodeCluster[i].id) lNodeCluster[k].u=lu;
		}
		for (k=0; k<lNodeClusterlen; k++) {
			for (n=0; n<lNodeCluster[k].c.length; n++) {
				if (lNodeCluster[k].c[n]==lNodeCluster[i].id) lNodeCluster[k].c[n]=lu;
			}
		}
		lNodeCluster[i].id = lu;
		combined.push(lu);
	}
	
	/* All lProject[], lService[] etc do have IDs that do not conflict with
	 * existing Project, Service etc objects.
	 * It is safe to create new objects now.
	 */
	if (upgrade_0_1) {
		var nodesforthreat = {};
		for (var typ in Rules.nodetypes) {
			if (typ=='tUNK') continue;
			if (typ=='tACT') continue;
			nodesforthreat[typ] = {};
		}
	}
	
	for (i=0; i<lServicelen; i++) {
		var ls = lService[i];
		s = new Service(ls.id);
		s.project = ls.p;
		s.settitle(ls.l);
	}
	for (i=0; i<lThreatlen; i++) {
		var lth = lThreat[i];
		var th = new Threat(lth.t,lth.id);
		th.setproject(lth.p);
		th.settitle(lth.l);
		th.setdescription(lth.d);
		th.store();
		if (upgrade_0_1) {
			if (!nodesforthreat[lth.t][lth.p])
				nodesforthreat[lth.t][lth.p] = {};
			nodesforthreat[lth.t][lth.p][lth.l] = [];
		}
	}
	for (i=0; i<lProjectlen; i++) {
		var lp = lProject[i];
		var p = new Project(lp.id);
		// Avoid Project.settitle, as it can modify Preferences.
		p.settitle(String(lp.l));
		p.shared = (lp.a===true);
		if (lp.d) p.description = lp.d;
		if (lp.w) p.date = lp.w;
		for (k=0; k<lp.s.length; k++)
			p.addservice(lp.s[k]);
		p.threats = lp.t;
		if (lp.c && lp.c.length==7)
			p.labels = lp.c;
		p.store();
	}
	for (i=0; i<lNodelen; i++) {
		var lrn = lNode[i];
		var rn = new Node(lrn.t,lrn.id);
		rn.title = trimwhitespace(lrn.l);
		rn.service = lrn.s;
		rn.position = {x: lrn.x, y: lrn.y, width: lrn.w, height: lrn.h};
		rn._normw = lrn.v;
		rn._normh = lrn.g;
		rn.component = lrn.m;
		rn.connect = lrn.c;
		if (lrn.o)
			rn.color = lrn.o;
		rn.store();
	}
	for (i=0; i<lComponentlen; i++) {
		var lc = lComponent[i];
		var cm = new Component(lc.t,lc.id);
		cm.thrass = lc.e;
		cm.nodes = lc.n;
		cm.single = (lc.s===true);
		cm.accordionopened = (lc.o===true);
		if (!lc.p) {
			// project wasn't stored, because we upgraded from a version 1 localStorage.
			// Get the project of the service of the first node.
			// First, locate the first node
			for (j=0; j<lNodelen && lNode[j].id!=lc.n[0]; j++) { /*jsl:pass*/ }
			// Second, locate that node's service
			for (k=0; k<lServicelen && lService[k].id!=lNode[j].s; k++) { /*jsl:pass*/ }
			lc.p = lService[k].p;
		}
		cm.project = lc.p;
		cm.settitle(lc.l);
		// Delay calculation until ThrEvals have been loaded
		//cm.calculatemagnitude();
	}
	for (i=0; i<lThrEvallen; i++) {
		var lte = lThrEval[i];
		var te = new ThreatAssessment(lte.t,lte.id);
		te.settitle(lte.l);
		te.setdescription(lte.d);
		te.freq=lte.p;
		te.impact=lte.i;
		te.description=lte.d;	
		te.remark=lte.r;	
		te.computetotal();
		te.component=lte.m;
		te.cluster=lte.u;
		te.store();
		if (upgrade_0_1) {
			/* We need to know the project to which this ThreatAssessment belongs.
			 * Take the project of the component.
			 */
			for (j=0; j<lComponentlen && lComponent[j].id!=lte.m; j++) { /*jsl:pass*/ }
			var pid = lComponent[j].p;
			if (lte.t=='tUNK') {
				/* Do it for all node types (except tUNK and tACT */
				for (typ in Rules.nodetypes) {
					if (typ=='tUNK') continue;
					if (typ=='tACT') continue;
					if (!nodesforthreat[typ][pid]) nodesforthreat[typ][pid] = {};
					nodesforthreat[typ][pid][lte.l] = [];
				}
			} else {
				if (!nodesforthreat[lte.t][pid])
					nodesforthreat[lte.t][pid] = {};
				nodesforthreat[lte.t][pid][lte.l] = [];
			}
		}
	}
	for (i=0; i<lNodeClusterlen; i++) {
		var lnc = lNodeCluster[i];
		var nc = new NodeCluster(lnc.t,lnc.id);
		nc.title = lnc.l;
		nc.project = lnc.p;
		nc.parentcluster = lnc.u;
		nc.childclusters = lnc.c;
		nc.childnodes = lnc.n;
		nc.thrass = lnc.e;
		nc.accordionopened = (lnc.o===true);
		//nc.calculatemagnitude(); // Not all childclusters may have been loaded
		nc.store();
	}
	for (i=0; i<lComponentlen; i++) {
		cm = Component.get( lComponent[i].id );
		cm.calculatemagnitude();
	}
	for (i=0; i<lNodeClusterlen; i++) {
		nc = NodeCluster.get( lNodeCluster[i].id );
		nc.calculatemagnitude();
	}

	/* If we are upgrading from 0 to 1, then we need to populate nodesforthreat */
	if (upgrade_0_1) {
		for (i=0; i<lComponentlen; i++) {
			cm = Component.get(lComponent[i].id);
			for (j=0; j<cm.thrass.length; j++) {
				th = ThreatAssessment.get(cm.thrass[j]);
				for (k=0; k<cm.nodes.length; k++) {
					if (th.type=='tUNK') {
						for (typ in Rules.nodetypes) {
							if (typ=='tUNK') continue;
							if (typ=='tACT') continue;
							if (nodesforthreat[typ][cm.project][th.title].indexOf(cm.nodes[k])==-1)
								nodesforthreat[typ][cm.project][th.title].push(cm.nodes[k]);
						}
					} else {
						if (nodesforthreat[th.type][cm.project][th.title].indexOf(cm.nodes[k])==-1)
							nodesforthreat[th.type][cm.project][th.title].push(cm.nodes[k]);
					}
				}
			}
		}

		// Create all NodeClusters for the first time
		for (i in nodesforthreat) {			// type
			if (i=='tUNK')
				bugreport("Cannot create NodeCluster of type tUNK","loadFromString");
			for (j in nodesforthreat[i]) {			// project
			for (k in nodesforthreat[i][j]) {		// threat
				if (nodesforthreat[i][j][k].length>0) {
					var cl = new NodeCluster(i);
					cl.project = parseInt(j,10);
					cl.childnodes = cl.childnodes.concat(nodesforthreat[i][j][k]);
					cl.addthrass();
					cl.settitle(k);
				}
			}}
		}
	}
	
	return lProject[0].id;
}

/* Find the lowest unused number in arr. Array arr must not contain negative numbers.
 */
function lowestunused(arr) {
	var lu = 0;
	arr.sort(function(a,b){return a - b;});
	for (var i=0,alen=arr.length; i<alen; i++) {
		if (lu<arr[i])
			break;
		else
			lu=arr[i]+1;
	}
	return lu;
}

/* singleProjectExport(p): save all data into a local file.
 */
var NodeExported = [];
var ComponentExported = [];
//var ClusterExported = [];

function singleProjectExport(p) {
	var proj = Project.get(p);
	var s = exportProject(p);
//	var url = "data:text/x-raster;," + urlEncode(s);
//	document.location.assign(url);

	$('#exp_name').val(proj.title);
	$('#exp_contents').val(s);
	$('#exp_form').submit();

//	if (request.status == 200)  
//	  console.log(request.responseText);	
}

function exportProject(pid) {
	var p = Project.get(pid);
	// We must ignore the date on export. It must be preserved in localStorage, but
	// like the creator it is not part of the project data. It is metadata, stored
	// and retrieved by the server separately from the project data.
	var olddate = p.date;
	p.date = "";
	var s = p.exportstring();
	p.date = olddate;
	NodeExported = [];
	ComponentExported = [];
	for (i=0; i<p.threats.length; i++)
		s += exportThreat(p.threats[i]);
	for (var i=0; i<p.services.length; i++)
		s += exportService(p.services[i]);
	var it = new NodeClusterIterator({project: pid});
	for (it.first(); it.notlast(); it.next())
		s += exportNodeCluster(it.getNodeClusterid());
	return s;
}

function exportThreat(th) {
	var s = Threat.get(th).exportstring();
	return s;
}

function exportService(sid) {
	var s = Service.get(sid).exportstring();
	var it = new NodeIterator({service: sid});
	for (it.first(); it.notlast(); it.next())
		s += exportNode( it.getnodeid() );
	return s;
}

function exportNode(n) {
	if (jQuery.inArray(n,NodeExported)>-1)
		return "";
	var rn = Node.get(n);
	var s = rn.exportstring();
	NodeExported.push(n);
	for (var i=0; i<rn.connect.length; i++)
		s += exportNode(rn.connect[i]);
	if (rn.component!=null)
		s += exportComponent(rn.component);
	return s;
}

function exportComponent(c) {
	if (jQuery.inArray(c,ComponentExported)>-1)
		return "";
	var cm = Component.get(c);
	var s = cm.exportstring();
	ComponentExported.push(c);
	for (var i=0; i<cm.nodes.length; i++)
		s += exportNode(cm.nodes[i]);
	for (i=0; i<cm.thrass.length; i++)
		s += exportThreatAssessment(cm.thrass[i]);
	return s;
}

function exportThreatAssessment(te) {
	var s = ThreatAssessment.get(te).exportstring();
	return s;
}

function exportNodeCluster(ncid) {
//	if (jQuery.inArray(ncid,ClusterExported)>-1)
//		return "";
	var nc = NodeCluster.get(ncid);
	var s = nc.exportstring();
//	ClusterExported.push(ncid);
	s += exportThreatAssessment(nc.thrass);
//	for (var i=0; i<nc.childclusters.length; i++)
//		s += exportNodeCluster(nc.childclusters[i]);
	return s;
}

/* exportAll: save all data into a local file.
 */
function exportAll() {
	var s = "", alen=localStorage.length;
	for (var i=0; i<alen; i++) {  
		var key = localStorage.key(i);
		s+= key+'\t';
		s+= localStorage[key]+'\n';
	}  
	var url = "data:text/x-raster;," + urlEncode(s);
	document.location.assign(url);
}

function forceSelectVerticalTab(n) {
	var ui={panel: {id: "tab_"}, index: n};
	vertTabSelected({}, ui);
}

/* vertTabSelected(event,ui)
 * Event 'event' selects the vertical tab 'ui' of the main window.
 */
function vertTabSelected(event, ui) {
	removetransientwindows();
	/* ui.panel is the DOM object with id tab_projects, tab_active_p, tab_diagrams, tab_singlefs, tab_ccfs
	 * ui.index is 0, 1, 2, 3, 4 (corresponding with the tab names above).
	 * Unfortunately, thus event handler is also called for the service diagram tabs,
	 * so we first check for that (their tabs are called diagram<nn> instead of tab_<ss>).
	 */
	if (!ui.panel.id.match(/^tab_/))
		// A horizontal tab was selected. Let's get out of here.
		return;
//	$('body').css('cursor','progress'); // this does not seem to be effective, at least not on FF4
	$('#nodereport').dialog("close");
	$('#componentthreats').dialog("close");
	$('#checklist_tWLS').dialog("close");
	$('#checklist_tWRD').dialog("close");
	$('#checklist_tEQT').dialog("close");
	$('#anareport').dialog("close");

	switch (ui.index) {
	case 0:		// tab Services
		$('#templates').show();
		// Switch to the right service. A new service may have been created while working
		// in the Single Failures tab.
		$('#diagrams_body').tabs('select', '#diagrams'+Service.cid);
		// Paint, if the diagram has not been painted already
		Service.get(Service.cid).paintall();
		Preferences.settab(0);
		break;
	case 1:		// tab Single Failures
		$('#selectrect').hide();
		$('#templates').hide();
		$('#singlefs_body').tabs('select', '#singlefs'+Service.cid);
		// Force repainting of that tab
		paintSingleFailures( Service.get(Service.cid) );
		Preferences.settab(1);
		break;
	case 2:		// tab Common Cause Failures
		$('#selectrect').hide();
		$('#templates').hide();
		$('#ccfs_body').empty();
		AddAllClusters();
		Preferences.settab(2);
		break;
	case 3:		// tab Analysis
		$('#selectrect').hide();
		$('#templates').hide();
		AddAllAnalysis();
		Preferences.settab(3);
		break;
	default:
		bugreport('unknown tab encountered','vertTabSelected');
	}
//	$('body').css('cursor','default');
}

function initLibraryPanel() {
	$('#libactivate').attr('title','Continue working with the selected project.');
	$('#libprops').attr('title','Change the name, description, and sharing status of the selected project.');
	$('#libexport').attr('title','Save the selected project to a file.');
	$('#libdel').attr('title','Permanently remove the selected project.');
	$('#libmerge').attr('title','Join the selected project into the current one.');
	$('#libadd').attr('title','Add a new, blank project to the library.');
	$('#libimport').attr('title','Load a project from a file.');
	$('#libexportall').attr('title','Save all projects into a single file.');
	$('#libzap').attr('title','Permanently remove all projects.');
	$('#libcheck').attr('title','Check the project for internal consistency.');

	// Activate --------------------
	$('#libactivate').click( function() {
		var p = Project.get( $('#libselect option:selected').val() );
		if (!p.stub) {
			switchToProject(p.id,true);
		} else {
			// Activating a stub project.
			// Make sure that there is no local project with that name
			if (Project.withTitle(p.title)!=null) {
				rasterAlert('That project name is used already',
					'There is already a project called "'+H(p.title)+'". '+
					'Please rename that project first.'
				);
			} else {
				// Do a retrieve operation, and switch to that new project, if successful.
				Project.retrieve(p.id,function(newpid){
					switchToProject(newpid);
					startAutoSave();
				});
			}
		}
		$('#libactivate').removeClass('ui-state-hover');
	});
	// Details --------------------
	$('#libprops').click( function() {
		var p = Project.get( $('#libselect option:selected').val() );
		var dialog = $('<div></div>');
		var snippet ='\
			<form id="form_projectprops">\n\
			Title:<br><input id="field_projecttitle" name="fld" type="text" size="65" value="_PN_"><br>\n\
			<div id="stubdetails" style="display:_DI_;">Creator: _CR_, last stored on _DA_.<br><br></div>\n\
			Description:<br><textarea id="field_projectdescription" cols="63" rows="2">_PD_</textarea><br>\n\
			<div id="sh_onoff"><input type="radio" id="sh_off" value="off" name="sh_onoff"><label for="sh_off">Private</label>\n\
			<input type="radio" id="sh_on" value="on" name="sh_onoff"><label for="sh_on">Shared</label></div>\n\
			</form>\
		';
		snippet = snippet.replace(/_PN_/g, H(p.title));
		snippet = snippet.replace(/_PD_/g, H(p.description));
		snippet = snippet.replace(/_CR_/g, (p.shared && !p.stub ? H(Preferences.creator) : H(p.creator)));
		snippet = snippet.replace(/_DA_/g, H(prettyDate(p.date)));
		snippet = snippet.replace(/_DI_/g, (p.stub||p.shared ? 'block' : 'none'));
		dialog.append(snippet);
		dialog.dialog({
			title: "Properties for project '" + H(p.title) + "'",
			modal: true,
			position: [90,130],
			width: 480,
			height: 265,
			buttons: {
				"Change properties": function() {
					if (!p.stub) {
						var fname = $('#field_projecttitle');
						p.settitle(fname.val());
						if (Project.cid==p.id) {
							$('.projectname').html(H(p.title));
							Preferences.setcurrentproject(p.title);
						}
						fname = $('#field_projectdescription');
						p.setdescription(fname.val());
						// Before changing the sharing status from 'private' to 'shared', first 
						// check if there already is a project with this name. If so, refuse to rename.
						var becomesShared; 
						// This is ugly. The .checked status does not get updated when the radio buttons
						// are clicked. It should. Instead, look at the visual state of the labels. Fragile.
						becomesShared = ($('label[for=sh_on]').attr('aria-pressed')=="true");
						if (!p.shared && becomesShared) {
							var it = new ProjectIterator({title: p.title, stubsonly: true});
							if (it.notlast()) {
								rasterAlert("Cannot share this project yet",
									"There is already a project named '"
									+H(p.title)
									+"' on the server. You must rename this project before it can be shared."
								);	
							} else {
								// transactionCompleted() will take care of the server, if project p is the current project.
								p.setshared(becomesShared,(p.id!=Project.cid)); 
//								if (p.id == Project.cid)
//									startAutoSave();
							}
						} else if (p.shared && !becomesShared) {
							// Stop watching the project, or we will notify ourselves about its deletion
							stopWatching(p.id);
							p.setshared(becomesShared,true);
						}
						$(this).dialog("close");
						populateProjectList();
						transactionCompleted("Project props change");
					} else {
						// Not implemented yet.
						rasterAlert('Cannot change project on server','This function is not implemented yet.');
					}
				},
				Cancel: function() {
					$(this).dialog("close");
				}
			},
			open: function() {
				$('#sh_onoff').buttonset();
//				$( (p.shared?'#sh_on':'#sh_off')).attr("checked","checked");
				$('#sh_off')[0].checked = !p.shared;
				$('#sh_on')[0].checked = p.shared;
				$('input[name="sh_onoff"]').button("refresh");
				$('#field_projecttitle').focus().select();
				$('#form_projectprops').submit(function() {
					// Ignore, must close with dialog widgets
					return false;
				});
			},
			close: function(event, ui) {
				dialog.remove();
				$('#libselect').focus();
			}
		});
	});
	// Export --------------------
	$('#libexport').click( function() {
		var p = Project.get( $('#libselect option:selected').val() );
		if (!p.stub) {
			singleProjectExport($('#libselect option:selected').val());
		} else {
			// First retrieve the project, then start exporting it
			Project.retrieve(p.id,function(newpid){
				if (newpid==null) {
					rasterAlert('Invalid project received from server',
						'The project "'+H(p.title)+'" was retrieved from the server but contained invalid data.'
					);
					return;
				}
				populateProjectList();
				singleProjectExport(newpid);
			});
		}
		$('#libselect').focus();
		$('#libexport').removeClass('ui-state-hover');
	});
	// Delete --------------------
	$('#libdel').click( function(evt){
		var p = Project.get( $('#libselect option:selected').val() );
		var dokill = function() {
			$('#libdel').removeClass('ui-state-hover');
			if (p.shared || p.stub) {
				// Disable the project watch. Otherwise a notification would be triggered.
				stopWatching(p.id);
				// remove from the server
				p.deleteFromServer();
			}
			if (p.id==Project.cid) {
				p.destroy();
				p = Project.firstProject();
				// Add a blank project if none would be left
				if (p===0) 
					loadDefaultProject();
				else
					switchToProject(p.id);
			} else {
				p.destroy();
			}
			populateProjectList();
		};
		newRasterConfirm('Delete project?',
		'Are you sure you want to remove project <i>"'+H(p.title)+'"</i>?\n<strong>This cannot be undone.</strong>',
		'Remove','Cancel'
		).done(function() {
			var t=p.totalnodes();
			if (t>2) {
				newRasterConfirm('Delete project?',
					'This project has '+t+' nodes.\nAre you <i>really</i> sure you want to discard these?',
					'Yes, really remove','Cancel')
				.done(dokill);
			} else {
				dokill();
			}
			$('#libselect').val(Project.cid).focus().change();
		})
		.fail(function () {
			$('#libselect').focus();
		});
	});
	// Merge --------------------
	$('#libmerge').click( function() {
		var otherproject = Project.get( $('#libselect option:selected').val() );
		if (otherproject.stub) {
			rasterAlert("Cannot merge a remote project","This tool currently cannot merge remote projects. Activate that project first, then try to merge again.");
			return;
		}
		var currentproject = Project.get( Project.cid );
		rasterConfirm('Merge "'+H(otherproject.title)+'" into "'+H(currentproject.title)+'"?',
			'Are you sure you want to fold project <i>"'
				+H(otherproject.title)
				+'"</i> into the current project?\nThis will copy the diagrams of <i>"'
				+H(otherproject.title)
				+'"</i> into <i>"'
				+H(currentproject.title)
				+'"</i>.',
			'Merge','Cancel',
			function() {
				Project.merge(currentproject,otherproject);
				$('#libselect').val(Project.cid).focus().change();
		});
	});

	// select --------------------
	$('#libselect').change( function(){
		var p = Project.get( $('#libselect option:selected').val() );
		$('#libactivate').button('option','disabled',p.id==Project.cid);
		$('#libmerge').button('option','disabled',p.id==Project.cid);
		$('#libselect option').css("background-image","");
		$('#libselect option[value='+Project.cid+']').css("background-image","url(../img/selected.png)");
	});
	$('#libselect').dblclick( function(){
		$('#libactivate').click();
	});
	
	// Add --------------------
	$('#libadd').click( function(){
		var p = new Project();
		var s = new Service();
		p.adddefaultthreats();
		p.addservice(s.id);
		s.autosettitle();
		p.autosettitle();
		populateProjectList();
		$('#libselect').val(p.id).focus().change();
		transactionCompleted("Project add");
	});
	// Import --------------------
	$('#libimport').click( function() {
		$('#libimport').removeClass('ui-state-hover');
		$('#body').unbind('click');
		$('#fileElem').click();
		$('#body').click( function(){ return false; });
	});
	$('#fileElem').change( function(event) {
		var files = event.target.files;
		if (files.length==null || files.length==0) return;
		var reader = new FileReader();
		reader.onload = function(evt) {
			var newp = loadFromString(evt.target.result,true,false,'File "'+files[0].name+'"');
			if (newp!=null) {
				// Make sure the newly imported project is indeed private
				var p = Project.get(newp);
				p.setshared(false,false);
				switchToProject(newp);
			}
			// Remove the default project, as long as it is still unmodified??
			transactionCompleted("Project add");
		};
		reader.readAsText(files[0]);
	});
	// Export all --------------------
	$('#libexportall').click( function() {
		$('#libexportall').removeClass('ui-state-hover');
		exportAll(); 
	});
	// Zap! --------------------
	$('#libzap').click( function(){
		rasterConfirm('Delete all?',
			"This will delete all your projects and data.\n\nYou will lose all your unsaved work!\n\nAre you sure you want to proceed?",
			'Erase everything','Cancel',
			function() {
				rasterConfirm('Delete all?',
					"Really sure? You will lose <b>all private</b> projects!\n",
					'Yes, really erase all','Cancel',
					function() {
						localStorage.clear();
						// Preserve the user's preferences
						Preferences.settab(0);
						window.location.reload();
					}
				);
			}
		);
	});
	// Check --------------------
	$('#libcheck').click( function() {
		var errors = "";
		var n = 0;
		var it = new ProjectIterator();
		it.sortByTitle();
		for (it.first(); it.notlast(); it.next()) {
			var p = it.getproject();
			n++;
			var err = p.internalCheck();
			if (err!="") {
				var e = err.split('\n');
				e.sort();
				if (errors!="")
					errors += "<p>";
				errors += "Project <i>"+H(p.title)+"</i>:\n" + e.join('<br>\n');
			}
		}
		if (errors=="")
			errors = "There were no errors; all projects are OK.\n";
		rasterAlert("Checked "+n+" projects", errors);
		$('#libcheck').removeClass('ui-state-hover');
		$('#libselect').focus(); // Won't work, because the alert is still active.
	});

	// panel activator --------------------
	$('#libraryactivator').hover( function() {
		$('#libraryactivator').removeClass('actnormal').addClass('acthigh');
		// If one of the other panels was open, then close that panel and open this one,
		// without requiring a click.
		if ($('#optionspanel').css('display')!='none') {
			$('#libraryactivator').click();
		}
	}, function() {
		$('#libraryactivator').removeClass('acthigh').addClass('actnormal');
	});
	$('#libraryactivator').click( function() {
		if ($('#librarypanel').css('display')=='none') {
			var it = new ProjectIterator({stubsonly: false});
			var nump = it.number();
			nump += 4; // Allow space for option group titles.
			if (nump<8) nump=8;
			if (nump>15) nump=15;
			$('#libselect').attr("size",nump);
			removetransientwindows();
			$('#librarypanel').show();
			// Show project list using current stubs, but do fire an update
			populateProjectList();
			Project.updateStubs(refreshProjectList);
			startPeriodicProjectListRefresh();
			if ($('#optionspanel').css('display')!='none') $('#optionsactivator').click();
			$('#libraryactivator').addClass('actactive');
			$('#libraryupdown').removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-n');
//			$('#librarypanel').click( function(){ return false; });
		} else {
			removetransientwindows();
		}
		return false;
	});
}

function populateProjectList() {
	var snippet = "";
	var newoptions = "";
	var p;
	var it = new ProjectIterator();
	it.sortByTitle();
	// First all private projects
	for (it.first(); it.notlast(); it.next()) {
		p = it.getproject();
		if (p.stub || p.shared)
			continue;
		if (snippet=="")
			snippet = '<optgroup class="optgroup" label="Private projects">\n';
		snippet += '<option value="'+p.id+'" title="'+p.description+'">'+p.title+'</option>\n';
	}
	if (snippet!="")
		snippet += '</optgroup>\n';
	newoptions += snippet;
	//	 Then all shared projects
	snippet = "";
	for (it.first(); it.notlast(); it.next()) {
		p = it.getproject();
		if (p.stub || !p.shared)
			continue;
		if (snippet=="")
			snippet = '<optgroup class="optgroup" label="Shared projects">\n';
		snippet += '<option value="'+p.id+'" title="'+p.description+'">'+p.title+'</option>\n';
	}
	if (snippet!="")
		snippet += '</optgroup>\n';
	newoptions += snippet;
	$('#libselect').html(newoptions);
	// Finally all stubs projects
	refreshProjectList();
	// Select the current project, and enable/disable the buttons
	$('#libselect').val(Project.cid).focus().change();
}

var ProjectListTimer;

function startPeriodicProjectListRefresh() {
	if (ProjectListTimer!=null)
		return;
	// Update very 6 seconds. Must be more than the default Ajax timeout is 5 seconds.
	ProjectListTimer = window.setInterval(function() {
		if ($('#librarypanel').css('display')=='none') {
			window.clearInterval(ProjectListTimer);
			ProjectListTimer=null;
			return;
		}
		Project.updateStubs(refreshProjectList);
	},6000);
}

function refreshProjectList() {
	var prevselected = $('#libselect option:selected').val();
	var snippet = "";
	var it = new ProjectIterator({stubsonly: true});
	it.sortByTitle();
	for (it.first(); it.notlast(); it.next()) {
		var p = it.getproject();
		if (snippet=="")
			snippet = '<optgroup id="stubgroup" class="optgroup" label="Other projects on the server">\n';
		snippet += '<option value="'+p.id+'" title="'+p.description+'">'+p.title+', by '+p.creator+' on '+prettyDate(p.date)+'</option>\n';
	}
	if (snippet!="")
		snippet += '</optgroup>\n';
	$('#stubgroup').remove();
	$('#libselect').append(snippet);
	$('#libselect').val(prevselected);
}


function initOptionsPanel() {
	$('#switcher').buttonset();
	$('#emblem_size').buttonset();
	$('#gridonoff').buttonset();
	$('#labelonoff').buttonset();
	$('#onlineonoff').buttonset();

	$('[for=smoothness]').click( function() { Preferences.settheme("smoothness"); });
	$('[for=pepper-grinder]').click( function() { Preferences.settheme("pepper-grinder"); });
	$('[for=redmond]').click( function() { Preferences.settheme("redmond"); });
	$('#'+Preferences.theme).click();

	$('[for=em_small]').click( function() { Preferences.setemblem("em_small"); });
	$('[for=em_large]').click( function() { Preferences.setemblem("em_large"); });
	$('[for=em_none]').click( function() { Preferences.setemblem("em_none"); });
	
	$('[for=label_off]').click( function() { Preferences.setlabel(false); });
	$('[for=label_on]').click( function() { Preferences.setlabel(true); });
	
	$('[for=grid_off]').click( function() { Preferences.setgrid(false); });
	$('[for=grid_on]').click( function() { Preferences.setgrid(true); });
	
	$('[for=online_off]').click( function() { Preferences.setonline(false); });
	$('[for=online_on]').click( function() { Preferences.setonline(true); });

	$('#creator').change( function(evt){
		Preferences.setcreator($('#creator').val());
		$('#creator').val(Preferences.creator);
	});
	$('#creator').val(Preferences.creator);

	$('#manual').click( function() {
		window.open(this.href,this.target);
	});

	$('#optionsactivator').hover( function() {
		$('#optionsactivator').removeClass('actnormal').addClass('acthigh');
		if ($('#librarypanel').css('display')!='none') {
			$('#optionsactivator').click();
		}
	}, function() {
		$('#optionsactivator').removeClass('acthigh').addClass('actnormal');
	});
	$('#optionsactivator').click( function() {
		if ($('#optionspanel').css('display')=='none') {
			removetransientwindows();
			$('#'+Preferences.emsize).prop("checked","checked");
			$('#emblem_size').buttonset("refresh");
			$(Preferences.grid?'#grid_on':'#grid_off').prop("checked","checked");
			$('#gridonoff').buttonset("refresh");
			$(Preferences.online?'#online_on':'#online_off').prop("checked","checked");
			$('#onlineonoff').buttonset("refresh");
			$(Preferences.label?'#label_on':'#label_off').prop("checked","checked");
			$('#labelonoff').buttonset("refresh");
			if ($('#librarypanel').css('display')!='none') $('#libraryactivator').click();
			$('#optionspanel').show();
			$('#optionsactivator').addClass('actactive');
			$('#optionsupdown').removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-n');
			$('#optionspanel').click( function(){ return false; });
		} else {
			removetransientwindows();
		}
		return false;
	});
}

function bottomTabsCloseHandler(index,elem) {
	var p = Project.get(Project.cid);
	if (p.services.length==1) {
		$(elem).effect("pulsate", { times:2 }, 200);
		return;
	}
	$('#selectrect').hide();
	var s = Service.get(nid2id(elem));
	rasterConfirm('Delete service?',
		'Are you sure you want to remove service "'+
		H(s.title)+'" from project "'+p.title+'"?\nThis cannot be undone.',
		'Remove service','Cancel',
		function() {
			p.removeservice( s.id );
//			if (s.id == Service.cid)
//				Service.get(p.services[p.services.length-1]).paintall();
			transactionCompleted("Service delete");
		}
	);
}

function bottomTabsShowHandlerDiagrams(event,ui) {
	/* ui.tab.hash is the DOM object with id #tabtitle<nn> */
	var id = nid2id(ui.tab.hash);
	$('#selectrect').hide();
	$('#nodereport').dialog("close");
	Service.get(id).paintall();
	Service.cid = id;
}

function bottomTabsShowHandlerSFaults(event,ui) {
	/* ui.tab.hash is the DOM object with id #tabtitle<nn> */
	var id = nid2id(ui.tab.hash);
	Service.cid = id;
	paintSingleFailures(Service.get(id));
}

// Timer to prevent submenus from disappearing too quickly
//
var menuTimerct, menuTimercc;

function initTabDiagrams() {
	$('#WLSaddthreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#WLScopythreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#WLSpastethreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#WRDaddthreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#WRDcopythreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#WRDpastethreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#EQTaddthreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#EQTcopythreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#EQTpastethreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');

	$('#diagrams_body').tabs({
		close: bottomTabsCloseHandler,
		show: bottomTabsShowHandlerDiagrams 
	});
	$('.tabs-bottom .ui-tabs-nav, .tabs-bottom .ui-tabs-nav > *' ).removeClass('ui-corner-all ui-corner-top').addClass('ui-corner-bottom');

	$('.popupmenuitem').button();
	$('.popupmenuitem').removeClass('ui-corner-all');
	
	$('#tWLS').attr('title', "Drag to add a wireless link.");
	$('#tWRD').attr('title', "Drag to add a wired link (cable).");
	$('#tEQT').attr('title', "Drag to add an equipment item.");
	$('#tACT').attr('title', "Drag to add an actor (someone using this telecom services).");
	$('#tUNK').attr('title', "Drag to add an unknown link.");
	$('#tNOT').attr('title', "Drag to add an area for comments.");
	$('#tC_tWLS').attr('title', "Click to edit default threats for Wireless links.");
	$('#tC_tWRD').attr('title', "Click to edit default threats for Wired links.");
	$('#tC_tEQT').attr('title', "Click to edit default threats for Equipment components.");
	
	$("#nodereport").dialog({
		autoOpen: false,
		minHeight: 80,
		zIndex: 400
	});
	$("#componentthreats").dialog({
		autoOpen: false,
		minHeight: 100,
		minWidth: 785,
		maxWidth: 785,
		width: 785,
		zIndex: 400
	});

	$('#servaddbutton').click( function() {
		var p = Project.get( Project.cid );
		var s = new Service();
		p.addservice(s.id);
		s.autosettitle();
		s.load();
		$('#diagramstabtitle'+s.id).click();
		transactionCompleted("Service add");
	});

	$(".templatebg,.templatebgNOT").draggable({
		cursor: "move",
		helper: 'clone'
	});

	$('.template').hover( function() {
		$('#tC_'+this.firstElementChild.id).css({visibility: "visible"});
	},function() {
		$('#tC_'+this.firstElementChild.id).css({visibility: "hidden"});
	});
	$('.tC').mousedown( function(e,ui){
		$('#'+this.id).css({visibility: "hidden"});
		// this.id is of the form "tC_YYY", and we need to know YYY
		var ctype = this.id.substr(3);
		displayChecklistsDialog(ctype);		
		return false;
	});
	
	$('#mi_th').mouseup(function(e) {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		if (rn.type=='tACT' || rn.type=='tNOT')
			return;
		displayThreatsDialog(rn.component,e);
	});
//	$('#mi_ct span.ui-icon').hover(function(){
	$('#mi_ct').hover(function(){
		clearTimeout(menuTimerct);
		if (!$('#mi_ct').hasClass("popupmenuitemdisabled")) $('#mi_ctsm').show();
	},function(){
		menuTimerct = setTimeout( function() {$('#mi_ctsm').hide();}, 150);
	});
	$('#mi_ctsm').hover(function(){
		clearTimeout(menuTimerct);
		$('#mi_ctsm').show();
	},function(){
		menuTimerct = setTimeout( function() {$('#mi_ctsm').hide();}, 150);
	});
	$('#mi_cttWLS').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rn.changetype('tWLS');
		transactionCompleted("Node change type tWLS");
	});
	$('#mi_cttWRD').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rn.changetype('tWRD');
		transactionCompleted("Node change type tWRD");
	});
	$('#mi_cttEQT').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rn.changetype('tEQT');
		transactionCompleted("Node change type tEQT");
	});
	$('#mi_cttACT').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rn.changetype('tACT');
		transactionCompleted("Node change type tACT");
	});
	$('#mi_cttUNK').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rn.changetype('tUNK');
		transactionCompleted("Node change type tUNK");
	});
	$('#mi_sm').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		if (rn.component==null)	// Actors and notes don't have components
			return;
		var cm = Component.get(rn.component);
		cm.setsingle(cm.single==false);
		transactionCompleted("Component class single/multiple");
	});
	$('#mi_du').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		if (rn.component!=null) {
			var cm = Component.get(rn.component);
			if (cm.single) {
				// A component marked 'single' cannot be duplicated, as it would create a second
				// instance within the same diagram.
				return;
			}
		}
		var nn = new Node(rn.type);
//		nn.autosettitle(rn.title);
		nn.changetitle(rn.title);
/*		if (rn.component!=null) {
			var rnc = Component.get(rn.component);
			var nnc= Component.get(nn.component);
			nnc.setproject(rnc.project);
			var ts = [].concat(nnc.thrass);
			for (var i=0; i<ts.length; i++) {
				var th = ThreatAssessment.get(ts[i]);
				NodeCluster.removecomponent_threat(nnc.project,nnc.id,th.title,th.type);
				nnc.removethrass(ts[i]);
			}
			nnc.adddefaultthreatevaluations(rnc.id);
		}
*/		var fh = $('.fancyworkspace').height();
		var fw = $('.fancyworkspace').width();
		nn.paint();
		nn.setposition(
			(rn.position.x > fw/2 ? rn.position.x-70 : rn.position.x+70),
			(rn.position.y > fh/2 ? rn.position.y-30 : rn.position.y+30)
		);
		transactionCompleted("Node duplicate");
	});
	$('#mi_cc').hover(function(){
		clearTimeout(menuTimercc);
		// Remove any previous custom style
		$('#mi_ccsm').attr('style','');
		$('#mi_ccsm').show();
		var limit = $('#diagrams'+Service.cid).offset().top + $('#diagrams'+Service.cid).height();
		var o = $('#mi_ccsm').offset();
		// Make sure that the submenu is fully visible
		if (o.top + $('#mi_ccsm').height() > limit) {
			o.top = limit - $('#mi_ccsm').height();
		 	$('#mi_ccsm').offset(o);
		} 
	},function(){
		menuTimercc = setTimeout( function() {$('#mi_ccsm').hide();}, 150);
	});
	$('#mi_ccsm').hover(function(){
		clearTimeout(menuTimercc);
		$('#mi_ccsm').show();
	},function(){
		menuTimercc = setTimeout( function() {$('#mi_ccsm').hide();}, 150);
	});
	function colorfunc(c) { return function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rn.setlabel(c);
		transactionCompleted("Node change color "+c);
	  }; 
	}
	$('#mi_ccnone').mouseup( colorfunc('none') );
	$('#mi_ccred').mouseup( colorfunc('red') );
	$('#mi_ccorange').mouseup( colorfunc('orange') );
	$('#mi_ccyellow').mouseup( colorfunc('yellow') );
	$('#mi_ccgreen').mouseup( colorfunc('green') );
	$('#mi_ccblue').mouseup( colorfunc('blue') );
	$('#mi_ccpurple').mouseup( colorfunc('purple') );
	$('#mi_ccgrey').mouseup( colorfunc('grey') );
	$('#mi_ccedit').mouseup( showLabelEditForm );
	$('#mi_de').mouseup(function() {
		$('#nodemenu').css("display", "none");
		var rn = Node.get( Node.MenuNode );
		rasterConfirm("Delete element node?",
			'Are you sure you want to delete ' + (rn.type=='tNOT'?"note":"node") + ' "' + rn.htmltitle() +'"?',
			'Delete','Cancel',
			function() {
				transactionCompleted("Node delete");
				rn.destroy(); 
			}
			);
	});
	$('#mi_sd').mouseup(function() {
		var nodes = Node.nodesinselection();
		var num = nodes.length;
		$('#selectmenu').hide();
		if (num==0) {
			$('#selectrect').hide();
			return;
		}
		// Start blinking
		for (var i=0; i<num; i++) {
			var rn = Node.get(nodes[i]);
		  	$(rn.jnid).effect("pulsate", { times:10 }, 2000);
		}
		rasterConfirm("Delete " + num + plural(" node","s",num) + " in selection?",
			'Are you sure you want to delete all selected nodes?',
			'Delete '+ num + plural(" node","s",num),'Cancel',
			function() {
				// Stop any leftover pulsate effects
				for (var i=0; i<num; i++) {
					var rn = Node.get(nodes[i]);
				  	$(rn.jnid).stop(true,true);
				}
				transactionCompleted("Node destroy selection");
				Node.destroyselection();
				$('#selectrect').hide();
			},
			function() {
				// Stop any leftover pulsate effects
				for (var i=0; i<num; i++) {
					var rn = Node.get(nodes[i]);
				  	$(rn.jnid).stop(true,true);
				  	$(rn.jnid).show().css("opacity","");
				}
				$('#selectrect').hide();
			});
	});
	$('#mi_sc').hover(function(){
		populateLabelMenu();
		// Remove any previous custom style
		$('#mi_scsm').attr('style','');
		$('#mi_scsm').show();
		var limit = $('#diagrams'+Service.cid).offset().top + $('#diagrams'+Service.cid).height();
		var o = $('#mi_scsm').offset();
		// Make sure that the submenu is fully visible
		if (o.top + $('#mi_scsm').height() > limit) {
			o.top = limit - $('#mi_scsm').height();
		 	$('#mi_scsm').offset(o);
		} 
	},function(){
		$('#mi_scsm').hide();
	});
	$('#mi_scsm').hover(function(){
		populateLabelMenu();
		$('#mi_scsm').show();
	},function(){
		$('#mi_scsm').hide();
	});
	function selcolorfunc(c) { return function() {
		var nodes = Node.nodesinselection();
		var num = nodes.length;
		$('#selectmenu').hide();
		if (num==0) {
			$('#selectrect').hide();
			return;
		}
		for (var i=0; i<num; i++) {
			var rn = Node.get(nodes[i]);
			rn.setlabel(c);
		}
		transactionCompleted("Node change selection color "+c);
	  };
	}
	$('#mi_scnone').mouseup( selcolorfunc('none') );
	$('#mi_scred').mouseup( selcolorfunc('red') );
	$('#mi_scorange').mouseup( selcolorfunc('orange') );
	$('#mi_scyellow').mouseup( selcolorfunc('yellow') );
	$('#mi_scgreen').mouseup( selcolorfunc('green') );
	$('#mi_scblue').mouseup( selcolorfunc('blue') );
	$('#mi_scpurple').mouseup( selcolorfunc('purple') );
	$('#mi_scgrey').mouseup( selcolorfunc('grey') );
	$('#mi_scedit').mouseup( showLabelEditForm );
	jsPlumb.Defaults.EndpointStyle = {
		lineWidth: 10,
		fillStyle: '#aaa'
	};
	jsPlumb.Defaults.EndpointHoverStyle = {
		fillStyle: '#666',
		strokeStyle: '#000'
	};
	jsPlumb.Defaults.DragOptions = { cursor: 'move' };
	jsPlumb.Defaults.Endpoint = [ "Dot", { radius: 6 } ];
	var connfunction = function(data) {
			var src = Node.get(nid2id(data.sourceId));
			var dst = Node.get(nid2id(data.targetId));
			/* There are two times when this function is called:
			 * when a dragpoint is dropped on a target, and
			 * when two center points are connected programmatically.
			 * We distinguish these cases by the scope
			 */
			if (data.sourceEndpoint.scope == 'center') {
				var getcon = jsPlumb.getConnections({scope:'center'});
				src.setmarker(getcon);
				dst.setmarker(getcon);
			} else {
				src.try_attach_center(dst);
				// Delete the temporary eindpoint, and hide the source endpoint
				jsPlumb.deleteEndpoint(data.targetEndpoint);
// The following line does not work. In fact, the div is already hidden.
// Problem is that there are three (!) endpoints within the node at this stage?!
				$(data.sourceEndpoint.canvas).css({visibility: 'hidden'});
			}
		};
	jsPlumb.bind('connection', connfunction ); 

	var addhandler = function(typ) {
		return function() {
			var t = new Threat(typ);
			var p = Project.get( Project.cid );
			p.addthreat(t.id);
			t.addtablerow("#"+typ+"threats");
			transactionCompleted("Checklist vuln add");
		};
	};
	var copyhandler = function(typ) {
		return function() {
			ThreatAssessment.Clipboard = [];
			var it = new ThreatIterator(Project.cid,typ);
			for (it.first(); it.notlast(); it.next()) {
				var th = it.getthreat();
				ThreatAssessment.Clipboard.push({t: th.title, y: th.type, d: th.description, p: '-', i: '-', r: ''});
			}
		};
	};
	var pastehandler = function(typ) {
		return function() {
			var it = new ThreatIterator(Project.cid,typ);
			var newth = [];
			for (var j=0; j<ThreatAssessment.Clipboard.length; j++) {
				// Check whether a threat with same title already exists
				for (it.first(); it.notlast(); it.next()) {
					var th = it.getthreat();
					if (ThreatAssessment.Clipboard[j].t==th.title) break;
				}

				if (it.notlast()) {
					// Paste into existing threat
					th.setdescription(ThreatAssessment.Clipboard[j].d);
					$('#threat'+th.id).remove();
					th.addtablerow('#'+typ+'threats');
				} else {
					// Create a new threat
					th = new Threat(typ);  // Ignore the type in the Clipboard. Must always be typ.
					th.settitle(ThreatAssessment.Clipboard[j].t);
					th.setdescription(ThreatAssessment.Clipboard[j].d);
					Project.get(Project.cid).addthreat(th.id);
					newth.push(th.id);
				}
			}
			for (var i=0; i<newth.length; i++) {
				th = Threat.get(newth[i]);
				th.addtablerow('#'+typ+'threats');
			}
			transactionCompleted("Checklist vuln paste");
		};
	};
	
	$('#WLSaddthreat').click(addhandler('tWLS'));
	$('#WLScopythreat').click(copyhandler('tWLS'));
	$('#WLSpastethreat').click(pastehandler('tWLS'));

	$('#WRDaddthreat').click(addhandler('tWRD'));
	$('#WRDcopythreat').click(copyhandler('tWRD'));
	$('#WRDpastethreat').click(pastehandler('tWRD'));

	$('#EQTaddthreat').click(addhandler('tEQT'));
	$('#EQTcopythreat').click(copyhandler('tEQT'));
	$('#EQTpastethreat').click(pastehandler('tEQT'));		

	if (DEBUG && !Rules.consistent()) 
		bugreport('the rules are not internally consistent','initTabDiagrams');
}

function populateLabelMenu() {
	var p = Project.get(Project.cid);
	$("#mi_ccred .labeltext").html( '"' + H(p.labels[0]) + '"' );
	$("#mi_ccorange .labeltext").html( '"' + H(p.labels[1]) + '"' );
	$("#mi_ccyellow .labeltext").html( '"' + H(p.labels[2]) + '"' );
	$("#mi_ccgreen .labeltext").html( '"' + H(p.labels[3]) + '"' );
	$("#mi_ccblue .labeltext").html( '"' + H(p.labels[4]) + '"' );
	$("#mi_ccpurple .labeltext").html( '"' + H(p.labels[5]) + '"' );
	$("#mi_ccgrey .labeltext").html( '"' + H(p.labels[6]) + '"' );
	
	$("#mi_scred .labeltext").html( '"' + H(p.labels[0]) + '"' );
	$("#mi_scorange .labeltext").html( '"' + H(p.labels[1]) + '"' );
	$("#mi_scyellow .labeltext").html( '"' + H(p.labels[2]) + '"' );
	$("#mi_scgreen .labeltext").html( '"' + H(p.labels[3]) + '"' );
	$("#mi_scblue .labeltext").html( '"' + H(p.labels[4]) + '"' );
	$("#mi_scpurple .labeltext").html( '"' + H(p.labels[5]) + '"' );
	$("#mi_scgrey .labeltext").html( '"' + H(p.labels[6]) + '"' );
}

function showLabelEditForm() {
	var p = Project.get(Project.cid);
	$('#nodemenu').css("display", "none");
	var dialog = $('<div></div>');
	var snippet ='\
		<form id="form_editlabels">\
		<div class="smallblock Bred"></div><input id="field_red" name="fld_red" type="text" size="30" value="_RED_"><br>\
		<div class="smallblock Borange"></div><input id="field_orange" name="fld_orange" type="text" size="30" value="_ORANGE_"><br>\
		<div class="smallblock Byellow"></div><input id="field_yellow" name="fld_yellow" type="text" size="30" value="_YELLOW_"><br>\
		<div class="smallblock Bgreen"></div><input id="field_green" name="fld_green" type="text" size="30" value="_GREEN_"><br>\
		<div class="smallblock Bblue"></div><input id="field_blue" name="fld_blue" type="text" size="30" value="_BLUE_"><br>\
		<div class="smallblock Bpurple"></div><input id="field_purple" name="fld_purple" type="text" size="30" value="_PURPLE_"><br>\
		<div class="smallblock Bgrey"></div><input id="field_grey" name="fld_grey" type="text" size="30" value="_GREY_"><br>\
		</form>\
	';
	snippet = snippet.replace(/_RED_/g, H(p.labels[0]));
	snippet = snippet.replace(/_ORANGE_/g, H(p.labels[1]));
	snippet = snippet.replace(/_YELLOW_/g, H(p.labels[2]));
	snippet = snippet.replace(/_GREEN_/g, H(p.labels[3]));
	snippet = snippet.replace(/_BLUE_/g, H(p.labels[4]));
	snippet = snippet.replace(/_PURPLE_/g, H(p.labels[5]));
	snippet = snippet.replace(/_GREY_/g, H(p.labels[6]));
	dialog.append(snippet);
	dialog.dialog({
		title: "Edit labels",
		modal: true,
		width: 285,
		height: 290,
		buttons: {
			Cancel: function() {
				$(this).dialog("close");
			},
			"Done": function() {
				p.labels[0] = trimwhitespace(String($('#field_red').val())).substr(0,50);
				p.labels[1] = trimwhitespace(String($('#field_orange').val())).substr(0,50);
				p.labels[2] = trimwhitespace(String($('#field_yellow').val())).substr(0,50);
				p.labels[3] = trimwhitespace(String($('#field_green').val())).substr(0,50);
				p.labels[4] = trimwhitespace(String($('#field_blue').val())).substr(0,50);
				p.labels[5] = trimwhitespace(String($('#field_purple').val())).substr(0,50);
				p.labels[6] = trimwhitespace(String($('#field_grey').val())).substr(0,50);
				for (var i=0; i<=6; i++) {
					if (p.labels[i]=="")
						p.labels[i] = Project.defaultlabels[i];
				}
				p.store();
				$(this).dialog("close");
				transactionCompleted("Label edit");
				$(this).remove();
			}
		}
	});
}

function workspacedrophandler(event, ui) {
	// The id of the template must be a valid type
	if (!Rules.nodetypes[ui.draggable[0].id])
		bugreport('object with unknown type','workspacedrophandler');
	var rn = new Node(ui.draggable[0].id);
	/* 50 = half the width of a div.node; 10 = half the height
	 * The center of the new Node is therefore roughly on the the drop spot.
	 */
	rn.autosettitle();
	var r = $('#tab_diagrams').offset();
	rn.paint();
	rn.setposition(
		event.originalEvent.pageX-50-r.left+$('#diagrams'+Service.cid).scrollLeft(),
		event.originalEvent.pageY-10-r.top +$('#diagrams'+Service.cid).scrollTop()
	);
	// Now we now the width and height. Adjust the position if necessary.
	rn.setposition(rn.position.x,rn.position.y);
	$('.tC').css('visibility','hidden');
	transactionCompleted("Node add");
}

function displayThreatsDialog(cid,event) {
	var c = Component.get(cid);
	Component.ThreatsComponent = cid;
	var snippet = '<div id="dialogthreatlist">\
		<div class="threat">\
		<div class="th_name thr_header">Name</div>\
		<div class="th_freq thr_header">Freq.</div>\
		<div class="th_impact thr_header">Impact</div>\
		<div class="th_total thr_header">Total</div>\
		<div class="th_remark thr_header">Remark</div>\
		</div>\
		<div id="threats_CI_" class="threats"></div>\
		<input id="dthadddia_CI_" class="addthreatbutton" type="button" value="+ Add vulnerability">\
		<input id="dthcopydia_CI_" class="copybutton" type="button" value="Copy">\
		<input id="dthpastedia_CI_" class="pastebutton" type="button" value="Paste">\
		</div>';
	snippet = snippet.replace(/_CI_/g, cid);
	$("#componentthreats").html(snippet);
	c.setmarkeroid(null);
	
	for (var i=0; i<c.thrass.length; i++) {
		if (c.thrass[i]==null) continue;
		var th = ThreatAssessment.get(c.thrass[i]);
		th.addtablerow('#threats'+cid,"dia");
	}
	$('#dthadddia'+cid).button();
	$('#dthcopydia'+cid).button();
	$('#dthpastedia'+cid).button();
	$('#dthadddia'+cid).removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#dthcopydia'+cid).removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#dthpastedia'+cid).removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#dthadddia'+cid).click( function() {
		var c = Component.get(nid2id(this.id));
		var th = new ThreatAssessment((c.type=='tUNK' ? 'tEQT' : c.type));
		c.addthrass(th);
		th.addtablerow('#threats'+c.id,"dia");
		transactionCompleted("Vuln add");
	});
	$('#dthcopydia'+cid).click( function() {
		var cm = Component.get(nid2id(this.id));
		ThreatAssessment.Clipboard = [];
		for (var i=0; i<cm.thrass.length; i++) {
			var te = ThreatAssessment.get(cm.thrass[i]);
			ThreatAssessment.Clipboard.push({t: te.title, y: te.type, d: te.description, p: te.freq, i: te.impact, r: te.remark});
		}
	});
	$('#dthpastedia'+cid).click( function() {
		var cm = Component.get(nid2id(this.id));
		var newte = cm.mergeclipboard();
//		for (var j=0; j<ThreatAssessment.Clipboard.length; j++) {
//			for (var i=0; i<cm.thrass.length; i++) {
//				var te = ThreatAssessment.get(cm.thrass[i]);
//				if (ThreatAssessment.Clipboard[j].t==te.title && ThreatAssessment.Clipboard[j].y==te.type) break;
//			}
//			if (i==cm.thrass.length) {
//				// Create a new threat evaluation
//				var th = new ThreatAssessment(cm.type=='tUNK' ? ThreatAssessment.Clipboard[j].y : cm.type);
//				th.setcomponent(cm.id);
//				th.settitle(ThreatAssessment.Clipboard[j].t);
//				th.setdescription(ThreatAssessment.Clipboard[j].d);
//				th.setfreq( ThreatAssessment.worst(ThreatAssessment.Clipboard[j].p,'-') );
//				th.setimpact( ThreatAssessment.worst(ThreatAssessment.Clipboard[j].i,'-') );
//				th.setremark(ThreatAssessment.Clipboard[j].r);
//				newte.push(th.id);
//			} else {
//				// Paste into existing threat evaluation
//				if (te.description.indexOf(ThreatAssessment.Clipboard[j].d)==-1) {
//					if (te.description.length>0 && ThreatAssessment.Clipboard[j].d.length>0)
//						te.setdescription(te.description + " " + ThreatAssessment.Clipboard[j].d);
//					else
//						te.setdescription(te.description + ThreatAssessment.Clipboard[j].d);
//				}
//				te.setfreq( ThreatAssessment.worst(ThreatAssessment.Clipboard[j].p,te.freq) );
//				te.setimpact( ThreatAssessment.worst(ThreatAssessment.Clipboard[j].i,te.impact) );
//				if (te.remark.length>0 && ThreatAssessment.Clipboard[j].r.length>0)
//					te.setremark(te.remark + " " + ThreatAssessment.Clipboard[j].r);
//				else
//					te.setremark(te.remark + ThreatAssessment.Clipboard[j].r);
//				$('#dthdia_'+te.id).remove();
//				te.addtablerow('#threats'+c.id,"dia");
//			}
//		}
		for (i=0; i<cm.thrass.length; i++) {
			th = ThreatAssessment.get(cm.thrass[i]);
			if (newte.indexOf(cm.thrass[i])==-1)
				$('#dthdia_'+th.id).remove();
			th.addtablerow('#threats'+cm.id,"dia");
		}
		cm.setmarker();
		transactionCompleted("Vuln paste");
	});
		
	if ($("#componentthreats").dialog("isOpen"))
		$("#componentthreats").dialog("close");
	$("#componentthreats").dialog({
		'title': 'Vulnerability assessment for "'+H(c.title)+'" ' + (c.nodes.length>1 ? "("+c.nodes.length+" nodes)" : ""),
		minWidth: 725,
		minHeight: 180,
		zIndex: 400,
		position: [event.clientX, event.clientY],
		open: function() {
			var o = $("#componentthreats").dialog("widget").offset();
			// Fade in the menu, and move it left & down, but only move it if the call to "open" did not adjust the position
			// of the window. Windows are adjusted to prevent them from sticking out of the viewport.
			$("#componentthreats").dialog("widget")
			.css({display: "", opacity: 0})
			.animate({
				opacity: 1,
				left: o.left+(event.clientX==o.left? 50 : 0),
				top: o.top+(event.clientY==o.top ? 30 : 0)
			}, 250);
		}
	});
	$("#componentthreats").dialog("open");
	// First delete button gains focus, and is highlighted. Looks ugly.
	$('#dialogthreatlist input').blur();
	
	$("#threats"+cid).sortable({
		containment: "parent",
		helper: "clone",
		cursor: "ns-resize",
		deactivate: function(e,ui) {
			var newlist = [];
			for (var i=0; i<this.children.length; i++)
				newlist.push( nid2id(this.children[i].id) );
			if (newlist.length != c.thrass.length)
				bugreport("internal error in sorting","displayThreatsDialog");
			c.thrass = newlist;
			transactionCompleted("Reorder thrass of component "+c.id);
		}
	});
}

function displayChecklistsDialog(type) {
	// When displaying multiple checklist windows, each will get the same location and size.
	// Since that is confusing, we prevent obscuration by using a type-specific offset.
	var offsets = {'tWLS': 0, 'tWRD': 30, 'tEQT': 60};
	$("#checklist_"+type).dialog({
		'title': 'Default vulnerabilities for new nodes of type "'+Rules.nodetypes[type]+'"',
		minWidth: 725,
		minHeight: 180,
		position: [150+offsets[type],100+offsets[type]],
		zIndex: 400
	});
	$("#checklist_"+type).dialog("open");
	$('.checklist input').each( function () { 
		$(this).blur(); return true; 
	});
}

/* arrayJoinAsString: join strings into an English phrase.
 *
 * a: an array of strings
 * str: the joining word
 * E.g. arrayJoinAsString(["red","green","orange","blue"],"and") = "red, green, orange and blue"
 */
function arrayJoinAsString(a,str) {
	if (a.length==0) return "(none)";
	if (a.length==1) return a[0];
	var last = a.pop();
	return a.join(", ")	+ " " + str + " " + last;
}

function RefreshNodeReportDialog() {
	if (! $('#nodereport').dialog("isOpen")) return;
	// Refresh the contents
	var rn = Node.get(Node.DialogNode);
	var report = rn.getreport();
	var s;
				
	if (report.length==0)
		s = "Connections are OK; no warnings.";
	else {
		s = report.join("<p>");
	}
	$("#nodereport").html( s );
	$("#nodereport").dialog({
		title: 'Warning report on '+rn.htmltitle(),
		zIndex: 400
	});
	$("#nodereport").dialog("open");
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|      Single Faults      |* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function initTabSingleFs() {
	$('#singlefs_body').tabs({
		close: bottomTabsCloseHandler,
		show: bottomTabsShowHandlerSFaults 
	});
	$('.tabs-bottom .ui-tabs-nav, .tabs-bottom .ui-tabs-nav > *' ).removeClass('ui-corner-all ui-corner-top').addClass('ui-corner-bottom');

	$('#servaddbuttonsf').click( function() {
		var p = Project.get( Project.cid );
		var s = new Service();
		p.addservice(s.id);
		s.autosettitle();
		s.load();
		$('#singlefstabtitle'+s.id).click();
		transactionCompleted("Service add");
	});
}

var SFSortOpt = "alpha";

function paintSingleFailures(s) {
	var appendstring = "";
	$('#singlefs_workspace'+s.id).empty();

	var it = new ComponentIterator({service: s.id});
	it.first();
	if (!it.notlast()) {
		$('#singlefs_workspace'+s.id).append(
			'<p class="firstp sfaccordion">This space will show all vulnerability evaluations for the components in this service.\
			Since all service diagrams are empty, there is nothing to see here yet.\
			Add some nodes to the diagrams first.'
		);
		return;
	}
	
	switch (SFSortOpt) {
	case "alpha":
		it.sortByName();
		break;
	case "type":
		it.sortByType();
		break;
	case "threat":
		it.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","paintSingleFailures");
	}
	
	// Adding elements to the DOM is slow, so it is best to do it all at
	// once, rather than piece by piece.
	// First collect the bulk of the DOM elements to be appended. Then loop
	// over the components again, adding the vulnerabilities to them, and adding
	// behaviour stuff.
	snippet = '\
		<p class="firstp donotprint">\
		[+] <span id="expandalls_SV_" class="ui-link">Expand all</span>\
		&nbsp;&nbsp;&nbsp;&nbsp;\
		[&minus;] <span id="collapsealls_SV_" class="ui-link">Collapse all</span>\
		<span id="sortalls_SV_" class="sortalls">Sort: <select id="sfselect_SV_">\n\
			<option value="alpha">Alphabetically</option>\n\
			<option value="type">by Type</option>\n\
			<option value="threat">by Vulnerability level</option>\n\
		</select></span>\n\
		</p>\
	';
	snippet = snippet.replace(/_SN_/g, H(s.title));
	snippet = snippet.replace(/_SV_/g, s.id);
	snippet = snippet.replace(/_PN_/g, H(Project.get(s.project).title));
	snippet = snippet.replace(/_PJ_/g, s.project);
	appendstring += snippet;

	for (it.first(); it.notlast(); it.next()) {
		var i;
		var cm = it.getcomponent();
		//if (cm.type=='tACT') continue;
		var snippet = '\n\
		  <div id="sfaccordion_SV___ID_" class="sfaccordion">\n\
			<h3><a href="#">Single failures for "_TI_" (_TY__AP_) _LB_<span id="sfamark_SV___ID_"></span></a></h3>\n\
			<div>\n\
			 <div id="sfa_SV___ID_">\n\
			  <div class="threat">\n\
			   <div class="th_name thr_header">Name</div>\n\
			   <div class="th_freq thr_header">Freq.</div>\n\
			   <div class="th_impact thr_header">Impact</div>\n\
			   <div class="th_total thr_header">Total</div>\n\
			   <div class="th_remark thr_header">Remark</div>\n\
			  </div>\n\
			 </div>\n\
		';

		if (Preferences.label) {
			var p = Project.get(cm.project);
			var labels = [];
			var str;
			for (i=0; i<cm.nodes.length; i++) {
				var rn = Node.get(cm.nodes[i]);
				if (rn.color!="none" && labels.indexOf(rn.color)==-1)
					labels.push(rn.color);
			}
			if (labels.length==0) {
				snippet = snippet.replace(/_LB_/, '');
			} else if (labels.length==1) {
				str = '<div class="sflabelgroup"><div class="smallblock donotprint B'+labels[0]+'"></div><span class="labelind">'+H(p.strToLabel(labels[0]))+'</span></div>';
				snippet = snippet.replace(/_LB_/, str);
			} else {
				str = '<div class="sflabelgroup">';
				for (i=0; i<labels.length; i++) {
					str += '<div class="smallblock B'+labels[i]+'"></div>';
				}
				str += '</div>';
				snippet = snippet.replace(/_LB_/, str);
			}
		} else {
			snippet = snippet.replace(/_LB_/, '');
		}

snippet += "<div class='sfa_sortable'>\n";
		for (i=0; i<cm.thrass.length; i++) {
			var te = ThreatAssessment.get(cm.thrass[i]);
			snippet += te.addtablerow_textonly("sfa"+s.id+'_'+cm.id);
		}
snippet += "</div>\n";
		snippet += '\n\
			 <input id="sfaadd_SV___ID_" class="addthreatbutton" type="button" value="+ Add vulnerability">\n\
			 <input id="sfacopy_SV___ID_" class="copybutton" type="button" value="Copy">\n\
			 <input id="sfapaste_SV___ID_" class="pastebutton" type="button" value="Paste">\n\
			</div>\n\
		  </div>\n\
		';
		snippet = snippet.replace(/_SV_/g, s.id);
		snippet = snippet.replace(/_ID_/g, cm.id);
		snippet = snippet.replace(/_TY_/g, Rules.nodetypes[cm.type]);
		snippet = snippet.replace(/_TI_/g, H(cm.title));
		snippet = snippet.replace(/_AP_/g, (cm.nodes.length==1 || cm.single ? '' : ', '+cm.nodes.length+' nodes' ));
		appendstring += snippet;
	}
	
	appendstring += '<br><br>\n';
	// Insert the bulk of the new DOM elements
	$('#singlefs_workspace'+s.id).append(appendstring);
	
	// Now loop again, add vulnerabilities and behaviour.
	for (it.first(); it.notlast(); it.next()) {
		cm = it.getcomponent();
		cm.setmarkeroid("#sfamark"+s.id+'_'+cm.id);
		for (i=0; i<cm.thrass.length; i++) {
			te = ThreatAssessment.get(cm.thrass[i]);
			te.addtablerow_behavioronly('#sfa'+s.id+'_'+cm.id,"sfa"+s.id+'_'+cm.id);
		}
		var addhandler = function(s,cm) {
			  return function() {
				var th = new ThreatAssessment( (cm.type=='tUNK' ? 'tEQT' : cm.type) );
				cm.addthrass(th);
				th.addtablerow('#sfa'+s.id+'_'+cm.id,"sfa"+s.id+'_'+cm.id);
				cm.setmarker();
				transactionCompleted("Vuln add");
			  };
		};
		var copyhandler = function(s,cm) {
			  return function() {
				  ThreatAssessment.Clipboard = [];
				  for (var i=0; i<cm.thrass.length; i++) {
					  var te = ThreatAssessment.get(cm.thrass[i]);
					  ThreatAssessment.Clipboard.push({t: te.title, y: te.type, d: te.description, p: te.freq, i: te.impact, r: te.remark});
				  }
			  };
		};
		var pastehandler = function(s,cm) {
			  return function() {
				var newte = cm.mergeclipboard();
				for (i=0; i<cm.thrass.length; i++) {
					var th = ThreatAssessment.get(cm.thrass[i]);
					if (newte.indexOf(cm.thrass[i])==-1)
						$('#dthsfa'+s.id+'_'+cm.id+'_'+th.id).remove();
					th.addtablerow('#sfa'+s.id+'_'+cm.id,"sfa"+s.id+'_'+cm.id);
				}
				cm.setmarker();
				transactionCompleted("Vuln paste");
			  };
		};
		$('#sfaadd'+s.id+'_'+cm.id).click( addhandler(s,cm) );
		$('#sfacopy'+s.id+'_'+cm.id).click( copyhandler(s,cm) );
		$('#sfapaste'+s.id+'_'+cm.id).click( pastehandler(s,cm) );
		var openclose = function(cm){ return function(event,ui) {
			opencloseSFAccordion(cm,s.id,event,ui);
		}; };
		var acc = $('#sfaccordion'+s.id+'_'+cm.id);
		acc.accordion({
			changestart: openclose(cm),
			autoHeight: false,
			collapsible: true,
			animated: false,
			active: (cm.accordionopened ? 0 : false)
		});
		acc.accordion("option", "animated", "slide");
		
		$(acc.selector + ' .sfa_sortable').sortable({
			containment: "parent",
			helper: "clone",
			cursor: "ns-resize",
			deactivate: function(e,ui) {
				var newlist = [];
				var cm = Component.get( nid2id(this.previousElementSibling.id) );
				for (var i=0; i<this.children.length; i++) {
					var obj = $('#' + this.children[i].id);
					newlist.push( nid2id(this.children[i].id) );
				}
				if (cm==null || newlist.length != cm.thrass.length)
					bugreport("internal error in sorting","paintSingleFailures");
				cm.thrass = newlist;
				transactionCompleted("Reorder thrass of component "+cm.id);
			}
		});
	}
	
	$('#expandalls'+s.id).click( function(evt){
		expandAllSingleF(nid2id(evt.target.id));
	});
	$('#collapsealls'+s.id).click( function(evt){
		collapseAllSingleF(nid2id(evt.target.id));
	});
	$('#sfselect'+s.id).val(SFSortOpt);
	$('#sfselect'+s.id).change( function(evt){
		var id = nid2id(evt.target.id);
		var selected = $('#sfselect'+id+' option:selected').val();
		SFSortOpt = selected;
		paintSingleFailures( Service.get(id) );
	});
	
	$('#singlefs_body input[type=button]').button();
	$('#singlefs_body input[class~="addthreatbutton"]').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#singlefs_body input[class~="copybutton"]').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#singlefs_body input[class~="pastebutton"]').removeClass('ui-corner-all').addClass('ui-corner-bottom');
}

/* This function is called when the head of the accordion for Component is clicked, but before
 * the accordion is opened or closed.
 */
function opencloseSFAccordion(cm,sid,event,ui) {
	cm.setaccordionopened(ui.options.active===0);
}

function expandAllSingleF(sid) {
	var it = new ComponentIterator({service: sid});
	for (it.first(); it.notlast(); it.next()) {
		var cm = it.getcomponent();
		if (cm.type=='tACT') {
			bugreport("Found a component of type actor. That should not exist.", "expandAllSingleF");
			continue;
		}
		var el = $('#sfaccordion'+sid+'_'+cm.id);

		if (el.accordion("option","active")===false) {
			el.accordion("option", "active", 0);
			// The following is not necessary during normal use, but appears to be required when
			// expandAllSingleF() is called from window.onBeforePrint, or when stepping through
			// this loop using a debugger ?!
			$('#sfaccordion'+sid+'_'+cm.id+' .ui-accordion-content').css('height','').css('overflow','').css('padding-top','').css('padding-bottom','');
			el.accordion("refresh");
		}
	}
}

function collapseAllSingleF(sid) {
	var it = new ComponentIterator({service: sid});
	for (it.first(); it.notlast(); it.next()) {
		var cm = it.getcomponent();
		if (cm.type=='tACT') {
			bugreport("Found a component of type actor. That should not exist.", "collapseAllSingleF");
			continue;
		}
		$('#sfaccordion'+sid+'_'+cm.id).accordion("activate",false);
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|  Common Cause Failures  |* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function initTabCCFs() {
}

var CCFSortOpt = "alpha";

function AddAllClusters() {
	var snippet = '\
		<h1 class="printonly underlay">Common Cause failures</h1>\
		<h2 class="printonly underlay projectname">Project: _PN_</h2>\
		<p id="noshf" class="firstp sfaccordion">This space will show all vulnerabilities domains for the components in this project.\
		Since there are no vulnerabilities that occur in two or mode nodes, there is nothing to see here yet.\
		Add some nodes to the diagrams first.</p>\
		<p id="someshf" class="firstp donotprint">\
		[+] <span id="expandallshf" class="ui-link">Expand all</span>\
		&nbsp;&nbsp;&nbsp;&nbsp;\
		[&minus;] <span id="collapseallshf" class="ui-link">Collapse all</span>\
		<span id="sortallccf" class="sortalls">Sort: <select id="ccfselect">\n\
			<option value="alpha">Alphabetically</option>\n\
			<option value="type">by Type</option>\n\
			<option value="threat">by Vulnerability level</option>\n\
		</select></span>\n\
		</p>\
	';
	snippet = snippet.replace(/_PJ_/g, Project.cid);
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	$('#ccfs_body').append(snippet);

	// create list of all vulnerabilities
	// for each vulnerability, list the nested list / vulnerability-domain-tree
	// allow manipulation of nested list
	var it = new NodeClusterIterator({project:Project.cid, isroot:true});
	if (!it.notlast()) {
		$('#noshf').css('display', 'block');
		$('#someshf').css('display', 'none');
		return;
	}
	
	$('#ccfselect').val(CCFSortOpt);
	switch (CCFSortOpt) {
	case "alpha":
		it.sortByName();
		break;
	case "type":
		it.sortByType();
		break;
	case "threat":
		it.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","AddAllClusters");
	}
	
	$('#noshf').css('display', 'none');
	$('#someshf').css('display', 'block');
	$('#expandallshf').click( function(evt){
		expandAllCCF(nid2id(evt.target.id));
	});
	$('#collapseallshf').click( function(evt){
		collapseAllCCF(nid2id(evt.target.id));
	});
	$('#ccfselect').change( function(){
		var selected = $('#ccfselect option:selected').val();
		CCFSortOpt = selected;
		$('#ccfs_body').empty();
		AddAllClusters();
	});
	
	for (it.first(); it.notlast(); it.next()) {
		var nc = it.getNodeCluster();
		addTDomElements(nc);
		repaintTDom(nc.id);
	}
	$('#ccfs_body').append('<br><br>');
}

function addTDomElements(nc) {
	var snippet = '\n\
	  <div id="shfaccordion_ID_" class="shfaccordion">\n\
		<h3><a href="#">Common Cause failures for "_TI_" (_TY_) <span id="shfamark_ID_"></span></a></h3>\n\
		<div id="shfaccordionbody_ID_" class="shfaccordionbody">\n\
		  <div id="tdom_ID_" class="threatdomain"></div>\n\
		</div>\n\
	  </div>\n\
	';
	snippet = snippet.replace(/_ID_/g, nc.id);
	snippet = snippet.replace(/_TI_/g, H(nc.title));
	snippet = snippet.replace(/_TY_/g, Rules.nodetypes[nc.type]);
	$('#ccfs_body').append(snippet);

	var acc = $('#shfaccordion'+nc.id);
	acc.accordion({
		change: function(event,ui) { nc.setaccordionopened(ui.options.active===0); },
		autoHeight: false,
		collapsible: true,
		animated: false,
		active: (nc.accordionopened ? 0 : false)
	});
	acc.accordion("option", "animated", "slide");
	if (nc.childclusters.length + nc.childnodes.length < 2)
		// Just an empty placeholder for a node cluster that is too small
		$('#shfaccordion'+nc.id).css("display", "none");
	else
		$('#shfaccordion'+nc.id).css("display", "block");
}

function expandAllCCF() {
	var it = new NodeClusterIterator({project: Project.cid});
	for (it.first(); it.notlast(); it.next()) {
		var id = it.getNodeClusterid();
		var el = $('#shfaccordion'+id);
		if (el.accordion("option","active")===el)
			el.click();
		else if (el.accordion("option","active")===false)
			el.accordion("activate",0);
	}
}

function collapseAllCCF() {
	var it = new NodeClusterIterator({project: Project.cid});
	for (it.first(); it.notlast(); it.next()) {
		var id = it.getNodeClusterid();
		$('#shfaccordion'+id).accordion("activate",false);
	}
}

/* Repainting shared failures takes a lot of time. When we trigger a repaint, we often
 * lack information on whether the repaint can be batched. Therefore, we schedule the
 * repaint, but delay execution for a short while. This way, we avoind unnecessary
 * repaints.
 */
var REPAINT_TIMEOUTS=[];

function repaintTDom(elem) {
	if (REPAINT_TIMEOUTS[elem])
		clearTimeout(REPAINT_TIMEOUTS[elem]);
	var func = function(){reallyRepaintTDom(elem);};
	REPAINT_TIMEOUTS[elem] = setTimeout(func,100);
}

function reallyRepaintTDom(elem) {
	delete REPAINT_TIMEOUTS[elem];
	var nc = NodeCluster.get(elem);
	if (!nc)
		return;
	if (!nc.isroot())
		bugreport("Repainting a non-root cluster","repaintTDom");

	var snippet = '<div>\
		<div class="threat">\
		<div class="th_name thr_header">Name</div>\
		<div class="th_freq thr_header">Freq.</div>\
		<div class="th_impact thr_header">Impact</div>\
		<div class="th_total thr_header">Total</div>\
		<div class="th_remark thr_header">Remark</div>\
		</div>\
		<div id="shftable_ID_" class="threats">\
		</div></div>\n\
		<div id="tdom_ID_" class="threatdomain"></div>\n';
	snippet = snippet.replace(/_ID_/g, nc.id);
	$('#shfaccordionbody'+nc.id).html( snippet );
	appendAllThreats(nc,"#shftable"+nc.id,"shf"+nc.id);
	nc.calculatemagnitude();
	nc.setallmarkeroid("#shfamark");

	if (nc.childclusters.length + nc.childnodes.length < 2) {
		// Just an empty/invisible placeholder for a node cluster that is too small
		$('#shfaccordion'+nc.id).css("display", "none");
		// Check whether there are any cluster remaining visible
		var it = new NodeClusterIterator({project:Project.cid, isroot:true});
		for (it.first(); it.notlast(); it.next()) {
			nc = it.getNodeCluster();
			if (nc.childclusters.length + nc.childnodes.length >= 2)
				return;
		}
		// None were visible
		$('#noshf').css('display', 'block');
		$('#someshf').css('display', 'none');
		return;
	}

	$('#shfaccordion'+nc.id).css("display", "block");
	$('#tdom'+nc.id).append( listFromCluster(nc) );
	nc.setallmarkeroid("#shfamark");
	$('#tdom'+nc.id+' .tlistitem').draggable({
		containment: '#tdom'+nc.id,
		revert: "invalid",
		revertDuration: 300, // Default is 500 ms
		axis: 'y',
		scrollSensitivity: 40,
		scrollSpeed: 10
	});
	$('.tlistitem,.tlistroot').droppable({
		accept: allowDrop,
		activeClass: 'tlisthigh',
		addClasses: false,
		hoverClass: 'tlisthover',
		drop: nodeClusterReorder
	});
	$('.litext').editInPlace({
		bg_over: "rgb(255,204,102)",
		callback: function(domid, enteredText) { 
			var nc = NodeCluster.get( nid2id(domid) );
			nc.settitle(enteredText);
			$('#dth_shf'+nc.root()+'name'+nc.thrass).html(H(nc.title));
			transactionCompleted("Rename cluster");
			return H(nc.title);
		}
	});
}

function listFromCluster(nc) {
	var str;
	if (nc.isroot()) {
		str = '\n\
			<ul id="tlist_ID_" class="tlist" style="padding-left: 0px;">\n\
			<li id="linode_ID_" class="tlistroot clusternode ui-state-default ui-state-selected">\n\
			_TI_ (_TY_)\n\
			</li>\n\
		';
	} else {
		str = '\n\
			<ul id="tlist_ID_" class="tlist">\n\
			<li id="linode_ID_" class="tlistitem clusternode ui-state-default ui-state-selected">\n\
			<span id="litext_ID_" class="litext">_TI_</span><span id="shfamark_ID_"></span></a>\n\
			</li>\n\
		';
	}
	str = str.replace(/_ID_/g, nc.id);
	str = str.replace(/_TI_/g, H(nc.title));
	str = str.replace(/_TY_/g, Rules.nodetypes[nc.type]);
	
	for (var i=0; i<nc.childclusters.length; i++) {
		var cc = NodeCluster.get(nc.childclusters[i]);
		str += '<li>\n';
		str += listFromCluster(cc);
		str += '</li>\n';
	}
	if (nc.isroot()) {
		str += '<li>&nbsp;</li>\n';
	}
	for (i=0; i<nc.childnodes.length; i++) {
		var rn = Node.get(nc.childnodes[i]);
		if (rn==null)
			bugreport("Child node does not exist","listFromCluster");
		str += '<li id="linode'+rn.id+'_'+nc.id+'" class="tlistitem childnode">\n';
		str += rn.htmltitle();
		if (Preferences.label && rn.color!="none") {
			var p = Project.get(Project.cid);
			str += '<div class="shflabelgroup"><div class="smallblock B_CO_"></div><span class="labelind">'+H(p.strToLabel(rn.color))+'</span></div>';
			str = str.replace(/_CO_/g, rn.color);
		}
		str += '</li>\n';
	}
		 
	str += '</ul>\n';
	return str;
}

function appendAllThreats(nc,domid,prefix) {
	if (DEBUG && nc==null)
		bugreport("nc is null","appendAllThreats");
	var th = ThreatAssessment.get(nc.thrass);
	if (nc.childnodes.length>1) {
		// Only paint threat assessment if at least two child nodes (clusters don't count)
		th.addtablerow(domid,prefix,false);
	} else {
		// If less than two children, then this thrass must not contribute to the cluster total.
		//
		// This logic should probably move into rasterNodeCluster?
		//
		th.setfreq('-');
		th.setimpact('-');
	}
	for (var i=0; i<nc.childclusters.length; i++) {
		var cc = NodeCluster.get(nc.childclusters[i]);
		appendAllThreats(cc,domid,prefix);
	}
}

/* To work around a bug in jQuery UI 
 * When a draggable is destroyed inside the drop handler, jQuery gives an error:
 *
 *		d(this).data("draggable") is undefined
 *
 * As a workaround, delay repainting (and hence destruction) of <li> elements
 * a single millisecond, so that it executes *after* the drop handler has completed.
 */
function triggerRepaint(elem) {
	setTimeout(function(){
		repaintTDom(elem);
	},5);
}

/* 
	Drag node onto node, belonging to the same cluster, #childnodes>2:
	Create a new node cluster, containing those two nodes.
	Remove the two nodes from the containing cluster.
	Set the parent cluster to the containing cluster.
	Add the new cluster to the containing cluster, and repaint.
 
	Drag node onto node, belonging to the same cluster, #childnodes==2:
	do nothing.

	Drag node onto node, belonging to a different cluster: invalid.
 
	Drag node onto cluster (not being its containing cluster):
	Move that node into the cluster.
	If the node's old containing cluster is not root and now contains only a single
	node and no child cluster, then move the remaining node into the
	parent of the containing cluster, and remove the (now empty)
	containint cluster.
	If the node's old containing cluster is not root and now contains only a single 
	child cluster and no child nodes, then move the remaining cluster
	into the parent of the containing cluster, and remove the (now
	empty) containing cluster.

	Drag node onto its contaning cluster: do nothing.
	
	Drag a root cluster: invalid.
 
	Drag cluster onto cluster that is one of its descendants:
	Invalid.
 
	Drag cluster onto its parent cluster:
	Dissolve the cluster, by moving its child nodes and clusters into
	its parent cluster, and removing the (now empty) cluster.
 
	Drag cluster onto a cluster, that is neither a descendant nor
	its parent: move the cluster into that other cluster.
	
	Drag cluster onto a node: invalid.
	
	Drop onto self (either node or cluster): invalid.
 */
function nodeClusterReorder(event,ui) {
	var dragid = ui.draggable[0].id;
	var dropid = this.id;
	// Only valid drops are to be expected.
	var drag_n=null, drag;	// source node and cluster
	var drop_n=null, drop; // destination node and cluster
	var drag_cluster, drop_cluster, parent_cluster, root_cluster;
	
	drag = nid2id(dragid);
	dragid = dragid.replace(/\d+$/,"");
	dragid = dragid.replace(/\D+$/,"");
	dragid = nid2id(dragid);
	if (!isNaN(dragid))
		drag_n = dragid;
	
	drop = nid2id(dropid);
	dropid = dropid.replace(/\d+$/,"");
	dropid = dropid.replace(/\D+$/,"");
	dropid = nid2id(dropid);
	if (!isNaN(dropid))
		drop_n = dropid;

	if (drag!=null)
		drag_cluster = NodeCluster.get(drag);
	if (drop!=null)
		drop_cluster = NodeCluster.get(drop);
	if (drop_cluster)
		root_cluster = NodeCluster.get(drop_cluster.root());

	if (drag_n!=null) {
		// A node is being dragged
		if (drop_n!=null && drag==drop) {
			// Dropped on a node of the same cluster
			var nc = new NodeCluster(drag_cluster.type);
			nc.setproject(drag_cluster.project);
			nc.addchildnode(drag_n);
			nc.addchildnode(drop_n);
			drag_cluster.removechildnode(drag_n);
			drag_cluster.removechildnode(drop_n);
			nc.setparent(drag);
			nc.addthrass();
			drag_cluster.addchildcluster( nc.id );
			root_cluster.calculatemagnitude();
			root_cluster.normalize();
			triggerRepaint(root_cluster.id);
			transactionCompleted("Create cluster");
		} else if (drop_n!=null && drag!=drop) {
			bugreport("Node dropped on node of a different cluster","nodeClusterReorder");
		} else if (drop_n==null && drag==drop) {
			bugreport("Node dropped on its containing cluster","nodeClusterReorder");
		} else if (drop_n==null && drag!=drop) {
			// Dropped into a different cluster
			drop_cluster.addchildnode(drag_n);
			drag_cluster.removechildnode(drag_n);
			if (!drag_cluster.isroot() 
			 && drag_cluster.childnodes.length==1
			 && drag_cluster.childclusters.length==0
			) {
				parent_cluster = NodeCluster.get(drag_cluster.parentcluster);
				parent_cluster.addchildnode(drag_cluster.childnodes[0]);
				drag_cluster.removechildnode(drag_cluster.childnodes[0]);
				parent_cluster.removechildcluster(drag);
				drag_cluster.destroy();
			} else if (!drag_cluster.isroot() 
			 && drag_cluster.childnodes.length==0
			 && drag_cluster.childclusters.length==1
			) {
				parent_cluster = NodeCluster.get(drag_cluster.parentcluster);
				parent_cluster.addchildcluster(drag_cluster.childclusters[0]);
				drag_cluster.removechildcluster(drag_cluster.childclusters[0]);
				parent_cluster.removechildcluster(drag);
				drag_cluster.destroy();
			}
			root_cluster.normalize();
			root_cluster.calculatemagnitude();
			triggerRepaint(root_cluster.id);
			transactionCompleted("Move node from cluster");
		}
	} else {
		// A cluster is being dragged
		if (DEBUG && drag_cluster.hasdescendant(drop)) {
			bugreport("Cluster dropped on a descendant","nodeClusterReorder");
		} else if (drop_n!=null) {
			bugreport("Cluster dropped on a node","nodeClusterReorder");
		} else if (drop_n==null && drop==drag_cluster.parentcluster) {
			// Cluster dropped on its parent cluster
			for (var i=0; i<drag_cluster.childnodes.length; i++)
				drop_cluster.addchildnode(drag_cluster.childnodes[i]);
			for (i=0; i<drag_cluster.childclusters.length; i++)
				drop_cluster.addchildcluster(drag_cluster.childclusters[i]);
			drop_cluster.removechildcluster(drag_cluster.id);
			drag_cluster.destroy();
			root_cluster.normalize();
			root_cluster.calculatemagnitude();
			triggerRepaint(root_cluster.id);
			transactionCompleted("Remove cluster");
		} else {
			// Cluster dropped on a different cluster
			parent_cluster = NodeCluster.get(drag_cluster.parentcluster);
			parent_cluster.removechildcluster(drag);
			drop_cluster.addchildcluster(drag);
			root_cluster.normalize();
			root_cluster.calculatemagnitude();
			triggerRepaint(root_cluster.id);
			transactionCompleted("Move cluster");
		}
	}
}

/* allowDrop: called at start of drag operation, to discover all permissible drop targets
 * this: a potential drop target
 * elem: the element being dragged
 * The function should return true if elem can be dropped on 'this'; false otherwise.
 *
 * See the comment at the start of nodeClusterReorder().
 * Elem dropped onto self: false.
 * Node dropped on node: only if member of the same cluster.
 * Node dropped onto cluster: only if target is not the node's cluster.
 * Cluster dropped onto node: false.
 * Cluster dropped onto cluster: only if target is not a descendant.
 */
function allowDrop(elem) {
	if (this==elem[0]) return false;
	// Source and target information
	var drag_n=null, drag;	// source node and cluster (id)
	var drop_n=null, drop; // destination node and cluster (id)
	var drag_cluster, drop_cluster; // source and destination clusters (object)
	
	var id = elem[0].id;
	drag = nid2id(id);
	id = id.replace(/\d+$/,"");
	id = id.replace(/\D+$/,"");
	id = nid2id(id);
	if (!isNaN(id))
		drag_n = id;
	
	id = this.id;
	drop = nid2id(id);
	id = id.replace(/\d+$/,"");
	id = id.replace(/\D+$/,"");
	id = nid2id(id);
	if (!isNaN(id))
		drop_n = id;
	
	drag_cluster = NodeCluster.get(drag);
	drop_cluster = NodeCluster.get(drop);

	if (drag_cluster==null) return false; // Could have been deleted in drop handler
	if (drag_cluster.root()!=drop_cluster.root()) return false;
	
	if (drag_n!=null) {
		// A node is being dragged
		if (drop_n!=null) {
			return (drag==drop && drag_cluster.childnodes.length+drag_cluster.childclusters.length>2);
		} else {
			return (drag!=drop);
		}
	} else {
		// A cluster is being dragged
		if (drop_n!=null) {
			return false;
		} else {
			return !(drag_cluster.hasdescendant(drop));
		}
	}
	bugreport("Unknown case","allowDrop");
	return false;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|     Analysis Tools      |* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


function initTabAnalysis() {
	$('#analysis_body').tabs();
	$('.tabs-bottom .ui-tabs-nav, .tabs-bottom .ui-tabs-nav > *' ).removeClass('ui-corner-all ui-corner-top').addClass('ui-corner-bottom');
}

function AddAllAnalysis() {
	paintNodeThreatTables();
	paintVulnsTable();
	paintNodeTypeStats();
	paintChecklistReports();
}

var FailureThreatSortOpt = {node: "threat", threat: "alpha"};

function paintNodeThreatTables() {
	ComponentExclusions = {};
	ClusterExclusions = {};

	$('#at1').empty();
	var snippet = '\
		<h1 class="printonly underlay projectname">_PN_</h1>\
		<h2 class="printonly underlay projectname">Single & Common Cause Failures versus Vulnerabilities</h2>\
	';
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	
	snippet += '\n\
		<table id="ana_nodethreattop" class="donotprint"><tr>\n\
		<td id="ana_nodesort">Sort nodes and clusters: <select id="ana_nodeselect">\n\
			<option value="threat">by Vulnerability level</option>\n\
			<option value="alpha">Alphabetically</option>\n\
			<option value="type">by Type</option>\n\
		</select></td>\n\
		<td id="ana_failuresort">Sort vulnerabilities: <select id="ana_failureselect">\n\
			<option value="alpha">Alphabetically</option>\n\
			<option value="type">by Type</option>\n\
			<!--option value="threat">by Vulnerability level</option-->\n\
		</select></td>\n\
		<td id="ana_exclusions">\n\
		<input type="button" id="quickwinslink" value="show Quick Wins">\n\
		<input type="button" id="clearexclusions" value="clear exclusions"><br>\n\
		<p class="donotprint">Click a coloured cell to include/exclude a failure or CCF</p>\n\
		</td></tr></table>\n\
		<div id="ana_nodethreattable"></div>\n\
		<div id="ana_ccftable"></div>\n\
	';
	$('#at1').html(snippet);
	$('#ana_nodeselect').change( function(){
		var selected = $('#ana_nodeselect option:selected').val();
		FailureThreatSortOpt.node = selected;
		paintSFTable();
		paintCCFTable();
	});
	$('#ana_failureselect').change( function(){
		var selected = $('#ana_failureselect option:selected').val();
		FailureThreatSortOpt.threat = selected;
		paintSFTable();
		paintCCFTable();
	});
	$('#quickwinslink').button().button('option','disabled',false).click( function() {
		var exclCm = computeComponentQuickWins();
		var exclCl = computeClusterQuickWins();
		ComponentExclusions = { };
		ClusterExclusions = { };
		for (var i=0; i<exclCm.length; i++)
			ComponentExclusions[exclCm[i]] = true;
		for (i=0; i<exclCl.length; i++)
			ClusterExclusions[exclCl[i]] = true;
		paintSFTable();
		paintCCFTable();
		$('#clearexclusions').button('option','disabled', (exclCm.length==0 && exclCl.length==0));
	});
	$('#clearexclusions').button().button('option','disabled',true).click( function() {
		ComponentExclusions = { };
		ClusterExclusions = { };
		paintSFTable();
		paintCCFTable();
		$('#clearexclusions').button('option','disabled',true);
	});
	
	paintSFTable();
	paintCCFTable();

	$('#ana_nodeselect').val(FailureThreatSortOpt.node);
	$('#ana_failureselect').val(FailureThreatSortOpt.threat);
}

// Two associative arrays that record the single failures and CCFs that have been
// marked as disabled/excluded. These failures will not contribute to the total
// vulnerability score for that item. This allows simple "what if" analysis.
// Keys are strings; when a key is present its value is always 'true'.
// ComponentExclusions: component ID + '_' + threatassessment ID
// ClusterExclusions: cluster ID + '_0'
// These two values are also recorded on the <TD> table cells, as the attributes
// 'component', 'threat', and 'cluster'. These attributes are inspected in
// the click-event handler on $('.nodecell') and $('.clustercell').
//
var ComponentExclusions = {};
var ClusterExclusions = {};

// Returns true iff Node id nid and ThreatAssessment id tid are in the exclusions list
function exclusionsContains(list,nid,tid) {
	return list[nid+"_"+tid];
}
function exclusionsRemove(list,nid,tid) {
	delete list[nid+"_"+tid];
}
function exclusionsAdd(list,nid,tid) {
	list[nid+"_"+tid] = true;
}
function exclusionsIsEmpty(list) {
	var x;
	for (x in list) { return false; }
	return true;
}

// Returns an array contaiing keys for ComponentExclusions
function computeComponentQuickWins() {
	var suggestions = [];
	var cit = new ComponentIterator({project: Project.cid});
	
	// Cycle over all of the nodes (components, really)
	for (cit.first(); cit.notlast(); cit.next()) {
		var cm = cit.getcomponent();
		// Don't bother with incomplete or low-risk components
		if (cm.magnitude=='-' || cm.magnitude=='L' || cm.magnitude=='U')
			continue;
		// Cycle over all vulnerabilities, and count how many are equal to the overall magnitude.
		// There must be at least one such vuln!
		var cnt = 0;
		for (var i=0; i<cm.thrass.length; i++) {
			var ta = ThreatAssessment.get(cm.thrass[i]);
			if (ta.total==cm.magnitude) {
				var keepid = ta.id;
				cnt++;
			}
		}
		// If there is only one such vuln, then it is a quick win
		if (cnt==1)
			suggestions.push(cm.id+'_'+keepid);
	}
	return suggestions;
}

// Returns an array containing keys for ClusterExclusions
function computeClusterQuickWins() {
	var suggestions = [];
	var ncit = new NodeClusterIterator({project: Project.cid, isroot: true, isstub: false});

	for (ncit.first(); ncit.notlast(); ncit.next()) {
		var cl = ncit.getNodeCluster();
		// Don't bother with incomplete or low-risk clusters
		if (cl.magnitude=='-' || cl.magnitude=='L' || cl.magnitude=='U')
			continue;
		
		var candidates = cl.allclusters();
		for (var i=0; i<candidates.length; i++) {
			var aarr = {};
			exclusionsAdd(aarr,candidates[i],0);
			if (ClusterMagnitudeWithExclusions(cl,aarr) != cl.magnitude)
				suggestions.push(candidates[i]+'_0');
		}
	}
	
	return suggestions;
}

function paintSFTable() {
	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	var cit = new ComponentIterator({project: Project.cid});
		
	switch (FailureThreatSortOpt.node) {
	case "alpha":
		cit.sortByName();
		break;
	case "type":
		cit.sortByType();
		break;
	case "threat":
		cit.sortByLevel();
		break;
	default:
		bugreport("Unknown component sort option","paintSFTable");
	}
	
	switch (FailureThreatSortOpt.threat) {
	case "alpha":
		tit.sortByName();
		break;
	case "type":
		tit.sortByType();
		break;
//	case "threat":
//		tit.sortByLevel();
//		break;
	default:
		bugreport("Unknown threat sort option","paintSFTable");
	}
	
	$('#ana_nodethreattable').empty();
	var numthreats = 0;
	var Nodesum = [];
	for (tit.first(); tit.notlast(); tit.next()) numthreats++;
	// If the table would be empty, then don't paint row and column headers
	// but show a message instead
	if (numthreats==0) {
		$('#ana_nodethreattable').html('\
		<p style="margin-left:3em; width:50em;">This space will show an overview of all diagram nodes and their vulnerabilities.\n\
		Since all service diagrams are empty, there is nothing to see here yet.\n\
		Add some nodes to the diagrams first.</p>\n\
		');
		return;
	}
	
	// Initialise to '-'
	for (cit.first(); cit.notlast(); cit.next()) Nodesum[cit.getcomponentid()] = '-';

	// Do the header
	var snippet = '\n\
		<table style="width:_TW_em">\n\
		<colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
		<colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
		<thead>\n\
		 <tr>\n\
		  <td class="nodetitlecell largetitlecell">Single failures</td>\n\
	';
	// 20em = width of first column
	// 1.7em = width of threat columns
	// numthreats = number of threat columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*(numthreats+1));
	snippet = snippet.replace(/_NT_/, numthreats+1);
	for (tit.first(); tit.notlast(); tit.next()) {
		var nc = tit.getNodeCluster();
		snippet += '<td class="headercell">'+H(nc.title)+'</td>\n';
	}	
	snippet += '<td class="headercell"><b>Overall</b></td>\n\
		 </tr>\n\
		</thead>\n\
		<tbody>\n\
	';
	// Do each of the table rows
	for (cit.first(); cit.notlast(); cit.next()) {
		var cm = cit.getcomponent();
		snippet += '<tr><td class="nodetitlecell">';
		snippet += H(cm.title);
		snippet += '&nbsp;</td>';
		for (tit.first(); tit.notlast(); tit.next()) {
			nc = tit.getNodeCluster();
			// Find the threat assessment for this node
			for (var i=0; i<cm.thrass.length; i++) {
				var ta = ThreatAssessment.get(cm.thrass[i]);
				if (ta.title==nc.title && ta.type==nc.type) break;
			}
			if (ta.title==nc.title && ta.type==nc.type) {
				snippet += '<td class="nodecell _EX_ M_CL_" component="_NO_" threat="_TH_" title="_TI_">_TO_</td>';
				snippet = snippet.replace(/_CL_/g, ThreatAssessment.valueindex[ta.total]);
				snippet = snippet.replace(/_TO_/g, ta.total);
				snippet = snippet.replace(/_TI_/g, H(cm.title)+" / "+H(ta.title)+" ("+Rules.nodetypes[ta.type]+")");
				snippet = snippet.replace(/_NO_/g, cm.id);
				snippet = snippet.replace(/_TH_/g, ta.id);
				snippet = snippet.replace(/_EX_/g, exclusionsContains(ComponentExclusions,cm.id,ta.id)?"excluded":"" );
				if (!exclusionsContains(ComponentExclusions,cm.id,ta.id))
					Nodesum[cm.id] = ThreatAssessment.sum(Nodesum[cm.id], ta.total);
			} else {
				snippet += '<td class="blankcell">&thinsp;</td>';
			}
		}	
		snippet += '<td class="M_CL_" title="_TI_">_TO_</td><td>_ZZ_</td></tr>\n';
		snippet = snippet.replace(/_CL_/g, ThreatAssessment.valueindex[Nodesum[cm.id]]);
		snippet = snippet.replace(/_TO_/g, Nodesum[cm.id]);
		snippet = snippet.replace(/_TI_/g, H(cm.title)+" / overall vulnerability level");
		if (cm.magnitude==Nodesum[cm.id])
			snippet = snippet.replace(/_ZZ_/g, '');
		else
			snippet = snippet.replace(/_ZZ_/g, '<span class="reduced">reduced</span>');
	}
	// Do the ending/closing
	snippet += '\n\
		</tbody>\n\
		</table>\n\
	';
	$('#ana_nodethreattable').html(snippet);

	$('.nodecell').click( function(evt){
		var cmid = parseInt($(evt.currentTarget).attr('component'),10);
		var tid = parseInt($(evt.currentTarget).attr('threat'),10);
		if (exclusionsContains(ComponentExclusions,cmid,tid)) {
			exclusionsRemove(ComponentExclusions,cmid,tid);
			$('#clearexclusions').button('option','disabled',exclusionsIsEmpty(ComponentExclusions));
		} else {
			exclusionsAdd(ComponentExclusions,cmid,tid);
			$('#clearexclusions').button('option','disabled',false);
		}
		paintSFTable();
	});
}

function paintCCFTable() {
	var ncit = new NodeClusterIterator({project: Project.cid, isroot: true, isstub: false});
	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
    
	switch (FailureThreatSortOpt.node) {
	case "alpha":
		ncit.sortByName();
		break;
	case "type":
		ncit.sortByType();
		break;
	case "threat":
		ncit.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","paintSFTable");
	}
	
	switch (FailureThreatSortOpt.threat) {
        case "alpha":
            tit.sortByName();
            break;
        case "type":
            tit.sortByType();
            break;
        default:
            bugreport("Unknown threat sort option","paintSFTable");
	}

	$('#ana_ccftable').empty();
	var numthreats = 0;
	for (tit.first(); tit.notlast(); tit.next()) numthreats++;
	// Do not paint an empty table
	ncit.first();
	if (!ncit.notlast() || numthreats==0)
		return;

	// Do the header
	var snippet = '\n\
    <table style="width:_TW_em">\n\
    <colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
    <colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
    <thead>\n\
    <tr>\n\
    <td class="nodetitlecell largetitlecell">Common cause failures</td>\n\
	';
	// 20em = width of first column
	// 1.7em = width of threat columns
	// numthreats = number of threat columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*(numthreats+1));
	snippet = snippet.replace(/_NT_/, numthreats+1);
	for (tit.first(); tit.notlast(); tit.next()) {
		var nc = tit.getNodeCluster();
		snippet += '<td class="printonlycell headercell">'+H(nc.title)+'</td>\n';
	}	
	snippet += '<td class="printonlycell headercell"><b>Overall</b></td>\n\
		 </tr>\n\
		</thead>\n\
		<tbody>\n\
	';

    // Do each of the table rows
	for (ncit.first(); ncit.notlast(); ncit.next()) {
		var cl = ncit.getNodeCluster();
		var ta = ThreatAssessment.get(cl.thrass);

		var col;
		for (tit.first(),col=0; tit.notlast(); tit.next(),col++) {
			if (tit.getNodeClusterid()==ncit.getNodeClusterid()) break;
		}

		snippet += addCCFTableRow(col,numthreats,ta,cl,0);

		col++;
	}	
    
	// Do the ending/closing
	snippet += '\n\
    </tbody>\n\
    </table>\n\
	<br><br>\n\
	';
	$('#ana_ccftable').html(snippet);

	$('.clustercell').click( function(evt){
		var cid = parseInt($(evt.currentTarget).attr('cluster'),10);
//		var tid = parseInt($(evt.currentTarget).attr('threat'),10);
		if (exclusionsContains(ClusterExclusions,cid,0))
			exclusionsRemove(ClusterExclusions,cid,0);
		else
			exclusionsAdd(ClusterExclusions,cid,0);
		paintCCFTable();
	});
}

function addCCFTableRow(col,numthreats,ta,cl,indent) {
	var suffix = "";
	if (indent>0)
		suffix = " :" + new Array(indent+1).join("&nbsp;&nbsp;");
	var snippet = '<tr><td class="nodetitlecell">'+H(cl.title)+suffix+'&nbsp;</td>\n';
	for (var i=0; i<numthreats; i++) {
		if (i==col) {
			snippet += '<td class="clustercell _EX_ M_CL_" cluster="_CI_" title="_TI_">_TO_</td>';
			snippet = snippet.replace(/_CL_/g, ThreatAssessment.valueindex[ta.total]);
			snippet = snippet.replace(/_TO_/g, ta.total);
			snippet = snippet.replace(/_TI_/g, "CCF for "+H(cl.title)+" ("+Rules.nodetypes[cl.type]+")");
//			snippet = snippet.replace(/_TH_/g, ta.id);
			snippet = snippet.replace(/_CI_/g, cl.id);
			snippet = snippet.replace(/_EX_/g, exclusionsContains(ClusterExclusions,cl.id,0)?"excluded":"" );
		} else {
			snippet += '<td class="'+(indent>0?'continuationcell':'blankcell')+'">&thinsp;</td>';
		}
	}
	if (cl.childclusters.length==0 && indent>0) {
		snippet += '<td class="continuationcell">&thinsp;</td><td></td></tr>\n';
	} else {
		snippet += '<td class="clustercell M_CL_" title="_TI_">_TO_</td><td>_ZZ_</td></tr>\n';
		var clustertotal = ClusterMagnitudeWithExclusions(cl,ClusterExclusions);
		snippet = snippet.replace(/_CL_/g, ThreatAssessment.valueindex[clustertotal]);
		snippet = snippet.replace(/_TO_/g, clustertotal);
		snippet = snippet.replace(/_TI_/g, "Total for "+H(cl.title)+" ("+Rules.nodetypes[cl.type]+")");
		if (cl.magnitude==clustertotal)
			snippet = snippet.replace(/_ZZ_/g, '');
		else
			snippet = snippet.replace(/_ZZ_/g, '<span class="reduced">reduced</span>');
	}
	for (i=0; i<cl.childclusters.length; i++) {
		var ccl = NodeCluster.get(cl.childclusters[i]);
		ta = ThreatAssessment.get(ccl.thrass);
		snippet += addCCFTableRow(col,numthreats,ta,ccl,indent+1);
	}

	return snippet;
}

function ClusterMagnitudeWithExclusions(cl,list) {
	if (cl.thrass==null)
		return '-';
	var ta = ThreatAssessment.get(cl.thrass);
	var mag = exclusionsContains(list,cl.id,0) ? "U" : ta.total;
	for (var i=0; i<cl.childclusters.length; i++) {
		var cc = NodeCluster.get(cl.childclusters[i]);
		mag = ThreatAssessment.sum(mag,ClusterMagnitudeWithExclusions(cc,list));
	}
	return mag;
}

function paintVulnsTable() {
	var snippet = '\
		<h1 class="printonly underlay">Reports and Analysis Tools</h1>\
		<h2 class="printonly underlay projectname">Project: _PN_</h2>\
		<h2 class="printonly underlay projectname">Vulnerability assessment details</h2>\
	';
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	$('#at2').html(snippet);
	// Frequency
	snippet = paintVulnsTableType(1);

	// If the table would be empty, then don't paint row and column headers
	// but show a message instead
	if (snippet=="") {
		snippet = '\
		<p style="margin-left:3em; margin-top:4em; width:50em;">This space will show an overview of all vulnerabilities and their severities.\n\
		Since all service diagrams are empty, there is nothing to see here yet.\n\
		Add some nodes to the diagrams first.</p>\n\
		';
	} else {
		// Impact
		snippet += paintVulnsTableType(2);
		// Total
		snippet += paintVulnsTableType(0);
	}

	$('#at2').append(snippet);
}

/* paintVulnsTableType(t): create HTML code for vulnerabilities tables
 *
 * t==0: vulnerability level
 * t==1: frequency
 * t==2: impact
 *
 * Returns an HTML snippet for the table, or an empty string when there are no vulnerabilities to show.
 */
function paintVulnsTableType(tabletype) {
	var switchvar;
	var v_total = {};
	var v_U = {'__TOTAL__':0};
	var v_L = {'__TOTAL__':0};
	var v_M = {'__TOTAL__':0};
	var v_H = {'__TOTAL__':0};
	var v_V = {'__TOTAL__':0};
	var v_X = {'__TOTAL__':0};
	var v_A = {'__TOTAL__':0};
	var v_N = {'__TOTAL__':0};
	// Use tit to iterate over all vulns
	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	tit.sortByType();
	
	// Precompute all numbers
	// Iterate over all non-actor nodes
	var nit = new NodeIterator({project: Project.cid, match: 'tUNK'});
	for (nit.first(); nit.notlast(); nit.next()) {
		var node = nit.getnode();
		var cm = Component.get(node.component);
		// Count 'single' node classes only once
		if (cm.single && cm.nodes[0]!=node.id)
			continue;
		for (var i=0; i<cm.thrass.length; i++) {
			var ta = ThreatAssessment.get(cm.thrass[i]);
			var t = ta.title + ' (' + Rules.nodetypes[ta.type] + ')';
			if (v_total[t]) v_total[t]++; else v_total[t]=1;
			switchvar = (tabletype==0 ? ta.total : (tabletype==1 ? ta.freq : ta.impact) );
			switch (switchvar) {
			case 'U': v_U['__TOTAL__']++; if (v_U[t]>0) v_U[t]++; else v_U[t]=1; break;
			case 'L': v_L['__TOTAL__']++; if (v_L[t]>0) v_L[t]++; else v_L[t]=1; break;
			case 'M': v_M['__TOTAL__']++; if (v_M[t]>0) v_M[t]++; else v_M[t]=1; break;
			case 'H': v_H['__TOTAL__']++; if (v_H[t]>0) v_H[t]++; else v_H[t]=1; break;
			case 'V': v_V['__TOTAL__']++; if (v_V[t]>0) v_V[t]++; else v_V[t]=1; break;
			case 'X': v_X['__TOTAL__']++; if (v_X[t]>0) v_X[t]++; else v_X[t]=1; break;
			case 'A': v_A['__TOTAL__']++; if (v_A[t]>0) v_A[t]++; else v_A[t]=1; break;
			case '-': v_N['__TOTAL__']++; if (v_N[t]>0) v_N[t]++; else v_N[t]=1; break;
			default:
	            bugreport("Unknown threat-value","paintVulnsTable");
			}
		}
	}
	var grandtotal = v_U['__TOTAL__']+v_L['__TOTAL__']+v_M['__TOTAL__']+v_H['__TOTAL__']+
		v_V['__TOTAL__']+v_X['__TOTAL__']+v_A['__TOTAL__']+v_N['__TOTAL__'];
	if (grandtotal==0)
		return "";
	    
	// Do the header
	var snippet = '\n\
	<a name="frag__TT_"><br><br>Jump to:</a>&nbsp;<a href="#frag_frequencies">Frequencies</a>&nbsp;&nbsp;<a href="#frag_impacts">Impacts</a>&nbsp;&nbsp;<a href="#frag_levels">Overall levels</a><br>\n\
    <table class="SFvulnstable" style="width:57em">\n\
    <colgroup><col span="1" style="width:30em"></colgroup>\n\
    <colgroup><col span="9" style="width:3em"></colgroup>\n\
    <thead>\n\
    <tr>\n\
    <td class="nodetitlecell largetitlecell">Single vulnerability _TT_</td>\n\
    <td class="headercell">U: extremely low</td>\n\
    <td class="headercell">L: low</td>\n\
    <td class="headercell">M: medium</td>\n\
    <td class="headercell">H: high</td>\n\
    <td class="headercell">V: extremely high</td>\n\
    <td class="headercell">X: unknown</td>\n\
    <td class="headercell">A: ambiguous</td>\n\
    <td class="headercell">-: undetermined</td>\n\
    <td class="headercell"><b>Total</b></td>\n\
	</tr>\n\
	</thead>\n\
	<tbody>\n\
	<tr class="thinrow">\n\
	  <td></td>\n\
	  <td class="M2"></td>\n\
	  <td class="M3"></td>\n\
	  <td class="M4"></td>\n\
	  <td class="M5"></td>\n\
	  <td class="M6"></td>\n\
	  <td class="M7"></td>\n\
	  <td class="M1"></td>\n\
	  <td class="M0" style="border:1px solid grey;"></td>\n\
	</tr>\n\
	';
	
	snippet = snippet.replace(/_TT_/g, (tabletype==0 ? "levels" : (tabletype==1 ? "frequencies" : "impacts") ));
    // Do each of the table rows
    var col = 0;
	for (tit.first(); tit.notlast(); tit.next()) {
		var cl = tit.getNodeCluster();
		ta = ThreatAssessment.get(cl.thrass);
		t = ta.title + ' (' + Rules.nodetypes[ta.type] + ')';

		snippet += '<tr><td class="nodetitlecell">'+H(t)+'&nbsp;</td>\n';
		if (v_U[t]>0) snippet += '<td class="blankcell">'+v_U[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_L[t]>0) snippet += '<td class="blankcell">'+v_L[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_M[t]>0) snippet += '<td class="blankcell">'+v_M[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_H[t]>0) snippet += '<td class="blankcell">'+v_H[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_V[t]>0) snippet += '<td class="blankcell">'+v_V[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_X[t]>0) snippet += '<td class="blankcell">'+v_X[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_A[t]>0) snippet += '<td class="blankcell">'+v_A[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		if (v_N[t]>0) snippet += '<td class="blankcell">'+v_N[t]+'</td>\n';
			else snippet += '<td class="blankcell"></td>\n';
		snippet += '<td>'+v_total[t]+'</td>\n';
		snippet += '</tr>\n';
	}	

	// Bottom row
	snippet += '<tr><td class="nodetitlecell"><b>Total</b>&nbsp;</td>\n';
	snippet += '<td>'+v_U['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_L['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_M['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_H['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_V['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_X['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_A['__TOTAL__']+'</td>\n';
	snippet += '<td>'+v_N['__TOTAL__']+'</td>\n';
	snippet += '<td>'+grandtotal+'</td>\n';
	snippet += '</tr>\n';

	// Do the ending/closing
	snippet += '\n\
	<tr class="thinrow">\n\
	  <td></td>\n\
	  <td class="M2"></td>\n\
	  <td class="M3"></td>\n\
	  <td class="M4"></td>\n\
	  <td class="M5"></td>\n\
	  <td class="M6"></td>\n\
	  <td class="M7"></td>\n\
	  <td class="M1"></td>\n\
	  <td class="M0" style="border:1px solid grey;"></td>\n\
	</tr>\n\
    </tbody>\n\
    </table>\n\
    <br><br>\n\
	';
	return snippet;
}


function paintNodeTypeStats() {
	var tStats = {};
	var tTot = 0;
	var numservice = 0;
	var sit = new ServiceIterator(Project.cid);

	$('#at3').empty();
	var snippet = '\
		<h1 class="printonly underlay">Reports and Analysis Tools</h1>\
		<h2 class="printonly underlay projectname">Project: _PN_</h2>\
		<h2 class="printonly underlay projectname">Node types counted by service</h2>\
	';
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	for (var typ in Rules.nodetypes) tStats[typ] = 0;
	snippet +='\n\
	<table><tr>\n\
	';
	for (sit.first(); sit.notlast(); sit.next()) {
		var s = sit.getservice();
		var sStats = {};
		var sTot = 0;
		var nit = new NodeIterator({service: s.id});

		for (typ in Rules.nodetypes) sStats[typ] = 0;
		snippet += '\n\
		<td>\n\
		<div id="servicestats_SI_" class="servicestats">\n\
		<b>_SN_</b><br>\n\
		<table class="statstable">\n\
		<thead><th class="statstype">Type</th><th class="statsnum">Num</th></thead>\n\
		<tbody>\n\
		';
		snippet = snippet.replace(/_SI_/g, s.id);
		snippet = snippet.replace(/_SN_/g, H(s.title));
		for (nit.first(); nit.notlast(); nit.next()) {
			var rn = nit.getnode();
			var cm = Component.get(rn.component);
			sStats[rn.type]++;
			sTot++;
			// Count 'single' node classes only once
			if (rn.component==null || !cm.single || cm.nodes[0]==rn.id) {
				tStats[rn.type]++;
				tTot++;
			}
		}
		for (typ in Rules.nodetypes) {
			snippet += '<tr><td class="statstype">'+Rules.nodetypes[typ]+'</td><td class="statsnum">'+sStats[typ]+'</td></tr>';
		}
		snippet += '\n\
		<tr><td class="statstype">Total</td><td class="statsnum">'+sTot+'</td></tr>\n\
		</tbody></table></div>\n\
		</td>\n\
		';
		numservice++;
		if (numservice%6==0) {
			snippet += '\n\
			</tr>\n\
			<tr>\n\
			';
		}
	}
	// Project total
	snippet += '\n\
	<td>\n\
	<div id="servicestatsTotal" class="servicestats">\n\
	<b>Entire project</b><br>\n\
	<table class="statstable">\n\
	<thead><th class="statstype">Type</th><th class="statsnum">Num</th></thead>\n\
	<tbody>\n\
	';
	for (typ in Rules.nodetypes) {
		snippet += '<tr><td class="statstype">'+Rules.nodetypes[typ]+'</td><td class="statsnum">'+tStats[typ]+'</td></tr>';
	}
	snippet += '\n\
	<tr><td class="statstype">Total</td><td class="statsnum">'+tTot+'</td></tr>\n\
	</tbody></table></div>\n\
	</td>\n\
	';
	// Finishing
	snippet += '\n\
	</tr></table>\n\
	';
	$('#at3').append(snippet);
}

function paintChecklistReports() {
	$('#at4').empty();
	var snippet = '\
		<h1 class="printonly underlay">Reports and Analysis Tools</h1>\
		<h2 class="printonly underlay projectname">Project: _PN_</h2>\
		<h2 class="printonly underlay projectname">Checklist usage</h2>\
	';
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	
	snippet += '\
	<h3>Removed vulnerabilities</h3>\n\
	';
	snippet += showremovedvulns();

	snippet += '\
	<h3>Custom vulnerabilities</h3>\n\
	';
	snippet += showcustomvulns();

	$('#at4').html(snippet);

}

function showremovedvulns() {
	var snippet = '';
	var num=0;
	var VulnIDs = [];	// list of all threat IDs that were removed at least once
	var CompIDs = [];	// list of all component IDs that had at least one threat removed
	var CompVulns = [];	// CompVulns[x] = list of threats removed for component with ID 'x'.
	var i,j,cm;

	// Iterate over all vulnerabilities to all components
	// First find all components with at least one vulnerability removed, and find all
	// vulnerabilities that were removed at least once.
	var cit = new ComponentIterator({project: Project.cid});
	cit.sortByName();
	for (cit.first(); cit.notlast(); cit.next()) {
		cm = cit.getcomponent();
		var tit = new ThreatIterator(Project.cid,cm.type);
		for (tit.first(); tit.notlast(); tit.next()) {
			var th = tit.getthreat();
			// Check whether this threat was used
			for (i=0; i<cm.thrass.length; i++) {
				var ta = ThreatAssessment.get(cm.thrass[i]);
				if (th.type==ta.type && th.title==ta.title)
					// we have a match
					break;
			}
			if (i<cm.thrass.length)
				continue;
			// We found a checklist threat that was not used on this component
			if (VulnIDs.indexOf(th.id)==-1)
				VulnIDs.push(th.id);
			if (CompIDs.indexOf(cm.id)==-1)
				CompIDs.push(cm.id);
			if (CompVulns[cm.id]==undefined)
				CompVulns[cm.id] = [];
			CompVulns[cm.id].push(th.id);
			num++;
		}
	}

	// Now go through the components again, and create the table.
	// Do the header
	snippet = '\n\
      <table style="width:_TW_em">\n\
      <colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
      <colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
      <thead>\n\
      <tr>\n\
      <td class="nodetitlecell largetitlecell"></td>\n\
	';
	// 20em = width of first column
	// 1.7em = width of threat columns
	// numthreats = number of threat columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*VulnIDs.length);
	snippet = snippet.replace(/_NT_/, VulnIDs.length);
	for (j=0; j<VulnIDs.length; j++) {
		snippet += '<td class="headercell">'+H(Threat.get(VulnIDs[j]).title)+'</td>\n';
	}	
	snippet += '\
	  </tr>\n\
	  </thead>\n\
	  <tbody>\n\
	';

    // Do each of the table rows
	for (i=0; i<CompIDs.length; i++) {
		cm = Component.get(CompIDs[i]);
		snippet += '<tr><td class="nodetitlecell">'+H(cm.title)+'</td>';
		for (j=0; j<VulnIDs.length; j++) {
			if (CompVulns[cm.id] && CompVulns[cm.id].indexOf(VulnIDs[j])==-1) {
				snippet += '<td class="blankcell"></td>';
			} else {
				snippet += '<td class="blankcell">X</td>';
			}
		}
		snippet += '</tr>\n';
	}	
    
	// Do the ending/closing
	snippet += '\n\
    </tbody>\n\
    </table>\n\
	';

	if (num==0)
		snippet += 'No checklist vulnerabilities have been discarded on components of this project.';
	else
		snippet += '<br>'+
			num+' checklist vulnerabilit'+(num==1?'y':'ies (for ')+VulnIDs.length+' unique vulnerabilit'+(VulnIDs.length==1?'y':'ies')+
			') discarded on '+
			CompIDs.length+' '+plural('component','s',CompIDs.length)+' of this project.';
	snippet += '<br><br>\n';

	return snippet;
}

function showcustomvulns() {
	var snippet = '';
	var num=0;
	var VulnTitles = [];// list of all threat titles that were removed at least once
	var CompIDs = [];	// list of all component IDs that had at least one threat removed
	var CompVulns = [];	// CompVulns[x] = list of threat titles removed for component with ID 'x'.
	var i,j,cm;

	// All checklist threats
	var tit = new ThreatIterator(Project.cid,'tUNK'); 

	// Iterate over all vulnerabilities to all components
	// First find all components with at least one vulnerability removed, and find all
	// vulnerabilities that were removed at least once.
	var cit = new ComponentIterator({project: Project.cid});
	cit.sortByName();
	for (cit.first(); cit.notlast(); cit.next()) {
		cm = cit.getcomponent();
		for (i=0; i<cm.thrass.length; i++) {
			var ta = ThreatAssessment.get(cm.thrass[i]);
			// Check whether this threat occurs in its checklist
			for (tit.first(); tit.notlast(); tit.next()) {
				var th = tit.getthreat();
				if (th.type==ta.type && th.title==ta.title)
					// we have a match
					break;
			}
			if (tit.notlast())
				continue;
			// We found a threat assessment that does not occur in the checklists
			if (VulnTitles.indexOf(ta.title)==-1)
				VulnTitles.push(ta.title);
			if (CompIDs.indexOf(cm.id)==-1)
				CompIDs.push(cm.id);
			if (CompVulns[cm.id]==undefined)
				CompVulns[cm.id] = [];
			CompVulns[cm.id].push(ta.title);
			num++;
		}
	}

	// Now go through the components again, and create the table.
	// Do the header
	snippet = '\n\
      <table style="width:_TW_em">\n\
      <colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
      <colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
      <thead>\n\
      <tr>\n\
      <td class="nodetitlecell largetitlecell"></td>\n\
	';
	// 20em = width of first column
	// 1.7em = width of threat columns
	// numthreats = number of threat columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*VulnTitles.length);
	snippet = snippet.replace(/_NT_/, VulnTitles.length);
	for (j=0; j<VulnTitles.length; j++) {
		snippet += '<td class="headercell">'+H(VulnTitles[j])+'</td>\n';
	}	
	snippet += '\
	  </tr>\n\
	  </thead>\n\
	  <tbody>\n\
	';

    // Do each of the table rows
	for (i=0; i<CompIDs.length; i++) {
		cm = Component.get(CompIDs[i]);
		snippet += '<tr><td class="nodetitlecell">'+H(cm.title)+'</td>';
		for (j=0; j<VulnTitles.length; j++) {
			if (CompVulns[cm.id] && CompVulns[cm.id].indexOf(VulnTitles[j])==-1) {
				snippet += '<td class="blankcell"></td>';
			} else {
				snippet += '<td class="blankcell">X</td>';
			}
		}
		snippet += '</tr>\n';
	}	
    
	// Do the ending/closing
	snippet += '\n\
    </tbody>\n\
    </table>\n\
	';

	if (num==0)
		snippet += 'No custom vulnerabilities have been added to any of the components in this project.';
	else
		snippet += '<br>'+
			num+' custom vulnerabilit'+(num==1?'y':'ies')+
			' (for '+VulnTitles.length+' unique vulnerabilit'+(VulnTitles.length==1?'y':'ies')+
			') added to '+
			CompIDs.length+' '+plural('component','s',CompIDs.length)+' of this project.';
	snippet += '<br><br>\n';
	
	return snippet;
}

/* H: make a string safe to use inside HTML code
 *
 * This function should be further up in this source file, but XCode fails to properly parse the
 * complex regex properly. Therefore included as last.
 */
function H(str) {
	return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}



/*,…....,.............,....,...,....................................... ......
........................,.......,.,.,...........................................
....................,..,..,.,,.,,...,,.,......,.................................
...........................,....,,,,,,,..,..,,,,................................
......................,,,,,,,,,,:::,,:,,,,::,,,.,.............................. 
....................,:,:::::::::,,,,,,,,,,,,,,:~:...,................. .........
.,.............,,:~===~~~~~:::,,,,,........,,,,:::~~::,,,............. .........
..............,:~+I?~~~~~~::,,,,,,..........,,:::~~=~~~~~::,....................
............,:+==?=~~~~~~::,,,.,.,...........,,,::::~====+?:,............ ......
...........:++++?=:~~=~:::,,......... . ....,,,,,,::~~~~=~+?=,..................
........,,,=I$?+~~~~~=:::,,... ....... ........,,,,,,~:~~=~=II~,................
..........=+7I++~~==~=~::,.....  .. . .............,,,:~~===?III,.,.........,...
.......,,::?7?=+====+~~~,,,,....,... .... .........,,,,,:~~~+I7I=,,,............
......,,:,:+777?==+++=~~::,,.....................,,,:,,::~~~=?7II::,............
.....,,.,,:?$77++++=++=~::,..... .. .  ...........,,,:::::~~=I???+=.,......,....
..,::~:=:+=I7Z7I++=+==~~:::,....... . .............,,,,:~~~=+II?$I$:,,..........
.,,:=+????77$I7?++======~~~~===~:,.,............,,::~~~~~~~=+?77I?~:,...,.......
,,,~~7ZOZD7$$ZI7?++=++==~~~~=?II?+=~::::::~,~~??I?I=:::::~~==?7$??=,,,,....,....
,,:~~=I+7OOO8MM$+++++III?7DMMMN$$ZZI?=:::++I7777I++==~~~~===+IIIII7+~:~,,.......
,~,~==I+?I$8$Z$MZ?++I7M8OM+OMMI8MOID?~,,:~IZM8MMMMMNZI:~+===+ZZ7$7777=::~,,.....
=,+~~??ZI$ZOZ$I??+IIIM7II+=NNM:+Z7+$$I=~=$OI$78+MMM==$7?OO7IM8O$$Z7O$~::~,,,....
:~::+?I$$78$$$I+++=+?+???+==IIIIZ7MMZ~:,,=MO?7777I+?7II?==~=+IZ$OOZZ?~::,,,,,...
:,~::77=$$Z$$M?=++==~~~~~~=++?I7I?+7:~::~~+=+I$I+==~~~:.~~:==+IZDZZ7?==~:,,,,,..
,,,:::,~~?$$$M+=?++==~:::~~==++++?+~=~::~==+===+?+~:,:,,:::=~7ZDNDZO$+?~~,,,....
:,,,,,,,:~I?7I=+??+?+++===~:~~~=++?+=:::~====~:::~~~:::::~~==$$7O$ZOZ$$+~~,,,.,.
:,,,,,,+8MMI+?==+?+??+++=~::::~~??+++,:,:+=+==~~::::~~~~~~=+~?7Z7O7I$III:~:,,...
:,,,,::~ZM77=++~++??????+=~::~+7?+IM$7?I?I++++~~~~::~~~===+===I7$7IZOI==~::,,,..
,,,,,,~=ZMMO=~~==+?+?++++=~~=+?=+$D$I7ZI+IN7++?+~~~~======++~=788I~:~:,:,,,..,.,
,,,,,,,,7MMMM7Z+=~+?I++===~~=~~:~~+=++??I??+=~=+=~~~=~~~~+::~?MMMM~::,,,,,.,,,..
,,,,,,,,:,+=MMM+=~?+?++=~=~~:~::~====?$++~+=+=~==~=~~~===~:~=8MMMN?:,,,,,,,,....
,,,,,,,::77+$8O++~==7=+=~===++I++~+=??O$+7=?+====~~~~~=+~:~7DMMMMI::,,,,,,,,..,.
::,,,:,::=MNMOM8=+~~+++==+?I8NMMZOND$Z7$D8777+=~==~~=:~~=:=NMD8=:::,,,,,,.,,..,.
:::,:,::::=OMMMI=?==~??=?=?I7$??II++II??+?77I$M$?+=++=~~~:+DMMI~:,:,,,,,,.,,.,..
::::,::::::::::::=~~==???IIZI?+?IIOZNZ7$7I?++=+77?=+~=~~=:?Z+=::,,,,,,,,,,,,....
::::::::::,::::::~=~~~?7I7I=II?III$ODDO8$$I?+++II?+~=:::~??~::,,,,,,,,,,,,,,,,,,
::::::::::::::::::~==+=I?7$=+++?=====+~~=+=++?++I7I+=~==+~~:::,:,,,,,,,,,,,,,,,,
:::::~::::::,,:,:::?++IZ7?7I++~=+++==II+==:~:=?+==+=+~=I:::::::,,,,,,,,,,,,,,,,,
:::~::~~:::::::::::+?IIZ$O7ZZ7I~=++?~I+~~=~:~++?$=I+==?+:::::::,,,,,,,,,,,,,,,,,
~~~~~~:::::::::::::++?II78MDODZZI=++Z?++??I=???77I+=+???::::::::,::,,,,,,,,,,,,,
~~:~:~::::::::::::=+??II777ZZOO8MN$ZMMMZ7I7ZZ$$7??+?+++?::::::::,::,:,,,,,,,:,,:
~~~~~~~~~~:::::~~~=+???III7$$OOONDMMMMM8D$77I$????+==+++~~~::::::::::,,,,,,,,,,:
~~~~~~~~~~:~~~~~$++???IIIIIIII7$$III??I?+I??++++++=++===IMMM~~::::::::::,:::::::
~~~~~~~~~~~~~OM8++??II?I?III??I?+=~~=~~~~~~==+++===+====???MM$:~~~::::::::::::::
=~~~~~~~~:?MMMZ++??III77IIIIIIII?+~~~::~~~===++++=++===+?++NMMMN~~~~~::::::::::~
~~~~~~~NMMMMMMM????IIIIII?IIIII777II?++=+??+???+?++==+=++=+MMMMMMMI==~~~~~~~~~~~
=~==ZMMMMMMMMMM7??II77777IIII77$7$Z8Z77I??+????+++++++=++=MMMMMMMMMMM+===~~~~~~~
=+MMMMMMMMMMMMMM$I77777777I??I$$777O8Z77???????++??+++=+7MMMMMMMMMMMMMMM+=====~=
MMMMMMMMMMMMMMMMMMI$$77$$77I?II7777I777II??++?????+++++MMMMMMMMMMMMMMMMMMMI+====
MMMMMMMMMMMMMMMMMMMMZZ7$$$$$III7$777II7IIII?+??+++??$MMMMMMMMMMMMMMMMMMMMMMMM7++
MMMMMMMMMMMMMMMMMMMMMMZ$$ZZZ$777777$$$$$II???++?I7MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
MMMMMMMMMMMMMMMMMMMMMMMMMMDN8$$$$77$777II????IDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMN$ZD88N888NNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM*/
