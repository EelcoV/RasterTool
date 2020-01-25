/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals
Component, ComponentIterator, NodeCluster, NodeClusterIterator, PreferencesObject, Project, ProjectIterator, Rules, Service, ServiceIterator, Threat, ThreatAssessment, ThreatIterator, Transaction, _t, transactionCompleted, unescapeNewlines, urlDecode, urlEncode
*/

"use strict";
//const DEBUG = true;  // set to false for production version
var DEBUG = true;  // set to false for production version

/* LS is prefixed to all keys of data entered into localStorage. The prefix
 * is versioned. In future, the app can check for presence of keys from
 * previous versions and perform an upgrade.
 */
var LS_prefix = 'raster';
var LS_version = 3;
var LS = LS_prefix+':'+LS_version+':';

/* Global preferences */
var Preferences;
var ToolGroup;
var GroupSettings;
//var UserLanguage;

#ifdef STANDALONE
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Glue code for Electron
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

var WindowID = null;

localStorage.clear();

var ipc=null, url=null;
if (typeof(process)=='object') {
	ipc = require('electron').ipcRenderer;
	url = require('url');
}

var Modified = false;

ipc && ipc.on('window-id', function(event,id) {
	WindowID = id;
});
ipc && ipc.on('document-start-save', function() {
	var s = CurrentProjectAsString();
	ipc && ipc.send('document-save',WindowID,s);
});
ipc && ipc.on('document-start-saveas', function() {
	var s = CurrentProjectAsString();
	ipc && ipc.send('document-saveas',WindowID,s);
});
ipc && ipc.on('document-save-success', function(event,docname) {
	clearModified();
	if (!docname)  return;
	docname = docname.replace(/\.raster$/,"");
	$('.projectname').html(H(docname));
	Project.get(Project.cid).settitle(docname);
});
ipc && ipc.on('document-start-open', function(event,str) {
	var newp = loadFromString(str,true,false,_("File"));
	if (newp!=null) {
		switchToProject(newp);
		checkForErrors(false);
		checkUpgradeDone();
	}
	clearModified();
});
ipc && ipc.on('options', function(event,option,val) {
	if (option=='labels') {
		Preferences.setlabel(val);
	}
	if (option=='vulnlevel') {
		if (val==0) {
			Preferences.setemblem('em_none');
		} else if (val==1) {
			Preferences.setemblem('em_small');
		} else {
			Preferences.setemblem('em_large');
		}
	}
});
ipc && ipc.on('help-show', function() {
	$('#helppanel').dialog('open');
});
ipc && ipc.on('find-show', function() {
	StartFind();
});
ipc && ipc.on('pdf-settings-show', function(event,pdfoptions) {
	if (pdfoptions.pdforientation==0) {
		$('#paperorientation_portrait').prop('checked',true);
	} else {
		$('#paperorientation_landscape').prop('checked',true);
	}
	if (pdfoptions.pdfsize==3) {
		$('#papersize_a3').prop('checked',true);
	} else {
		$('#papersize_a4').prop('checked',true);
	}
	$('#pdfscale_' + pdfoptions.pdfscale).prop('checked',true);
	$('#pdfoptions fieldset').controlgroup('refresh');
	$('#pdfoptions').dialog('open');
});

function setModified() {
	Modified = true;
	ipc && ipc.send('document-modified',WindowID);
}

function clearModified() {
	Modified = false;
}

function CurrentProjectAsString() {
	return exportProject(Project.cid);
}

#endif

/* This jQuery function executes when the document is ready, but before all
 * HTML objects have been painted.
 */
$( initAllAndSetup );

function initAllAndSetup() {
	$.ajaxSetup({
		timeout: 10000	// Cancel each AJAX request after 10 seconds
	});

#ifdef SERVER
	ToolGroup = $('meta[name="group"]').attr('content');
	getGroupSettings();
#else
	ToolGroup = '_%standalone%_';
	// Prevent file drops
	document.addEventListener('dragover', function(event) {event.preventDefault();} );
	document.addEventListener('drop', function(event) {event.preventDefault();} );

	// Some CSS tweaks for the standalone version
	$('.activator').hide();
	$('#currentProject').hide();
	$('#helpbutton').hide();
	$('.workouter').css('top', '0px');

	// PDF print options dialog
	$('#pdf_orientation span').html(_("Orientation:"));
	$('#label_portrait').html(_("Portrait"));
	$('#label_landscape').html(_("Landscape"));
	$('#pdf_papersize span').html(_("Paper size:"));
	$('#pdf_scale span').html(_("Scale:"));

	$('[for=paperorientation_portrait]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdforientation',0); });
	$('[for=paperorientation_landscape]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdforientation',1); });
	$('[for=papersize_a3]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfsize',3); });
	$('[for=papersize_a4]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfsize',4); });
	$('[for=pdfscale_40]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',40); });
	$('[for=pdfscale_50]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',50); });
	$('[for=pdfscale_60]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',60); });
	$('[for=pdfscale_70]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',70); });
	$('[for=pdfscale_80]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',80); });
	$('[for=pdfscale_90]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',90); });
	$('[for=pdfscale_100]').on('click',  function() { ipc && ipc.send('pdfoption-modified',WindowID,'pdfscale',100); });

	$('#pdfoptions').dialog({
		title: _("Settings for PDF"),
		autoOpen: false,
		modal: false,
		width: 420,
		resizable: false,
		buttons: [{ text: _("Done"),
			click: function() {$('#pdfoptions').dialog('close');}
		}]
	});
	// Don't print the settings dialog. This means you can leave it open while saving a PDF. Convenient!
	$('#pdfoptions').parent().addClass('donotprint');
#endif

	initTabDiagrams();
	initTabSingleFs();
	initTabCCFs();
	initTabAnalysis();

	$('#tabs').tabs({activate: vertTabSelected});
	$('#tabs').addClass('ui-tabs-vertical-sw ui-helper-clearfix');
	$('#tabs > ul').addClass('rot-neg-90');

	$('input[type=radio]').checkboxradio({icon: false});
	$('fieldset').controlgroup();

	$('input[type=button]').button();
	$('input[type=submit]').button();
	$('input[type=button]').css('padding','2px 11px');
	$('input[type=submit]').css('padding','2px 11px');

	$('#modaldialog').dialog({ autoOpen:false, modal:true, width: 400 });

	$('#tab_singlefs').on('click', removetransientwindows);
	$('#tab_ccfs').on('click', removetransientwindows);
	$('#tab_analysis').on('click', removetransientwindows);

	// tab_diagrams, tab_singlefs, tab_ccfs
	$("a[href^='#tab_diagrams']").attr('title', _("Draw diagrams for the services."));
	$("a[href^='#tab_singlefs']").attr('title', _("Assess all single failures."));
	$("a[href^='#tab_ccfs']").attr('title', _("Assess all common cause failures."));
	$("a[href^='#tab_analysis']").attr('title', _("Reporting and analysis tools."));
	$("a[href^='#tab_diagrams']").html(_("Diagrams"));
	$("a[href^='#tab_singlefs']").html(_("Single failures"));
	$("a[href^='#tab_ccfs']").html(_("Common cause failures"));
	$("a[href^='#tab_analysis']").html(_("Analysis"));

	// Make sure that each tool window has a unique name
	if (!window.name.match(/^RasterTool\d+$/)) {
		window.name = 'RasterTool'+String(Math.random()).substring(2);
	}

#ifdef SERVER
	if (!testLocalStorage()) {
		// The splash screen is still visible, and will obscure any interaction.
		$('#splashstatus').html( _("Error: no local storage available.<br>Adjust cookie or privacy settings?") );
		rasterAlert(_("Cannot continue"),
			_("HTML5 local storage is not supported by this browser or configuration. ")
			+ _("This app will not work properly. ")
			+ "<p>" + _("Try adjusting your cookie or privacy settings."));
	}
#endif

	// Load preferences
	Preferences = new PreferencesObject();
#ifdef STANDALONE
	Preferences.online = false;
#endif
	var remembertab = Preferences.tab;

#ifdef SERVER
	initLibraryPanel();
	initOptionsPanel();

	if (GroupSettings.classroom) {
		$("#classroom").html(_("Classroom version")).show();
	}
#endif

	SizeDOMElements();

#ifdef SERVER
	/* Loading data from localStorage. Tweaked for perfomance.
	 */
	var todelete = [];
	var strArr = [];
	for (var i=0, alen=localStorage.length; i<alen; i++) {
		var key = localStorage.key(i);
		if (key=='RasterToolIsLoaded') continue;
		todelete.push(key);
		strArr.push(key+'\t');
		strArr.push(localStorage[key]+'\n');
	}
	// Delete all localstorage items that we are about to parse.
	// They will be recreated anyway, but may have to be upgraded to a newer version along te way.
	alen=todelete.length;
	for (i=0; i<alen; i++) {
		localStorage.removeItem(todelete[i]);
	}
	var str = strArr.join("");
	if (
		loadFromString(str,true,true,"Browser local storage")!=null) {
		// Loading from localStorage succeeded. Try to active the project
		// indicated by Preferences.currentproject, or take any one project
		// if that one does not exist.
		i = Project.withTitle(Preferences.currentproject);
		var p = (i==null ? Project.firstProject() : Project.get(i) );
		if (p===0) {
			loadDefaultProject();
		} else {
			p.load();
			p.dorefresh(false); // Check for update on the server
			var it = new ServiceIterator(p.id);
			var found = false;
			var s;
			for (it.first(); !found && it.notlast(); it.next()) {
				s = it.getservice();
				found = (s.title == Preferences.service);
			}
			if (found) {
				Service.cid = s.id;
			}
		}
	} else {
		loadDefaultProject();
	}
	startAutoSave();
#else
	loadDefaultProject();
#endif

	// May be necessary to wait and resize
	window.setTimeout(SizeDOMElements, 1000);

	Preferences.settab(remembertab);
	forceSelectVerticalTab(Preferences.tab);

	$('#helptabs a').eq(0).html( _("Frequency") );
	$('#helptabs a').eq(1).html( _("Impact") );
	$('#helptabs a').eq(2).html( _("How to use") );
	$('#helptabs a').eq(3).html( _("About") );
	$('#helptabs a').eq(0).attr('href', _("../help/Frequency.html") );
	$('#helptabs a').eq(1).attr('href', _("../help/Impact.html") );
	$('#helptabs a').eq(2).attr('href', _("../help/Process.html") );
	$('#helptabs a').eq(3).attr('href', _("../help/About.html") );
	$('#helptabs li:last-of-type').css("margin-left","10px");

	$('#helppanel').dialog({
		title: _("Information on using this tool"),
		autoOpen: false,
		height: 450,
		minHeight: 120,
		width: 600,
		minWidth: 470,
		maxWidth: 800,
		open: function(/*event*/) {
			initFrequencyTool();
			$('#helptabs ul').width($('#helppanel').width()-14);
		},
		resize: function(/*event,ui*/) {
			$('#helptabs ul').width($('#helppanel').width()-14);
		}
	});
	$('#helppanel').dialog('widget').css('overflow','visible').addClass('donotprint');
	$('#helptabs').tabs({
		heightStyle: 'content',
		load: function(/*event,ui*/) {
			if ($('#helptabs').tabs('option','active')==0) {
				initFrequencyTool();
			}
		}
	});
	$('#helpbutton').attr('title', _("Assistance"));
	$('#helpbutton').on('click',  function() {
		$('#helppanel').dialog('open');
	});

#ifdef SERVER
	$('#undobutton').on('click', Transaction.undo);
	$('#redobutton').on('click', Transaction.redo);
	$('#undobutton').attr('title', _("Undo"));
	$('#redobutton').attr('title', _("Redo"));

	$('#findbutton').on('click', StartFind);
	$('#findbutton').attr('title', _("Locate nodes"));

	var flashTimer;
	$(document).ajaxSend(function(){
		window.clearTimeout(flashTimer);
		$('#networkactivity').removeClass('activityoff activityno').addClass('activityyes');
	});
	$(document).ajaxStop(function(){
		// Make sure that the activity light flashes at least some small time
		flashTimer = window.setTimeout(function(){
			$('#networkactivity').removeClass('activityoff activityyes').addClass('activityno');
		},200);
	});
#endif

	$('body').on('keydown', function(evt){
		// Backspace, unfortunately, is bound in the browser to 'Return to previous page'
		if (evt.key=='Backspace') {
			if (!$(evt.target).is('input:not([readonly]):not([type=radio]):not([type=checkbox]), textarea, [contentEditable], [contentEditable=true]')) {
				// Only when focus is NOT on input or textarea
				evt.preventDefault();
				return;
			}
		}
#ifdef SERVER
		// F1 (mostly for Windows): to trigger the Help panel
		if (evt.key=='F1') {
			$('#helpbutton img').trigger('click');
			evt.preventDefault();
			return;
		}
		// Cmd-F for MacOS or Ctrl-F for Windows: to trigger the Find panel
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='f') {
			$('#findbutton img').trigger('click');
			evt.preventDefault();
			return;
		}
		// Cmd-L for MacOS or Ctrl-L for Windows: to trigger the Library panel
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='l') {
			$('#libraryactivator').trigger('click');
			evt.preventDefault();
			return;
		}
		// Cmd-O for MacOS or Ctrl-O for Windows: to trigger the Options panel
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='o') {
			$('#optionsactivator').trigger('click');
			evt.preventDefault();
			return;
		}
#endif
		// Cmd-1 for MacOS or Ctrl-1 for Windows: to trigger the Diagrams screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='1') {
			forceSelectVerticalTab(0);
			evt.preventDefault();
			return;
		}
		// Cmd-2 for MacOS or Ctrl-2 for Windows: to trigger the Diagrams screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='2') {
			forceSelectVerticalTab(1);
			evt.preventDefault();
			return;
		}
		// Cmd-3 for MacOS or Ctrl-3 for Windows: to trigger the Diagrams screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='3') {
			forceSelectVerticalTab(2);
			evt.preventDefault();
			return;
		}
		// Cmd-4 for MacOS or Ctrl-4 for Windows: to trigger the Diagrams screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='4') {
			forceSelectVerticalTab(3);
			evt.preventDefault();
			return;
		}
//		console.log("key pressed: "
//			+ (evt.metaKey ? "Cmd-" : "")
//			+ (evt.ctrlKey ? "Ctrl-" : "")
//			+ (evt.shiftKey ? "Shft-" : "")
//			+ evt.key
//			+ ' (keycode '+ evt.keyCode+')');
	});
	$('body').on('contextmenu', function(e) {
		e.preventDefault();
	});

	$(window).on('load', (function() {
		if ($('#splash').is(':hidden')) {
			// Emergency trigger wasn't necessary. Ignore.
			return;
		}
		$('#splash').hide();
		sizeworkspace();
#ifdef SERVER
		if (
			localStorage.RasterToolIsLoaded && localStorage.RasterToolIsLoaded!=window.name) {
			rasterConfirm(_("Warning!"), _("The tool may already be active in another browser window or tab. If so, then continuing <em>will</em> damage your projects!"),
				_("Continue anyway"), _("Cancel"),
				function() {
					rasterConfirm(_("Are you really sure?"), _("If your project is open in another browser window or tab, <em>you will lose all your work</em>."),
						_("Yes, I am sure"), _("No, let me check again"),
						function() {
							localStorage.RasterToolIsLoaded = window.name;
						},
						function() {
							window.location = 'about:blank';
						});
				},
				function() {
					window.location = 'about:blank';
				});
			return;
		} else {
			localStorage.RasterToolIsLoaded = window.name;
		}
		checkUpgradeDone();
#endif
	}));
#ifdef SERVER
	$(window).on('unload', (function() {
		stopWatching(null);
		$('#goodbye').show();
		if (localStorage.RasterToolIsLoaded && localStorage.RasterToolIsLoaded==window.name) {
			localStorage.removeItem('RasterToolIsLoaded');
		}
	}));
#endif
	$(window).on('resize', SizeDOMElements);

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

	// Make sure the load event is *always* actioned. The event may have fired before this function attached it to the window.
	window.setTimeout(function () {
		$(window).trigger('load');
	}, 500);
}

function getGroupSettings() {
	// Initialise default values, then attempt to retrieve settings from the server
	GroupSettings = {
		classroom: false,
		template: 'Project Template',
		iconset: 'default'
	};
	$.ajax({
		url: 'group.json',
		async: false,
		dataType: 'json',
		success: function(data) {
			if (data.classroom===true) {
				GroupSettings.classroom = true;
			}
			if (typeof data.template==='string') {
				GroupSettings.template = data.template;
			}
			if (typeof data.iconset==='string') {
				GroupSettings.iconset = data.iconset;
			}
		}
	});
}

var findTimer;
var nodeFindString = "";
var FindScrollPos = 0;

var updateFind = function() {
	var str = $('#field_find').val();
	if (str==nodeFindString) {
		findTimer = window.setTimeout(updateFind,500);
		return;
	}
	nodeFindString = str;
	// A negative scroll position means that we need to save it, otherwise reset the position
	if (FindScrollPos<0) {
		FindScrollPos = -FindScrollPos;
	} else {
		FindScrollPos = 0;
	}
	var res = "";
	var currtype='';
	if (nodeFindString!='') {
		var it = new NodeIterator({project: Project.cid});
		it.sortByType();
		for (it.first(); it.notlast(); it.next()) {
			var rn = it.getnode();
			var s = Service.get(rn.service);
			if (rn.title.toUpperCase().indexOf(nodeFindString.toUpperCase())!=-1
				|| (rn.suffix!='' && rn.suffix.toUpperCase().indexOf(nodeFindString.toUpperCase())!=-1)
			) {
				if (rn.type!=currtype) {
					if (res!='') res += '<br>\n';
					res += '<b>'+H(Rules.nodetypes[rn.type])+'</b><br>\n';
					currtype = rn.type;
				}
				// Show a small circle in the label color, if any.
				if (Preferences.label) {
					var p = Project.get(Project.cid);
					if (rn.color && rn.color!='none') {
						res += '<div class="tinyblock B' + rn.color + '" title="' + H(p.strToLabel(rn.color)) + '"></div>';
					} else {
						res += '<div class="tinyblock" style="border: 1px solid white;"></div>';
					}
				}
				// Show a small square in the overall vulnerability level, if any
				if (rn.component) {
					var cm = Component.get(rn.component);
					if (cm.magnitude!='-') {
						res += '<div class="tinysquare M'
						+ ThreatAssessment.valueindex[cm.magnitude]
						+ '" title="' + H(ThreatAssessment.descr[ThreatAssessment.valueindex[cm.magnitude]])
						+ '"></div>';
					} else {
						res += '<div class="tinysquare" style="border: 1px solid white;"></div>';
					}
				} else {
					res += '<div class="tinysquare" style="border: 1px solid white;"></div>';
				}
				res += '<span class="findresult"';
				res += ' node="' + rn.id + '"';
				res += ' svc="' + s.id + '"';
				res += '>';
				res += rn.htmltitle();
				res += '</span>';
				res += ' <span style="color:grey;">'
				+ _("in service")
				+ '</span> '
				+ H(s.title);
				res += '<br>\n';
			}
		}
	}
	$('#field_found').html(res).scrollTop(FindScrollPos);

	$('.findresult').on('click', function(event) {
		var node_id = event.currentTarget.attributes[1].nodeValue;
		var svc_id = event.currentTarget.attributes[2].nodeValue;
		var node = Node.get(node_id);
		var svc = Service.get(svc_id);
		if (!node || !svc) {
			bugreport("unknown node or service","updateFind");
			return;
		}
		FindScrollPos = $('#field_found').scrollTop();
		// Activate the Diagrams tab
		$('#tabs').tabs('option','active',0);
		// Activate the right service
		if (svc_id != Service.cid) {
			$('#diaservicetab'+svc_id+' a').click();
			FindScrollPos = -FindScrollPos;
			StartFind(nodeFindString);
		}
		// Scroll the node into view
		var scrolldist_l = 0;
		var scrolldist_t = 0;
		var view_l = $('#diagrams'+svc_id).scrollLeft();
		var view_t = $('#diagrams'+svc_id).scrollTop();
		var view_o = $('#diagrams'+svc_id).offset();
		var view_w = $('#diagrams'+svc_id).width();
		var view_h = $('#diagrams'+svc_id).height();
		var nodepos = $(node.jnid).offset();
		if (nodepos.left < view_o.left)  scrolldist_l = view_o.left - nodepos.left + 100;
		if (nodepos.left > view_o.left+view_w)  scrolldist_l = view_w - nodepos.left - view_o.left - 100;
		if (nodepos.top < view_o.top)    scrolldist_t = view_o.top - nodepos.top + 100;
		if (nodepos.top > view_o.top+view_h)  scrolldist_t = view_h - nodepos.top - view_o.top - 100;
		// The node may be behind the Find window
		$('#findpanel').dialog('widget').stop().fadeTo('slow', 0.5);
		$('#findpanel').one('mousemove', function() {
			// Immediately show when we wiggle the mouse
			$('#findpanel').dialog('widget').stop().css('opacity',1);
		});
		$('#diagrams'+svc_id).animate({
			scrollLeft: '-='+scrolldist_l,
			scrollTop: '-='+scrolldist_t
		});
		// Draw a selection around the node
		var o = $('#diagrams_workspace'+svc_id).offset();
		$('#selectrect').show().offset({
			left: node.position.x-15+o.left, top: node.position.y-15+o.top}
		).width(node.position.width+25).height(node.position.height+25);
		$('#selectrect').effect('shake',{distance:10, times:8},1000);
	});
	findTimer = window.setTimeout(updateFind,500);
};

function StartFind(str) {
	var dialog = $('<div id="findpanel"></div>');
	var snippet ='\
		<!-- form id="form_find" -->\n\
		_LS_<br><input id="field_find" name="fld" type="text" value="" placeholder="_PH_"><br>\n\
		_LF_<br><div id="field_found"></div>\n\
		<!-- /form -->\
	';
	snippet = snippet.replace(/_LS_/g, _("Find:"));
	snippet = snippet.replace(/_LF_/g, _("Results:"));
	snippet = snippet.replace(/_PH_/g, _("Type here to search nodes"));
	dialog.append(snippet);
	if (typeof(str)!='string')  str = "";

	dialog.dialog({
		title: _("Find nodes"),
		width: 405,
		resizable: true,
		buttons: [{ text: _("Done"),
			click: function() {dialog.dialog('close');}
		}],
		open: function(/*event, ui*/) {
			$('#field_find').val(str).focus().select();
			nodeFindString = "";
			findTimer = window.setTimeout(updateFind,500);
		},
		close: function(/*event, ui*/) {
			window.clearTimeout(findTimer);
			dialog.remove();
		},
		resize: function(event,ui) {
			$('#field_find').width(ui.size.width-32);
			$('#field_found').width(ui.size.width-28).height(ui.size.height-150);
		}
	});
}

// Functions for the Frequency calculator (inside help/frequency-$LANG.html)
//
//const Lj = 500; // Once in 500 years
//const Mj = 50;  // Once in 50 years
//const Hj = 5;   // Once in 5 years
const log10_5 = log10(5);

var vNum = 100;	// Initial number of nodes
var vNPd = 1;	// Initial number of periods
var vInc = 2;	// Initial number of incidents in that interval
var cW = false;
var cM = false;
var cY = true;	// Interval is 'year'

function initFrequencyTool() {
	$('#sNum').slider({
		min: 0,
		max: 1000,
		step: 10,
		value: vNum,
		slide: function( event, ui ) {
			vNum = ui.value;
			$('#fNum').val( vNum );
			freqIndicatorUpdate();
		}
	});
	$('#sNPd').slider({
		min: 1,
		max: 10,
		value: vNPd,
		slide: function( event, ui ) {
			vNPd = ui.value;
			$('#fNPd').val( vNPd );
			freqIndicatorUpdate();
		}
	});
	$('#sInc').slider({
		min: 1,
		max: 20,
		value: vInc,
		slide: function( event, ui ) {
			vInc = ui.value;
			$('#fInc').val( vInc );
			freqIndicatorUpdate();
		}
	});
	$('#fNum').val( vNum );
	$('#fNPd').val( vNPd );
	$('#fInc').val( vInc );

	$('#freqcontrols input[type=radio]').checkboxradio({
		icon: false
	});
	$('#fNum').on('change', function() {
		vNum = $('#fNum').val();
		$('#sNum').slider('value', vNum);
		freqIndicatorUpdate();
	});
	$('#fNPd').on('change', function() {
		vNPd = $('#fNPd').val();
		$('#sNPd').slider('value', vNPd);
		freqIndicatorUpdate();
	});
	$('#fInc').on('change', function() {
		vInc = $('#fInc').val();
		$('#sInc').slider('value', vInc);
		freqIndicatorUpdate();
	});
	$('#freqcontrols fieldset').controlgroup();
	$('#freqcontrols input[type=radio]').on('change', function() {
		cW = $('#rWeek').prop('checked');
		cM = $('#rMnth').prop('checked');
		cY = $('#rYear').prop('checked');
		freqIndicatorUpdate();
	});

	$('#rWeek').prop('checked', cW).checkboxradio('refresh');
	$('#rMnth').prop('checked', cM).checkboxradio('refresh');
	$('#rYear').prop('checked', cY).checkboxradio('refresh');

	freqIndicatorUpdate(false);
}

function freqIndicatorUpdate(anim) {
	var obH = $('#bH').offset().left;
	var obM = $('#bM').offset().left;
	var obL = $('#bL').offset().left;
	var wbH = $('#bH').width();
	var p;

	if (cW) {
		// Avoid 2 divisons on the same line, because they look like a regex to Xcode
		p = (vNum * vNPd / vInc)
			/ 52;
	}
	if (cM) {
		p = (vNum * vNPd / vInc)
			/ 12;
	}
	if (cY) {
		p = vNum * vNPd / vInc;
	}
	// Frequency is one per p years.
	var pp = (obH+wbH/2) + (log10(p) - log10_5) * (obM-obH);

	if (pp < obH - 35) { // Stop at left edge
		pp = obH - 35;
	}
	if (pp > obL + 80) { // Stop at right edge
		pp = obL + 80;
	}
	pp = pp - obH;

	var fuzz;
#ifdef SERVER
	fuzz = 23;
#else
	fuzz = 22;
#endif
	if (anim===false) {
		$('#result').css("left",pp+fuzz);
	} else {
		$('#result').stop().animate({
			left: pp + fuzz
		});
	}
}

function log10(x) { return Math.LOG10E * Math.log(x); }


/* In the code, use _("blue sky") instead of "blue sky"
 * Use
 *		_("I have %% potatoes!", num)
 * to get (in EN)
 *		"I have 15 potatoes!"
 * and (in NL)
 *		"Ik heb 15 aardappels!"
 *
 * In file 'translation-nl.js', use a list of Javascript statements in the form
 * _t["blue sky"] = "blauwe lucht";
 * _t["I have %% potatoes!"] = "Ik heb %% aardappels!";
 * _t["I have %% %%!"] = "Ik heb %% %%!";
 * _t["I have %1 %2."] = "Van %2 heb ik er %1.";	<-- not used yet
 *
 * If no translation is provided, the default is to show the unlocalised English version.
 */
function _(s) {
	var str;
	if (typeof(_t)=='undefined' || _t[s]==undefined) {
		// No localisation available. Default to English version
#ifdef SERVER
		if (DEBUG
			&& !$.localise.defaultLanguage.match(/^en/)
		) {
			// Suggest additions to translation-XX.js modules (except for English and variants)
			console.log("_t[\"" + s + "\"] = \"" + s + "\";");
		}
#endif
		str=s;
	} else {
		str=_t[s];
	}
	// Replace %1, %2, ... %9 by the first, second, ... ninth argument.
	//for (var i=1; i<10; i++) {
	//	str = str.replace("%"+i, arguments[i])
	//}
	var i = 1;
	while (i<arguments.length) {
		str = str.replace("%%", arguments[i]);
		i++;
	}
	return str;
}

/* mylang(obj): retrieve language specific element from obj.
 *  obj = {'EN': 'English', 'NL': 'Not English'}
 *  mylang('EN') --> 'English'
 *  mylang('NL') --> 'Not English'
 *  mylang('ES') --> undefined
 */
function mylang(obj) {
#ifdef SERVER
	var lang = $.localise.defaultLanguage.toUpperCase();
#else
	var lang = 'EN'; // default
#ifdef LANG_NL
	lang = 'NL';
#endif
#endif

	if (obj[lang]) {
		return obj[lang];
	} else {
		// Fallback from 'en-US' to 'EN'
		lang = lang.replace(/([^_]+)-.+/, "$1");
		return obj[lang];
	}
}

/* testLocalStorage(): returns boolean
 * Checks whether the browser supports storing values in localStorage.
 */
function testLocalStorage() {
	try {
		if (window.location.href.match(/^file/i)) {
			rasterAlert('Warning',"Warning: Firefox discards your work on page reload.\nYou will lose your work unless you export your project.");
		}
		if (!localStorage) {
			throw('noLocalStorage');
		}
		localStorage[LS+'test'] = 'it works';
		if (localStorage[LS+'test'] != 'it works') {
			throw('noLocalStorage');
		}
		localStorage.removeItem(LS+'test');
		if (localStorage[LS+'test']) {
			throw('noLocalStorage');
		}
		return true;
	} catch(err) {
		return false;
	}
}

function loadDefaultProject() {
	var p = new Project();
	var s = new Service(p.id);
	p.adddefaultthreats();
	p.addservice(s.id);
	s.autosettitle();
	p.autosettitle();
	p.load();
	s.paintall();
}

//function modifyCSS(selector,property,newvalue) {
//	/* Find a CSS-rule for the given selector, then set the rule
//	 * for property to newvalue.
//	 */
//	var css=document.getElementById('maincssfile').sheet;
//	var rule=null;
//	for (var i=0; i<css.cssRules.length; i++) {
//		if (css.cssRules[i].selectorText==selector) {
//			rule = css.cssRules[i];
//			break;
//		}
//	}
//	if (!rule) {
//		bugreport('cannot locate css rule for '+selector,'modifyCSS');
//	} else {
//		rule.style[property] = newvalue;
//	}
//}

/* SizeDOMElements()
 * Set the size of various containers, based on the size of the browser window.
 */
function SizeDOMElements() {
	var ww = $(window).width();
	var wh = $(window).height();
	// Overall browser window / DOM body
	$('#tabs').width(ww-7);
	$('#tabs').height(wh-7);
	// Vertical navigation tabs
	$('.ui-tabs-nav').width(wh-11);
	var s = "";
	s += 'rotate(-90deg) translateX(-';
	s += wh-6;
	s += 'px)';
	$('.rot-neg-90').css('transform',s);
	$('.rot-neg-90').css('-ms-transform',s);
	$('.rot-neg-90').css('-moz-transform',s);
	$('.rot-neg-90').css('-webkit-transform',s);
	$('.rot-neg-90').css('-o-transform',s);
	$('.rot-neg-90').css('border-bottom-left-radius','0px');
	$('.rot-neg-90').css('border-bottom-right-radius','0px');

	$('.workbody').width(ww-43);
#ifdef SERVER
	$('.workbody').height(wh-50);
#else
	$('.workbody').height(wh-8);
#endif

	$('#servaddbuttondia').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('.tabs-bottom > .ui-tabs-nav').width(ww-82);
	// special setting for tab "Analysis"
	$('#analysis_body > .ui-tabs-nav').width(ww-44);
	$('.tabs-bottom').width(ww-47);
#ifdef SERVER
	$('.tabs-bottom').height(wh-54);
#else
	$('.tabs-bottom').height(wh-12);
#endif
	sizeworkspace();

	var fh = $('.fancyworkspace').height();
	var fw = $('.fancyworkspace').width();
	var wsh = wh-72;
	var wsw = ww-48;
	var scroller_h = $('.scroller_overview').height();
	var scroller_w = $('.scroller_overview').width();
	$('.scroller_region').height( (wsh/fh) * scroller_h );
	$('.scroller_region').width( (wsw/fw) * scroller_w );

	var scroller = $('#scroller_overview'+Service.cid);
	var o = scroller.offset();
	// Make sure that we only touch the top and right attributes and not the left attribute,
	// so that the scroller remains fixed relative to the upper-right corner of the workspace.
	if (o && o.left>0 && o.left<50) {
		scroller.css('right', (wsw-60) + 'px');
	}
	if (o && o.top>0 && o.top>wsh-30) {
		var t = wsh-30;
		scroller.css('top', (t<15 ? 15 : t) + 'px');
	}
}

function sizeworkspace() {
	// Adjust the workspace height
	// #bottomtabsdia or #bottomtabssf height is 27px per row. Double rows possible with many services
	// and/or a narrow window.
	var wh = $(window).height();
	var bh;
#ifdef SERVER
	var adj = 77;
#else
	var adj = 35;
#endif

	bh = $('#bottomtabsdia').height();
	if (bh>0) {
		$('#diagrams_body .workspace').height(wh-adj+27-bh);
		$('#diagrams_body .servplusbutton').height(bh-4);
	}

	bh = $('#bottomtabssf').height();
	if (bh>0) {
		$('#singlefs_body .workspace').height(wh-adj+27-bh);
		$('#singlefs_body .servplusbutton').height(bh-4);
	}

	bh = $('#bottomtabsana').height();
	if (bh>0) {
		$('#analysis_body .workspace').height(wh-adj+27-bh);
	}
}

function removetransientwindows(/*evt*/) {
	$('#nodemenu').hide();
	$('#selectmenu').hide();
	$('#ccfmenu').hide();
}

function removetransientwindowsanddialogs(/*evt*/) {
	$('.ui-dialog-content').dialog('close');
	removetransientwindows();
}

function switchToProject(pid,dorefresh) {
	if (pid==Project.cid)  return;
	$('#nodereport').dialog('close');
	$('#componentthreats').dialog('close');
	$('#checklist_tWLS').dialog('close');
	$('#checklist_tWRD').dialog('close');
	$('#checklist_tEQT').dialog('close');
	removetransientwindowsanddialogs();
	$('#ccfs_details').empty();
	CurrentCluster = null;

	if (Project.get(Project.cid)!=null) {
		// Project might have been deleted by libdel button
		Project.get(Project.cid).unload();
	}
	var p = Project.get(pid);
	p.load();
	var it = new ServiceIterator(pid);
	var found = false;
	var s;
	for (it.first(); !found && it.notlast(); it.next()) {
		s = it.getservice();
		found = (s.title == Preferences.service);
	}
	if (found) {
		Service.cid = s.id;
	}
	forceSelectVerticalTab(Preferences.tab);
	if (dorefresh) {
		p.dorefresh(false);
	}
}

/* createUUID: return a new "unique" random UUID.
 * There are different UUID-versions; version 4 is randomly generated.
 * Use the crypto library, as Math.random() is insufficiently random.
 */
/* eslint-disable no-bitwise */
function createUUID() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c /4).toString(16)
  );
}
/* eslint-enable no-bitwise */

/* nid2id: translate a DOM id to a UUID
 * DOM ids are a string followed by a UUID, return the trailing UUID
 */
function nid2id(nid) {
	return nid.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/)[1];
}

/* trimwhitespace: remove leading & trailing white space
 */
function trimwhitespace(str) {
	str = str.replace(/^\s+/,'');
	str = str.replace(/\s+$/,'');
	return str;
}

/* Use singular or plural phrase, depending on an integer number.
 * This used to append a suffix (defaulting to "s"), which works fine for
 * English but is difficult to localise.
 */
function plural(singular,plural,num) {
	return (num==1 ? singular : plural);
}

/* Prepend string 'a' to 'b' and join with a space, unless 'a' already occurs within 'b'.
*/
function prependIfMissing(a,b) {
	a = trimwhitespace(a);
	b = trimwhitespace(b);
	if (b=="") {
		return a;
	} else {
		return (b.indexOf(a)==-1 ? a+' '+b : b);
	}
}

/* Test whether two strings are identical in a case-insensitive way.
*/
function isSameString(a,b) {
	return a.toUpperCase()===b.toUpperCase();
}

/* nextUnusedIndex: return first index that doesn't exist or is null
 */
function nextUnusedIndex(arr) {
	for (var i=0,alen=arr.length; i<alen && arr[i]!=null; i++) { /* Do nothing */ }
	return i;
}

/* H: make a string safe to use inside HTML code
 * MOVED TO BOTTOM OF THIS FILE.
 */

/* prettyDate: reformat the timestamp string for server projects.
 * prettyDate("20210516 1435 22") = "16-05-2021 14:35"
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
	$('#modaldialog').dialog('option', 'buttons', [
	{text: _("Close"), click: function(){
		$(this).dialog('close');
	} }
	]);
	$('#modaldialog').dialog({
		title: String(title),
		height: 'auto',
		maxHeight: 600
	});
	$('#modaldialog').html( String(msg) );
	$('#modaldialog').dialog('open');
}

/* Replacement for the standard Javascript confirm() function. Several differences:
 * - it won't block the browser (only this tab)
 * - themeable, you can set the title, the buttons and the HTML content
 * - does not return true/false, but takes a callback function as its last parameter
 *   (and optionally a function to call on Cancel/deny)
 */
function rasterConfirm(title,msg,buttok,buttcancel,funcaction,funcnoaction) {
	$('#modaldialog').dialog('option', 'buttons', [
	{text: buttcancel, click: function(){
		$(this).dialog('close');
		if (funcnoaction) funcnoaction();
	} },
	{text: buttok, click: function(){
		$(this).dialog('close');
		funcaction();
	} }
	]);
	$('#modaldialog').dialog( 'option', 'title', String(title) );
	$('#modaldialog').html( String(msg) );
	$('#modaldialog').dialog('open');
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
}

function newRasterConfirm(title,msg,buttok,buttcancel) {
	var dfd = $.Deferred();
	$('#modaldialog').dialog('option', 'buttons', [
	{text: buttcancel, click: function(){
		$(this).dialog('close');
		dfd.reject(false);
	} },
	{text: buttok, click: function(){
		$(this).dialog('close');
		dfd.resolve(true);
	} }
	]);
	$('#modaldialog').dialog( 'option', 'title', String(title) );
	$('#modaldialog').html( String(msg) );
	$('#modaldialog').dialog('open');
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus');
	return dfd.promise();
}

function bugreport(mess,funcname) {
	console.log('bugreport: "'+mess+'" in function "'+funcname+'".');
	if (DEBUG) {
		rasterAlert('Please report this bug','You found a bug in this program.\n("'+mess+'" in function "'+funcname+'").');
	}
}

#ifdef SERVER
var SSEClient = null;
//var AutoSaveTimer = null;
//var lastSavedString;

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
	stopWatching(null);
	var p = Project.get(Project.cid);
	if (p==null || !p.shared || !Preferences.online) {
		if (Preferences!=null && !Preferences.online) {
			$('#networkactivity').removeClass("activityyes activityno").addClass("activityoff");
		}
		return;
	}
	startWatching(p);
}

/* We use Server-Sent Events (), to prevent polling over the network. With SSE,
 * the server is doing the periodic checks locally, notifying the client when changes
 * have been made.
 */
function startWatching(p) {
	if (SSEClient!=null) {
		SSEClient.close();
	}
	SSEClient = new EventSource('sse_projmon.php?name=' + urlEncode(p.title));

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
			var pp = Project.get(Project.cid);
			stopWatching(Project.cid);
			pp.setshared(false,false);
			removetransientwindows();
			rasterAlert( _("Project has been made private"),
				_("Project '%%' has been deleted from the server by someone. ", H(pp.title))+
				_("Your local version of the project will now be marked as private. ")+
				_("If you wish to share your project again, you must set it's details to 'Shared' yourself.")+
				"<br><p><i>"+
				_("Your changes are not shared with others anymore.")+
				"</i>"
			);
		} else {
			var xdetails = JSON.parse(msg.data);
			pp = Project.get(Project.cid);
			var newpid = loadFromString(xdetails.contents);
			if (newpid!=null) {
				var newp = Project.get(newpid);
				newp.shared = true;
				newp.creator = xdetails.creator;
				newp.date = xdetails.date;
				newp.description = unescapeNewlines(xdetails.description);
				var t = pp.title;
				pp.destroy();
				newp.settitle(t);
				switchToProject(newpid);
			} else {
				rasterAlert(_("Project has been made private"),
					'The server version of project "'+H(pp.title)+'" is damaged. '+
					'The project  will now be marked as private. '+
					'<p><i>Your changes are not shared with others anymore.</i>'
				);
				pp.setshared(false,false);
			}
		}
	};

}

/* Stop monitoring a project using Server-Sent Events. Either stop a specific
 * projet using its project id, or stop whatever current watch (pid==null)
 */
function stopWatching(pid) {
	if ((pid==null || pid==Project.cid) && SSEClient!=null) {
		SSEClient.close();
		SSEClient = null;
	}
}

function autoSaveFunction() {
	var p = Project.get(Project.cid);
	if (!p.shared || !Preferences.online) {
		if (!Preferences.online) {
			$('#networkactivity').removeClass('activityyes activityno').addClass('activityoff');
		}
		return;
	}
	var exportstring = exportProject(p.id);
	// First, stop watching the file so that we do not notify ourselves
	stopWatching(p.id);
	p.storeOnServer(false,exportstring,{
		onUpdate: function() {
			startWatching(p);
		}
	});
}
#endif

/* loadFromString(str): with string 'str' containing an entire file, try to
 *		read and create the objects in it.
 * Shows error messages, unless 'showerrors' is false.
 * Throws an error if the string does not contain any projects, unless 'allowempty' is true.
 *
 * Returns the id of one of the projects loaded, or null on failure.
 *
 * Version 0 is ancient, and is not supported anymore.
 * To upgrade from version 1:
 *  - Names/titles of nodes, services and clusters are now case-insensitive. When upgrading from
 *    version 1, it may be necessary to add a sequence number to titles (or increase the one that
 *    is already there).
 *  - There is one additional label.
 *  - Plus all the upgrades necessary for version 2.
 * To upgrade from version 2:
 *  - ID's are no longer simple numbers but UUIDs. This simplifies the loading of projects, because
 *    it is not necessary to check whether an id is already in use. The use of UUID virtually guarantees
 *    that no collisions occur.
 */
var Flag_Upgrade_Done = false;
var Upgrade_Description = "";

function loadFromString(str,showerrors,allowempty,strsource) {
	var lProject = [];
	var lService = [];
	var lThreat = [];
	var lComponent = [];
	var lNode = [];
	var lNodeCluster = [];
	var lThrEval = [];

	var res, key, val;
	var upgrade_1_2 = false;
	var upgrade_2_3 = false;

	Flag_Upgrade_Done = false;
	Upgrade_Description = "";
	var patt = new RegExp(/^([^\t\n]+)\t([^\n]+)\n/);
	res=patt.exec(str);
	try {
		while (res!=null) {
			if (res.length!=3) throw new Error('Invalid data format');
			key = res[1].split(':');
			if (!key || key[0]!=LS_prefix) throw new Error('Invalid key');
			if (key[1]!=LS_version) {
				if (key[1]==1) {
					// Can upgrade from version 1 to version 3
					upgrade_1_2 = true;
					upgrade_2_3 = true;
				} else if (key[1]==2) {
						// Can upgrade from version 2 to version 3
						upgrade_2_3 = true;
				} else {
					throw new Error("The file has version ("+key[1]+"); expected version ("+LS_version+"). You must use a more recent version of the Raster tool.");
				}
			}
			val = JSON.parse(urlDecode(res[2]));
			// Integer in version 1 and 2, string in version 3
			val.id = ( key[1]<3 ? parseInt(key[3],10) : key[3]);
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
			case 'R':
				// Ignore all preferences for purposes of loading projects
				break;
			default:
				throw new Error("Unknown key-entry ("+res[1]+")");
			}
			str = str.substr(res[0].length);
			res=patt.exec(str);
		}
		str = jQuery.trim(str);
		if (str.length!=0) throw new Error("Invalid text");
		if (lProject.length==0 && allowempty)  return null;
	}
	catch(e) {
		if (!showerrors)  return null;
		$('#splash').hide();
		var errdialog = $('<div></div>');
		var s = str.substr(0,40);
		s = H(s).replace(/\s+/g," ");
		errdialog.append('<p>' + strsource + ' contains an error:</p>\
			<blockquote>' + e.message + '</blockquote>\
			<p>The incorrect text is:</p>\
			<blockquote>' + s + '...</blockquote>');
		errdialog.dialog({
			title: strsource + " contains an error",
			modal: true,
			width: 500,
			close: function(/*event, ui*/) { errdialog.remove(); }
		});
		return null;
	}
	/* File has been read. Now check for consistency */

	// Returns:
	//  there exists j, 0<=j<arr.length, such that arr[j].id == id
	function containsID(arr,id) {
		var exists=false;
		for (var j=0,alen=arr.length; !exists && j<alen; j++) {
			exists = (arr[j].id==id);
		}
		return exists;
	}
	// Returns:
	//  for all j, 0<=j<arr2.length, containsID(arr,arr2[j])
	function containsAllIDs(arr,arr2) {
		var forall=true;
		for (var j=0,alen=arr2.length; forall && j<alen; j++) {
			for (var k=0,alen2=arr.length; !forall && k<alen2; k++) {
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

	try {
		if (lProjectlen==0) throw new Error('There are no projects; there must be at least one');
		if (lServicelen==0) throw new Error('There are no services; there must be at least one');
		for (i=0; i<lProjectlen; i++) {
			/* lProject[i].s[] must contain IDs of services */
			if (!containsAllIDs(lService,lProject[i].s)) throw new Error('Project '+lProject[i].id+' has an invalid service.');
			/* lProject[i].s must not be empty */
			if (lProject[i].s.length==0) throw new Error('Project '+lProject[i].id+' does not contain any services.');
			/* lProject[i].t[] must contain IDs of threats */
			if (!containsAllIDs(lThreat,lProject[i].t)) throw new Error('Project '+lProject[i].id+' has an invalid checklist vulnerability.');
		}
		for (i=0; i<lThreatlen; i++) {
			/* lThreat[i].p must be the ID of a project */
			if (!containsID(lProject,lThreat[i].p)) throw new Error('Vulnerability '+lThreat[i].id+' does not belong to a valid project.');
			/* lThreat[i].t must be a valid type */
			if (Rules.nodetypes[lThreat[i].t]==null) throw new Error('Vulnerability '+lThreat[i].id+' has an invalid type.');
		}
		for (i=0; i<lServicelen; i++) {
			/* lService[i].p must be the ID of a project */
			if (!containsID(lProject,lService[i].p)) throw new Error('Service '+lService[i].id+' does not belong to a valid project.');
		}
		for (i=0; i<lNodelen; i++) {
			/* lNode[i].t must be a valid type */
			if (Rules.nodetypes[lNode[i].t]==null) throw new Error('Diagram node '+lNode[i].id+' has an invalid type.');
			/* lNode[i].s must be the ID of a service */
			if (!containsID(lService,lNode[i].s)) throw new Error('Diagram node '+lNode[i].id+' does not belong to a valid service.');
			/* lNode[i].m (if non-null) must be the ID of a Component */
			if (lNode[i].m!=null && !containsID(lComponent,lNode[i].m)) throw new Error('Diagram node '+lNode[i].id+' does not belong to a valid component.');
			/* lNode[i].c[] must contain IDs of other Nodes */
			if (!containsAllIDs(lNode,lNode[i].c)) throw new Error('Diagram node '+lNode[i].id+' connects to an invalid node.');
		}
		for (i=0; i<lComponentlen; i++) {
			/* lComponent[i].t must be a valid type */
			if (Rules.nodetypes[lComponent[i].t]==null) throw new Error('Component '+lComponent[i].id+' has an invalid type.');
			/* lComponent[i].p must be the ID of a project */
			if (!containsID(lProject,lComponent[i].p)) throw new Error('Component '+lComponent[i].id+' does not belong to a valid project.');
			/* lComponent[i].e[] must contain IDs of threat evaluations */
			if (!containsAllIDs(lThrEval,lComponent[i].e)) throw new Error('Component '+lComponent[i].id+' has an invalid vulnerability evaluation.');
			/* lComponent[i].n[] must contain IDs of Nodes */
			if (!containsAllIDs(lNode,lComponent[i].n)) throw new Error('Component '+lComponent[i].id+' contains an invalid node.');
			/* lComponent[i].n must not be empty */
			if (lComponent[i].n.length==0) throw new Error('Component '+lComponent[i].id+' does not contain any nodes.');
		}
		for (i=0; i<lThrEvallen; i++) {
			/* lThrEval[i].t must be a valid type */
			if (Rules.nodetypes[lThrEval[i].t]==null) throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid type.');
			/* lThrEval[i].m, if non-null, must be the ID of a Component */
			if (lThrEval[i].m!=null && !containsID(lComponent,lThrEval[i].m)) throw new Error('Vulnerability assessment '+lThrEval[i].id+' does not belong to a valid component.');
			/* lThrEval[i].u, if non-null, must be the ID of a NodeCluster */
			if (lThrEval[i].u!=null && !containsID(lNodeCluster,lThrEval[i].u)) throw new Error('Vulnerability assessment '+lThrEval[i].id+' does not belong to a valid cluster.');
			/* lThrEval[i].p must be a valid frequency/impact string */
			if (ThreatAssessment.values.indexOf(lThrEval[i].p)==-1) throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid frequency.');
			/* lThrEval[i].i must be a valid frequency/impact string */
			if (ThreatAssessment.values.indexOf(lThrEval[i].i)==-1) throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid impact.');
		}
		for (i=0; i<lNodeClusterlen; i++) {
			/* lNodeCluster[i].t must be a valid type */
			if (Rules.nodetypes[lNodeCluster[i].t]==null) throw new Error('Node cluster '+lNodeCluster[i].id+' has an invalid type.');
			/* lNodeCluster[i].p must be the ID of a project */
			if (!containsID(lProject,lNodeCluster[i].p)) throw new Error('Node cluster '+lNodeCluster[i].id+' does not belong to a valid project.');
			/* lNodeCluster[i].u must be the ID of a node cluster */
			if (lNodeCluster[i].u!=null && !containsID(lNodeCluster,lNodeCluster[i].u)) throw new Error('Node cluster '+lNodeCluster[i].id+' has an invalid parent.');
			/* lNodeCluster[i].c[] must contain IDs of node cluster */
			if (!containsAllIDs(lNodeCluster,lNodeCluster[i].c)) throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid child cluster.');
			/* lNodeCluster[i].n[] must contain IDs of Nodes */
			if (!containsAllIDs(lNode,lNodeCluster[i].n)) throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid node.');
			/* lNodeCluster[i].e must be the ID of a threat assessment */
			if (!containsID(lThrEval,lNodeCluster[i].e)) throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid vulnerability evaluation.');
		}
	}
	catch (e) {
		if (DEBUG) console.log("Error: "+e.message);
		if (!showerrors)  return null;
		$('#splash').hide();
		errdialog = $('<div></div>');
		errdialog.append('<p>' + strsource + ' contains an error:</p>\
			<blockquote>' + H(e.message) + '</blockquote>');
		errdialog.dialog({
			title: strsource + " is not valid",
			modal: true,
			width: 500,
			close: function(/*event, ui*/) { errdialog.remove(); }
		});
		return null;
	}

	// To replace the value '7' in some array A by '77777', we use A[ A.indexOf(7) ] = 7777
	// If A does not contain the value 7, then indexOf evaluates to -1. This does not give a error message,
	// but creates a "-1" property on the array.
	// This only works if the value to be replaced occurs at most once, which is the case here.
	function arrayReplace(A,oldval,newval) {
		A[ A.indexOf(oldval) ] = newval;
	}

	if (upgrade_2_3) {
		/* Before version 3, IDs were numerical instead of UUIDs, so replace those.
		 * We replace the id by a UUID, but do remember the old id because it is used in cross-references.
		 * First correct all IDs, then fix the crossreferences.
		 */
		for (i=0; i<lProjectlen; i++) {
			lProject[i].oldid = lProject[i].id;
			lProject[i].id = createUUID();
		}
		for (i=0; i<lThreatlen; i++) {
			lThreat[i].oldid = lThreat[i].id;
			lThreat[i].id = createUUID();
		}
		for (i=0; i<lServicelen; i++) {
			lService[i].oldid = lService[i].id;
			lService[i].id = createUUID();
		}
		for (i=0; i<lNodelen; i++) {
			lNode[i].oldid = lNode[i].id;
			lNode[i].id = createUUID();
		}
		for (i=0; i<lComponentlen; i++) {
			lComponent[i].oldid = lComponent[i].id;
			lComponent[i].id = createUUID();
		}
		for (i=0; i<lThrEvallen; i++) {
			lThrEval[i].oldid = lThrEval[i].id;
			lThrEval[i].id = createUUID();
		}
		for (i=0; i<lNodeClusterlen; i++) {
			lNodeCluster[i].oldid = lNodeCluster[i].id;
			lNodeCluster[i].id = createUUID();
		}

		for (i=0; i<lProjectlen; i++) {
			// Replace service and Threat IDs
			for (k=0; k<lThreatlen;  k++)  arrayReplace(lProject[i].t, lThreat[k].oldid, lThreat[k].id);
			for (k=0; k<lServicelen; k++)  arrayReplace(lProject[i].s, lService[k].oldid, lService[k].id);
		}
		for (i=0; i<lThreatlen; i++) {
			// Replace project id
			for (k=0; k<lProjectlen; k++)  lThreat[i].p = (lThreat[i].p==lProject[k].oldid ? lProject[k].id : lThreat[i].p);
		}
		for (i=0; i<lServicelen; i++) {
			// Replace project id
			for (k=0; k<lProjectlen; k++)  lService[i].p = (lService[i].p==lProject[k].oldid ? lProject[k].id : lService[i].p);
		}
		for (i=0; i<lNodelen; i++) {
			// Replace component, connects and service id
			for (k=0; k<lComponentlen; k++)  lNode[i].m = (lNode[i].m==lComponent[k].oldid ? lComponent[k].id : lNode[i].m);
			for (k=0; k<lNodelen;      k++)  arrayReplace(lNode[i].c, lNode[k].oldid, lNode[k].id);
			for (k=0; k<lServicelen;   k++)  lNode[i].s = (lNode[i].s==lService[k].oldid ? lService[k].id : lNode[i].s);
		}
		for (i=0; i<lComponentlen; i++) {
			// Replace project, nodes, and treatassessment ids
			for (k=0; k<lProjectlen; k++)  lComponent[i].p = (lComponent[i].p==lProject[k].oldid ? lProject[k].id : lComponent[i].p);
			for (k=0; k<lNodelen;    k++)  arrayReplace(lComponent[i].n, lNode[k].oldid, lNode[k].id);
			for (k=0; k<lThrEvallen; k++)  arrayReplace(lComponent[i].e, lThrEval[k].oldid, lThrEval[k].id);
		}
		for (i=0; i<lThrEvallen; i++) {
			// Replace component, cluster ids
			for (k=0; k<lComponentlen;   k++)  lThrEval[i].m = (lThrEval[i].m==lComponent[k].oldid ? lComponent[k].id : lThrEval[i].m);
			for (k=0; k<lNodeClusterlen; k++)  lThrEval[i].u = (lThrEval[i].u==lNodeCluster[k].oldid ? lNodeCluster[k].id : lThrEval[i].u);
		}
		for (i=0; i<lNodeClusterlen; i++) {
			// Replace project, threatassessment, parentcluster, childclusters, nodes
			for (k=0; k<lProjectlen;     k++)  lNodeCluster[i].p = (lNodeCluster[i].p==lProject[k].oldid ? lProject[k].id : lNodeCluster[i].p);
			for (k=0; k<lThrEvallen;     k++)  lNodeCluster[i].e = (lNodeCluster[i].e==lThrEval[k].oldid ? lThrEval[k].id : lNodeCluster[i].e);
			for (k=0; k<lNodeClusterlen; k++)  lNodeCluster[i].u = (lNodeCluster[i].u==lNodeCluster[k].oldid ? lNodeCluster[k].id : lNodeCluster[i].u);
			for (k=0; k<lNodeClusterlen; k++)  arrayReplace(lNodeCluster[i].c, lNodeCluster[k].oldid, lNodeCluster[k].id);
			for (k=0; k<lNodelen;        k++)  arrayReplace(lNodeCluster[i].n, lNode[k].oldid, lNode[k].id);
		}
	}

	/* It is safe to create new objects now.
	 */
	for (i=0; i<lServicelen; i++) {
		var ls = lService[i];
		s = new Service(ls.p,ls.id);
		if (upgrade_1_2) {
			// Check if there is another service in this project with the same case-insensitive name
			for (j=i+1; j<lServicelen; j++) {
				if (ls.p==lService[j].p && isSameString(ls.l,lService[j].l)) {
					// Append a sequence number to the title of lService[j],
					// or increase the number it it already had one.
					var seq = lService[j].l.match(/^(.+) \((\d+)\)$/);
					if (seq==null) {
						lService[j].l = lService[j].l + ' (1)';
					} else {
						seq[2]++;
						lService[j].l = seq[1] + ' (' + seq[2] + ')';
					}
					Flag_Upgrade_Done = true;
					Upgrade_Description += '<LI>' + _("Services '%%' and '%%'.", ls.l, lService[j].l);
				}
			}
		}
		s.settitle(ls.l);
	}
	for (i=0; i<lThreatlen; i++) {
		var lth = lThreat[i];
		var th = new Threat(lth.t,lth.id);
		th.setproject(lth.p);
		th.setdescription(lth.d);
		if (upgrade_1_2) {
			// Check if there is another threat in this project with the same type and case-insensitive name
			for (j=i+1; j<lThreatlen; j++) {
				if (lth.p==lThreat[j].p && lth.t==lThreat[j].t && isSameString(lth.l,lThreat[j].l)) {
					var oldtitle, newtitle;
					oldtitle = lThreat[j].l;
					// Append a sequence number to the title of lThreat[j],
					// or increase the number it it already had one.
					seq = oldtitle.match(/^(.+) \((\d+)\)$/);
					if (seq==null) {
						newtitle = oldtitle + ' (1)';
					} else {
						seq[2]++;
						newtitle = seq[1] + ' (' + seq[2] + ')';
					}
					lThreat[j].l = newtitle;

					// Now change this title too in the ThreatAssessments of all Components in this project,
					// and in all top-level NodeClusters of this project.
					for (k=0; k<lComponentlen; k++) {
						if (lComponent[k].p!=lth.p) continue;
						for (n=0; n<lThrEvallen; n++) {
							if (lComponent[k].e.indexOf(lThrEval[n].id)==-1) continue;
							if (lThrEval[n].l==oldtitle) {
								lThrEval[n].l = newtitle;
							}
						}
					}
					for (k=0; k<lNodeClusterlen; k++) {
						if (lNodeCluster[k].p==lth.p && lNodeCluster[k].u==null && lNodeCluster[k].l==oldtitle) {
							lNodeCluster[k].l = newtitle;
							// The evaluation of this cluster must have the same name as this cluster
							for (n=0; n<lThrEvallen; n++) {
								if (lThrEval[n].id==lNodeCluster[k].e) {
									lThrEval[n].l = newtitle;
								}
							}
						}
					}

					Flag_Upgrade_Done = true;
					Upgrade_Description += '<LI>' + _("Vulnerabilities '%%' and '%%'.", oldtitle, newtitle);
				}
			}
		}
		th.settitle(lth.l);
	}
	for (i=0; i<lProjectlen; i++) {
		var lp = lProject[i];
		var p = new Project(lp.id);
		p.settitle(String(lp.l));
		p.shared = (lp.a===true);
		if (lp.g) p.group = lp.g;
		if (lp.d) p.description = lp.d;
		if (lp.w) p.date = lp.w;
		for (k=0; k<lp.s.length; k++) {
			p.addservice(lp.s[k]);
		}
		p.threats = lp.t.slice(0); // Omit the "-1" property, if it exists
		// Upgrade from version 1 to version 2: an additional color was added
		if (upgrade_1_2 && lp.c && lp.c.length==7) {
			lp.c[7] = lp.c[6];
			lp.c[6] = lp.c[5];
			lp.c[5] = _("Pink");
		}
		if (lp.c && lp.c.length==8) {
			p.labels = lp.c;
		}
		p.store();
	}
	for (i=0; i<lNodelen; i++) {
		var lrn = lNode[i];
		var rn = new Node(lrn.t,lrn.s,lrn.id);
		rn.title = trimwhitespace(lrn.l);
		if (lrn.f) rn.suffix = trimwhitespace(lrn.f);
		rn.iconinit();
		rn.position = {x: lrn.x, y: lrn.y, width: lrn.w, height: lrn.h};
		rn._normw = lrn.v;
		rn._normh = lrn.g;
		rn.component = lrn.m;
		rn.connect = lrn.c;
		if (lrn.o) {
			rn.color = lrn.o;
		}
		rn.store();
	}
	for (i=0; i<lComponentlen; i++) {
		var lc = lComponent[i];
		var cm = new Component(lc.t,lc.p,lc.id);
		cm.thrass = lc.e;
		cm.nodes = lc.n.slice(0); // Omit the "-1" property, if it exists;
		cm.single = (lc.s===true);
		cm.accordionopened = (lc.o===true);
		if (upgrade_1_2) {
			// Check if there is another Component in this project with the same case-insensitive name
			for (j=i+1; j<lComponentlen; j++) {
				if (lc.p==lComponent[j].p && isSameString(lc.l,lComponent[j].l)) {
					// Append a sequence number to the title of lComponent[j],
					// or increase the number it it already had one.
					oldtitle = lComponent[j].l;
					seq = oldtitle.match(/^(.+) \((\d+)\)$/);
					if (seq==null) {
						newtitle = oldtitle + ' (1)';
					} else {
						seq[2]++;
						newtitle = seq[1] + ' (' + seq[2] + ')';
					}
					lComponent[j].l = newtitle;
					// Als change the title on all nodes sharing this component
					Flag_Upgrade_Done = true;
					Upgrade_Description += '<LI>' + _("Components '%%' and '%%'.", lc.l, lComponent[j].l);
				}
			}
		}
		cm.title = lc.l;
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
		te.remark=lte.r;
		te.computetotal();
		te.component=lte.m;
		te.cluster=lte.u;
		te.store();
	}
	for (i=0; i<lNodeClusterlen; i++) {
		var lnc = lNodeCluster[i];
//		/* For some reason, some project contain empty cluster (root, no nodes and no subclusters).
//		 * Do not create such a useless cluster, and if its ThreatEvaluation has been created
//		 * already then delete that.
//		 */
//		if (lnc.u==null && lnc.c.length==0 && lnc.n.length==0) {
//			te = ThreatAssessment.get(lnc.e);
//			if (te && te.cluster==lnc.id) {
//				te.destroy();
//			}
//			continue;
//		}

		var nc = new NodeCluster(lnc.t,lnc.id);
		nc.title = lnc.l;
		nc.project = lnc.p;
		nc.parentcluster = lnc.u;
		nc.childclusters = lnc.c.slice(0); // Omit the "-1" property, if it exists;
		nc.childnodes = lnc.n.slice(0); // Omit the "-1" property, if it exists
		nc.thrass = lnc.e;
		nc.accordionopened = (lnc.o===true);
		//nc.calculatemagnitude(); // Not all childclusters may have been loaded
		nc.store();
	}

	// As from version 3, there should be rootclusters for each threat
	for (i=0; upgrade_2_3 && i<lThreatlen; i++) {
		lth = lThreat[i];
		let it = new NodeClusterIterator({project: lth.p, title: lth.l, type: lth.t, isroot: true});
		// If the project has a rootcluster with that type and title, then OK.
		if (it.notlast())  continue;
		// else make sure than a stub rootcluster exists, and has a threat assessment.
		nc = new NodeCluster(lth.t);
		nc.setproject(lth.p);
		nc.settitle(lth.l);
		nc.addthrass();
	}

	for (i=0; i<lComponentlen; i++) {
		cm = Component.get( lComponent[i].id );
		cm.calculatemagnitude();
	}
	for (i=0; i<lNodeClusterlen; i++) {
		nc = NodeCluster.get( lNodeCluster[i].id );
		if (nc)  nc.calculatemagnitude();
	}

	return lProject[0].id;
}

/* Warn if the project has been upgraded and modified during import.
*/
function checkUpgradeDone() {
	if (!Flag_Upgrade_Done)  return;
#ifdef STANDALONE
	setModified();
#endif
	rasterAlert(
		_("Your project was updated"),
		_("Your project was updated to a newer version. Some names of components and other items have been altered.")
		+ '<UL>' + Upgrade_Description + '</UL>'
	);
}

/* Find the lowest unused number in arr. Array arr must not contain negative numbers.
 */
function lowestunused(arr) {
	var lu = 0;
	arr.sort(function(a,b){return a - b;});
	for (var i=0,alen=arr.length; i<alen; i++) {
		if (lu<arr[i]) break;
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
	for (i=0; i<p.threats.length; i++) {
		s += exportThreat(p.threats[i]);
	}
	for (var i=0; i<p.services.length; i++) {
		s += exportService(p.services[i]);
	}
	var it = new NodeClusterIterator({project: pid});
	for (it.first(); it.notlast(); it.next()) {
		s += exportNodeCluster(it.getNodeClusterid());
	}
	return s;
}

function exportThreat(th) {
	var s = Threat.get(th).exportstring();
	return s;
}

function exportService(sid) {
	var s = Service.get(sid).exportstring();
	var it = new NodeIterator({service: sid});
	for (it.first(); it.notlast(); it.next()) {
		s += exportNode( it.getnodeid() );
	}
	return s;
}

function exportNode(n) {
	if (NodeExported.indexOf(n)>-1) {
		return "";
	}
	var rn = Node.get(n);
	var s = rn.exportstring();
	NodeExported.push(n);
	for (var i=0; i<rn.connect.length; i++) {
		s += exportNode(rn.connect[i]);
	}
	if (rn.component!=null) {
		s += exportComponent(rn.component);
	}
	return s;
}

function exportComponent(c) {
	if (ComponentExported.indexOf(c)>-1) {
		return "";
	}
	var cm = Component.get(c);
	var s = cm.exportstring();
	ComponentExported.push(c);
	for (var i=0; i<cm.nodes.length; i++) {
		s += exportNode(cm.nodes[i]);
	}
	for (i=0; i<cm.thrass.length; i++) {
		s += exportThreatAssessment(cm.thrass[i]);
	}
	return s;
}

function exportThreatAssessment(te) {
	var s = ThreatAssessment.get(te).exportstring();
	return s;
}

function exportNodeCluster(ncid) {
	var nc = NodeCluster.get(ncid);
	var s = nc.exportstring();
	s += exportThreatAssessment(nc.thrass);
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
	var url = 'data:text/x-raster;,' + urlEncode(s);
	document.location.assign(url);
}

function forceSelectVerticalTab(n) {
	$('#tabs').tabs('option','active',n);
	vertTabSelected();
}

/* vertTabSelected(event,ui)
 * Event 'event' selects the vertical tab 'ui' of the main window.
 */
function vertTabSelected(/*event, ui*/) {
	removetransientwindows();

	$('#nodereport').dialog('close');
	$('#componentthreats').dialog('close');
	$('#checklist_tWLS').dialog('close');
	$('#checklist_tWRD').dialog('close');
	$('#checklist_tEQT').dialog('close');

	sizeworkspace();
	switch ($('#tabs').tabs('option','active')) {
	case 0:		// tab Services
		$('#templates').show();
		// Switch to the right service. A new service may have been created while working
		// in the Single Failures tab.
		$('#diagramstabtitle'+Service.cid).trigger('click');
		// Paint, if the diagram has not been painted already
		Service.get(Service.cid).paintall();
		Preferences.settab(0);
		break;
	case 1:		// tab Single Failures
		$('#selectrect').hide();
		$('#templates').hide();
		$('#singlefstabtitle'+Service.cid).trigger('click');
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
}

function initLibraryPanel() {
	$('#libraryactivator span').first().html(_("Library"));

	$('#librarypanel').dialog({
		title: _("Library"),
		position: {my: 'left+50 top+50', at: 'bottom right', of: '#libraryactivator'},
		modal: true,
		width: 490,
		resizable: false,
		autoOpen: false,
		close: function() {
			$('#libraryactivator').removeClass('ui-state-hover');
		}
	});

	$('#libactivate').attr('title',_("Continue working with the selected project."));
	$('#libprops').attr('title',_("Change the name, description, and sharing status of the selected project."));
	$('#libexport').attr('title',_("Save the selected project to a file."));
	$('#libdel').attr('title',_("Permanently remove the selected project."));
	$('#libmerge').attr('title',_("Join the selected project into the current one."));
	$('#libadd').attr('title',_("Add a new, blank project to the library."));
	$('#libimport').attr('title',_("Load a project from a file."));
	$('#libexportall').attr('title',_("Save all projects into a single file."));
	$('#libzap').attr('title',_("Permanently remove all projects."));
	$('#libcheck').attr('title',_("Check the projects for internal consistency."));

	$('#libactivate').val(_("Activate"));
	$('#libprops').val(_("Details"));
	$('#libexport').val(_("Export"));
	$('#libdel').val(_("Delete"));
	$('#libmerge').val(_("Merge"));
	$('#libadd').val(_("New"));
	$('#libimport').val(_("Import"));
	$('#libexportall').val(_("Export all"));
	$('#libzap').val(_("Zap library"));
	$('#libcheck').val(_("?"));

	// Activate --------------------
	$('#libactivate').on('click',  function() {
		var p = Project.get( $('#libselect option:selected').val() );
		if (!p.stub) {
			switchToProject(p.id,true);
		} else {
			// Activating a stub project.
			// Make sure that there is no local project with that name
			if (Project.withTitle(p.title)!=null) {
				rasterAlert(_('That project name is used already'),
					_("There is already a project called '%%'. Please rename that project first.", H(p.title))
				);
			} else {
				// Do a retrieve operation, and switch to that new project, if successful.
				Project.retrieve(p.id,function(newpid){
					switchToProject(newpid);
#ifdef SERVER
					startAutoSave();
#endif
				});
			}
		}
		$('#libactivate').removeClass('ui-state-hover');
		$('#librarypanel').dialog('close');
	});
	// Details --------------------
	$('#libprops').on('click', function() {
		var p = Project.get( $('#libselect option:selected').val() );
		ShowDetails(p);
	});
	// Export --------------------
	$('#libexport').on('click',  function() {
		var p = Project.get( $('#libselect option:selected').val() );
#ifdef SERVER
		if (!p.stub) {
#endif
			singleProjectExport($('#libselect option:selected').val());
#ifdef SERVER
		} else {
			// First retrieve the project, then start exporting it
			Project.retrieve(p.id,function(newpid){
				if (newpid==null) {
					rasterAlert(_("Invalid project received from server"),
						_("The project '%%' was retrieved from the server but contained invalid data.", H(p.title))
					);
					return;
				}
				populateProjectList();
				singleProjectExport(newpid);
			});
		}
#endif
		$('#libselect').focus();
		$('#libexport').removeClass('ui-state-hover');
	});
	// Delete --------------------
	$('#libdel').on('click',  function(/*evt*/){
		var p = Project.get( $('#libselect option:selected').val() );
		var dokill = function() {
			$('#libdel').removeClass('ui-state-hover');
#ifdef SERVER
			if (p.shared || p.stub) {
				// Disable the project watch. Otherwise a notification would be triggered.
				stopWatching(p.id);
				// remove from the server
				p.deleteFromServer();
			}
#endif
			if (p.id==Project.cid) {
				p.destroy();
				p = Project.firstProject();
				// Add a blank project if none would be left
				if (p===0) {
					loadDefaultProject();
				} else {
					switchToProject(p.id);
				}
			} else {
				p.destroy();
			}
			populateProjectList();
		};
		newRasterConfirm(_("Delete project?"),
		_("Are you sure you want to remove project <i>'%%'</i>?\n<strong>This cannot be undone.</strong>", H(p.title)),
		_("Remove"),_("Cancel")
		).done(function() {
			var t=p.totalnodes();
			if (t>2) {
				newRasterConfirm(_("Delete project?"),
					_("This project has %% nodes.\nAre you <i>really</i> sure you want to discard these?", t),
					_("Yes, really remove"),_("Cancel"))
				.done(dokill);
			} else {
				dokill();
			}
			$('#librarypanel').dialog('close');
		})
		.fail(function () {
			$('#libselect').focus();
		});
	});
	// Merge --------------------
	$('#libmerge').on('click',  function() {
		var otherproject = Project.get( $('#libselect option:selected').val() );
#ifdef SERVER
		if (otherproject.stub) {
			rasterAlert(_("Cannot merge a remote project"),_("This tool currently cannot merge remote projects. Activate that project first, then try to merge again."));
			return;
		}
#endif
		var currentproject = Project.get( Project.cid );
		rasterConfirm(_("Merge '%%' into '%%'?",otherproject.title,currentproject.title),
			_("Are you sure you want to fold project '%%' into the current project?",
				H(otherproject.title))
			+'<br>\n'+
			_("This will copy the diagrams of '%%' into '%%'.",
				H(otherproject.title),H(currentproject.title)),
			_("Merge"),_("Cancel"),
			function() {
				Project.merge(currentproject,otherproject);
				$('#librarypanel').dialog('close');
		});
	});

	// select --------------------
	$('#libselect').on('change', function(){
		var p = Project.get( $('#libselect option:selected').val() );
		$('#libactivate').button('option','disabled',p.id==Project.cid);
		$('#libmerge').button('option','disabled',p.id==Project.cid);
		$('#libselect option').css('background-image','');
		$('#libselect option[value='+Project.cid+']').css('background-image','url(../img/selected.png)');
	});
	$('#libselect').on('dblclick',  function(){
		$('#libactivate').trigger('click');
	});

	// Add --------------------
	function addEmptyProject() {
		var p = new Project();
		var s = new Service(p.id);
		p.adddefaultthreats();
		p.addservice(s.id);
		s.autosettitle();
		p.autosettitle();
		populateProjectList();
		$('#libselect').val(p.id).focus().trigger('change').trigger('dblclick');
		transactionCompleted("Project add");
	}

	$('#libadd').on('click',  function(){
		// Check for a template
		var p, template;
		var found=false;
		for (var i=0; !found && i<Project._all.length; i++) {
			template = Project._all[i];
			if (template==null) continue;
			found=(isSameString(template.title,GroupSettings.template) && template.group==ToolGroup);
		}

		/* There are 4 possibilities:
		   1. The template exists on the server (a stub locally): retrieve the template; when it fails create a blank project.
		   2. The template exists on the server, and has been retrieved: duplicate the template.
		   3. The template does exists as a private project: duplicate the template
		   4. The template does not exists: create a blank project
		 */
		// Possibility 1
		if (found && template.stub && Preferences.online) {
			Project.retrieve(template.id, function(newpid) {
				// Success
				p = Project.get(newpid);
				p.stub = false;
				p.setshared(false,false);
				p.autosettitle();
				populateProjectList();
				$('#libselect').val(newpid).focus().trigger('change').trigger('dblclick');
				transactionCompleted("Project add");
			}, function() {
				// Error
				addEmptyProject();
			});
		// Possibility 2 and 3
		} else if (found) {
			// To duplicate the template, export it into a string, then read & load that string
			var savedcopy = exportProject(template.id);
			i = loadFromString(
				savedcopy,	// the string to parse
				true,		// show errors
				false,		// allow empty
				'Project from template'		// Source of the string, used in error messages
			);
			if (i==null) {
				// Some kind of error occurred. This is not normal, so return without doing anything else.
				return;
			}
			p = Project.get(i);
			p.stub = false;
			p.setshared(false,false);
			p.autosettitle();
			populateProjectList();
			$('#libselect').val(i).focus().trigger('change').trigger('dblclick');
			transactionCompleted("Project add");
		} else {
			// Blank project
			addEmptyProject();
		}
	});
	// Import --------------------
	$('#libimport').on('click',  function() {
		$('#libimport').removeClass('ui-state-hover');
		$('#body').off('click');
		$('#fileElem').trigger('click');
		$('#body').on('click',  function(){ return false; });
	});
	$('#fileElem').on('change',  function(event) {
		var files = event.target.files;
		if (files.length==null || files.length==0)  return;
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
			// Import checks are not as thorough as the internal consistency checks on components.
			// Therefore, force a check after load.
			checkForErrors(false);
			checkUpgradeDone();
		};
		reader.readAsText(files[0]);
	});
	// Export all --------------------
	$('#libexportall').on('click',  function() {
		$('#libexportall').removeClass('ui-state-hover');
		exportAll();
	});
	// Zap! --------------------
	$('#libzap').on('click',  function(){
		rasterConfirm('Delete all?',
			_("This will delete all your projects and data.\n\nYou will lose all your unsaved work!\n\nAre you sure you want to proceed?"),
			_("Erase everything"),_("Cancel"),
			function() {
				rasterConfirm(_('Delete all?'),
					_("Really sure? You will lose <b>all private</b> projects!\n"),
					_("Yes, really erase all"),_("Cancel"),
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
	$('#libcheck').on('click',  function() {
		checkForErrors(true);
		$('#libcheck').removeClass('ui-state-hover');
		$('#libselect').focus(); // Won't work, because the alert is still active.
	});

	// panel activator --------------------
	$('#libraryactivator').on('mouseenter', function() {
		$('#libraryactivator').addClass('ui-state-hover');
	}).on('mouseleave', function() {
		$('#libraryactivator').removeClass('ui-state-hover');
	});
	$('#libraryactivator').on('click',  function() {
		var it = new ProjectIterator({group: ToolGroup, stubsonly: false});
		var nump = it.number();
		nump += 4; // Allow space for option group titles.
		if (nump<8) nump=8;
		if (nump>15) nump=15;
		$('#libselect').attr("size",nump);
		$('#librarypanel').dialog('open');
		// Show project list using current stubs, but do fire an update
		populateProjectList();
#ifdef SERVER
		Project.updateStubs(refreshProjectList);
		startPeriodicProjectListRefresh();
#endif
	});
}

/* Show an alert if there are any errors in the projects (e.g. in a newly loaded project).
 * If verbose, show an explicit alert to say that there are no errors.
 * Import checks are not as thorough as the internal consistency checks on components.
 * Therefore, it is a good idea to checkForErrors after importing a project.
 */
function checkForErrors(verbose) {
	var errors = "";
	var it = new ProjectIterator();
	it.sortByTitle();
	for (it.first(); it.notlast(); it.next()) {
		var p = it.getproject();
		var err = p.internalCheck();
		if (err!="") {
			var e = err.split('\n');
			e.sort();
			if (errors!="") errors += "<p>";
			errors += _("Project <i>%%</i>:\n", H(p.title)) + e.join('<br>\n');
		}
	}
	if (verbose && errors=="") {
		rasterAlert(_("Checked all projects"), _("There were no errors; all projects are OK.\n"));
	}
	if (errors!="") {
		rasterAlert(_("Your projects contain errors:"), errors);
	}
}

function ShowDetails(p) {
	var dialog = $('<div></div>');
#ifdef STANDALONE
	var snippet ='\
		<form id="form_projectprops">\n\
		_LT_<br><input id="field_projecttitle" name="fld" type="text" value="_PN_"><br>\n\
		_LD_<br><textarea id="field_projectdescription" rows="2">_PD_</textarea><br>\n\
		</form>\
	';
#else
	var snippet ='\
		<form id="form_projectprops">\n\
		_LT_<br><input id="field_projecttitle" name="fld" type="text" value="_PN_"><br>\n\
		<div id="stubdetails" style="display:_DI_;">_LC_ _CR_, _STR_ _DA_.<br><br></div>\n\
		_LD_<br><textarea id="field_projectdescription" rows="2">_PD_</textarea><br>\n\
		<fieldset>\n\
		<input type="radio" id="sh_off" value="off" name="sh_onoff"><label for="sh_off">_LP_</label>\n\
		<input type="radio" id="sh_on" value="on" name="sh_onoff"><label for="sh_on">_LS_</label>\n\
		</fieldset>\n\
		</form>\
	';
#endif
	snippet = snippet.replace(/_LT_/g, _("Title:"));
	snippet = snippet.replace(/_LD_/g, _("Description:"));
	snippet = snippet.replace(/_PN_/g, H(p.title));
	snippet = snippet.replace(/_PD_/g, H(p.description));
#ifdef SERVER
	snippet = snippet.replace(/_LC_/g, _("Creator:"));
	snippet = snippet.replace(/_LP_/g, _("Private"));
	snippet = snippet.replace(/_LS_/g, _("Shared"));
	snippet = snippet.replace(/_STR_/g, _("last stored on"));
	snippet = snippet.replace(/_CR_/g, (p.shared && !p.stub ? H(Preferences.creator) : H(p.creator)));
	snippet = snippet.replace(/_DA_/g, H(prettyDate(p.date)));
	snippet = snippet.replace(/_DI_/g, (p.stub||p.shared ? 'block' : 'none'));
#endif
	dialog.append(snippet);
	var dbuttons = [];
	dbuttons.push({
		text: _("Cancel"),
		click: function() {
				$(this).dialog('close');
			}
	});
	dbuttons.push({
		text: _("Change properties"),
		click: function() {
#ifdef SERVER
				if (!p.stub) {
#endif
					var fname = $('#field_projecttitle');
					p.settitle(fname.val());
					if (Project.cid==p.id) {
						$('.projectname').html(H(p.title));
						document.title = "Raster - " + p.title;
						Preferences.setcurrentproject(p.title);
					}
					fname = $('#field_projectdescription');
					p.setdescription(fname.val());
#ifdef SERVER
					var becomesShared = $('#sh_on:checked').length>0;
					if (!p.shared && becomesShared) {
						// Before changing the sharing status from 'private' to 'shared', first
						// check if there already is a project with this name. If so, refuse to rename.
						var it = new ProjectIterator({title: p.title, group: ToolGroup, stubsonly: true});
						if (it.notlast()) {
							rasterAlert(_("Cannot share this project yet"),
								_("There is already a project named '%%' on the server. You must rename this project before it can be shared.", H(p.title))
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
					} else if (p.shared && becomesShared) {
						p.storeOnServer(false,exportProject(p.id),{});
					}
#endif
					$(this).dialog('close');
					populateProjectList();
					transactionCompleted("Project props change");
#ifdef SERVER
				} else {
					// Not implemented yet.
					rasterAlert(_("Cannot change project on server"),_("This function is not implemented yet."));
				}
#endif
			}
	});
	dialog.dialog({
		title: _("Properties for project '%%'", p.title),
		modal: true,
		width: 490,
#ifdef SERVER
		height: 280,
#endif
		buttons: dbuttons,
		open: function() {
#ifdef SERVER
			$('#form_projectprops input[type=radio]').checkboxradio({icon: false});
			$('#form_projectprops fieldset').controlgroup();
			$('#sh_off')[0].checked = !p.shared;
			$('#sh_on')[0].checked = p.shared;
			$('input[name="sh_onoff"]').checkboxradio("refresh");

			if (GroupSettings.classroom) {
				$('input[name="sh_onoff"]').checkboxradio({
					disabled: true
				});
			}
#endif
			$('#field_projecttitle').focus().select();
			$('#form_projectprops').submit(function() {
				// Ignore, must close with dialog widgets
				return false;
			});
		},
		close: function(/*event, ui*/) {
			dialog.remove();
			$('#libselect').focus();
		}
	});
}
function populateProjectList() {
	var snippet = "";
	var newoptions = "";
	var p;
	var it = new ProjectIterator({group: ToolGroup});
	it.sortByTitle();

	// First all private projects
	for (it.first(); it.notlast(); it.next()) {
		p = it.getproject();
		if (p.stub || p.shared) continue;
		if (snippet=="") {
			snippet = '<optgroup class="optgroup" label="'+_("Private projects")+'">\n';
		}
		snippet += '<option value="'+p.id+'" title="'+H(p.description)+'">'+H(p.title)+'</option>\n';
	}
	if (snippet!="") {
		snippet += '</optgroup>\n';
	}
	newoptions += snippet;
#ifdef SERVER
	//	 Then all shared projects, if they belong to group ToolGroup
	snippet = "";
	for (it.first(); it.notlast(); it.next()) {
		p = it.getproject();
		if (p.stub || !p.shared) continue;
		if (snippet=="") {
			snippet = '<optgroup class="optgroup" label="'+_("Shared projects")+'">\n';
		}
		snippet += '<option value="'+p.id+'" title="'+H(p.description)+'">'+H(p.title)+'</option>\n';
	}
	if (snippet!="") {
		snippet += '</optgroup>\n';
	}
	newoptions += snippet;
#endif
	$('#libselect').html(newoptions);
	// Finally all stubs projects
#ifdef SERVER
	refreshProjectList();
#endif
	// Select the current project, and enable/disable the buttons
	$('#libselect').val(Project.cid).focus().trigger('change');
}

#ifdef SERVER
var ProjectListTimer;

function startPeriodicProjectListRefresh() {
	if (ProjectListTimer!=null)  return;
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
	var it = new ProjectIterator({group: ToolGroup, stubsonly: true});
	it.sortByTitle();
	for (it.first(); it.notlast(); it.next()) {
		var p = it.getproject();
		if (snippet=="") {
			snippet = '<optgroup id="stubgroup" class="optgroup" label="'+_("Other projects on the server")+'">\n';
		}
		snippet += '<option value="'+p.id+'" title="'+H(p.description)+'">'+H(p.title)+', by '+H(p.creator)+' on '+prettyDate(p.date)+'</option>\n';
	}
	if (snippet!="") {
		snippet += '</optgroup>\n';
	}
	$('#stubgroup').remove();
	$('#libselect').append(snippet);
	$('#libselect').val(prevselected);
}
#endif

function initOptionsPanel() {
	$('#optionsactivator span').first().html(_("Options"));

	$('#optionspanel').dialog({
		title: _("Options"),
		modal: true,
		position: {my: 'left+50 top+50', at: 'bottom right', of: '#optionsactivator'},
		width: 420,
		resizable: false,
		autoOpen: false,
		close: function() {
			$('#optionsactivator').removeClass('ui-state-hover');
		}
	});

	$('#emblem_size span').first().html( _("Vulnerability levels:") );
	$('#em_small').checkboxradio('option', 'label', _("Small"));
	$('#em_large').checkboxradio('option', 'label', _("Large"));
	$('#em_none').checkboxradio('option', 'label', _("None"));
	$('[for=em_small]').on('click',  function() { Preferences.setemblem('em_small'); });
	$('[for=em_large]').on('click',  function() { Preferences.setemblem('em_large'); });
	$('[for=em_none]').on('click',  function() { Preferences.setemblem('em_none'); });

	$('#labelonoff span').first().html( _("Labels:") );
	$('#label_off').checkboxradio('option', 'label', _("Hide color"));
	$('#label_on').checkboxradio('option', 'label', _("Show color"));
	$('[for=label_off]').on('click',  function() { Preferences.setlabel(false); });
	$('[for=label_on]').on('click',  function() { Preferences.setlabel(true); });

#ifdef SERVER
	$('#onlineonoff span').first().html( _("Network connection:") );
	$('#online_off').checkboxradio('option', 'label', _("Offline"));
	$('#online_on').checkboxradio('option', 'label', _("Online"));
	$('[for=online_off]').on('click',  function() { Preferences.setonline(false); });
	$('[for=online_on]').on('click',  function() { Preferences.setonline(true); });

	$('#creator_name span').first().html( _("Your name:") );
	$('#creator').on('change',  function(/*evt*/){
		Preferences.setcreator($('#creator').val());
		$('#creator').val(Preferences.creator);
	});
	$('#creator').val(Preferences.creator);
#endif

	$('#optionsactivator').on('mouseenter', function() {
		$('#optionsactivator').addClass('ui-state-hover');
	}).on('mouseleave', function() {
		$('#optionsactivator').removeClass('ui-state-hover');
	});
	$('#optionsactivator').on('click',  function() {
		removetransientwindows();
		$('#optionspanel').dialog('open');
		$('#'+Preferences.emsize).prop('checked',true);
		$(Preferences.online?'#online_on':'#online_off').prop('checked',true);
		$(Preferences.label?'#label_on':'#label_off').prop('checked',true);
		$('#optionspanel fieldset').controlgroup('refresh');
	});
}

function bottomTabsCloseHandler(event) {
	var p = Project.get(Project.cid);
	if (p.services.length==1) {
		$('#diagrams_workspace'+p.services[0]).effect('pulsate', { times:2 }, 800);
		return;
	}
	$('#selectrect').hide();
	var s = Service.get(nid2id(event.target.id));
	rasterConfirm(_("Delete service?"),
		_("Are you sure you want to remove service '%%' from project '%%'?\nThis cannot be undone.", H(s.title), H(p.title)),
		_("Remove service"),_("Cancel"),
		function() {
			p.removeservice( s.id );
			$('#diagrams_body').tabs('refresh');
			$('#singlefs_body').tabs('refresh');
			transactionCompleted("Service delete");
		}
	);
}

function bottomTabsShowHandlerDiagrams(event,ui) {
	/* ui.newPanel.selector is the DOM object with id #tabtitle<nn> */
	if (!ui.newPanel)  return;
	var id = nid2id(ui.newPanel[0].id);
	$('#selectrect').hide();
	removetransientwindowsanddialogs();
	Service.get(id).paintall();
	Service.cid = id;
}

function bottomTabsShowHandlerSFaults(event,ui) {
	/* ui.newPanel.selector is the DOM object with id #tabtitle<nn> */
	if (!ui.newPanel) {
		// on creation of the tab, select the first tab.
		return;
	}
	var id = nid2id(ui.newPanel[0].id);
	Service.cid = id;
	paintSingleFailures(Service.get(id));
}

function initTabDiagrams() {
	initChecklistsDialog('tWLS');
	initChecklistsDialog('tWRD');
	initChecklistsDialog('tEQT');

	$('#diagrams_body').tabs({
		activate: bottomTabsShowHandlerDiagrams,
		create: bottomTabsShowHandlerDiagrams,
		classes: {
			"ui-tabs": "ui-corner-bottom ui-corner-tl",
			"ui-tabs-nav": "ui-corner-bottom",
			"ui-tabs-tab": "ui-corner-bottom",
			"ui-tabs-panel": "ui-corner-asdf"
		}
	});
	$('#diagrams_body').on('click', 'span.tabcloseicon', bottomTabsCloseHandler);
	$('#bottomtabsdia').on('mouseenter', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-close').addClass('ui-icon-circle-close');
	});
	$('#bottomtabsdia').on('mouseleave', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-circle-close').addClass('ui-icon-close');
	});

	$('.th_name.thr_header').html( _("Name") );
	$('.th_descr.thr_header').html( _("Description") );
	$('.addthreatbutton').val( _("+ Add vulnerability"));
	$('.copybutton').val( _("Copy"));
	$('.pastebutton').val( _("Paste"));

	$('#mi_th span.lc:first').html( _("Vulnerabilities") );
	$('#mi_ct span.lc:first').html( _("Change type") );
	$('#mi_cttWLS span.lc:first').html( _("Wireless link") );
	$('#mi_cttWRD span.lc:first').html( _("Wired link") );
	$('#mi_cttEQT span.lc:first').html( _("Equipment") );
	$('#mi_cttACT span.lc:first').html( _("Actor") );
	$('#mi_cttUNK span.lc:first').html( _("Unknown link") );
	$('#mi_cl span.lc:first').html( _("Class") );
	$('#mi_rc span.lc:first').html( _("Rename class") );
	$('#mi_sx span.lc:first').html( _("Rename suffix") );
	// Menu item Similar/Identical is handled inside Nodecluster:_showpopupmenu()
	$('#mi_du span.lc:first').html( _("Duplicate") );
	$('#mi_de span.lc:first').html( _("Delete") );
	$('#mi_ccnone  span.lc:first').html( _("No label") );
	$('#mi_ccedit  span.lc:first').html( _("Edit labels ...") );
	$('#nodemenu').menu().hide();

	$('#mi_sd span.lc:first').html( _("Delete selection") );
	$('#mi_sc span.lc:first').html( _("Label") );
	$('#mi_scnone span.lc:first').html( _("No label") );
	$('#mi_scedit span.lc:first').html( _("Edit labels ...") );
	$('#selectmenu').menu().hide();

	$('#nodereport').dialog({
		autoOpen: false,
		minHeight: 80
	});
	$('#componentthreats').dialog({
		autoOpen: false,
		minHeight: 180,
		minWidth: 775,
		maxWidth: 779,
		width: 775
	});

	$('#servaddbuttondia').on('click', function() {
		let newid = createUUID();
		let newtitle = Service.autotitle(Project.cid);
		new Transaction('serviceCreate',
			[{id: newid, project: Project.cid}],
			[{id: newid, project: Project.cid, title: newtitle}]
		);
	});

	$('#templates').on('mouseenter', function() {
		$('.tC').css({visibility: 'visible'});
	}).on('mouseleave',function() {
		$('.tC').css({visibility: 'hidden'});
	});
	$(document).on('mousedown', '.tC', function(/*event,ui*/){
		// this.id is of the form "tC_YYY", and we need to know YYY
		var ctype = this.id.substr(3);
		displayChecklistsDialog(ctype);
		return false;
	});

	$('#mi_th').on('mouseup', function(e) {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		if (rn.type=='tACT' || rn.type=='tNOT') {
			return;
		}
		displayThreatsDialog(rn.component,e);
	});
	$('#mi_cttWLS').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		rn.changetype('tWLS');
		transactionCompleted("Node change type tWLS");
	});
	$('#mi_cttWRD').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		rn.changetype('tWRD');
		transactionCompleted("Node change type tWRD");
	});
	$('#mi_cttEQT').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		rn.changetype('tEQT');
		transactionCompleted("Node change type tEQT");
	});
	$('#mi_cttACT').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		rn.changetype('tACT');
		transactionCompleted("Node change type tACT");
	});
	$('#mi_cttUNK').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		rn.changetype('tUNK');
		transactionCompleted("Node change type tUNK");
	});
	$('#mi_rc').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		// Actors and notes don't have components
		if (rn.component==null)  return;

		var cm = Component.get(rn.component);
		var dialog = $('<div></div>');
		var snippet ='\
			<form id="form_componentrename">\
			<input id="field_componentrename" class="field_rename" name="fld" type="text" value="_CN_">\
			</form>\
		';
		snippet = snippet.replace(/_CN_/g, H(cm.title));
		dialog.append(snippet);
		var dbuttons = [];
		dbuttons.push({
			text: _("Cancel"),
			click: function() {
					$(this).dialog('close');
				}
		});
		dbuttons.push({
			text: _("Change name"),
			click: function() {
					var name = $('#field_componentrename');
					cm.changeclasstitle(name.val());
					$(this).dialog('close');
				}
		});
		dialog.dialog({
			title: _("Rename class '%%'", cm.title),
			modal: true,
			position: {my: 'center', at: 'center'},
			width: 350,
			height: 130,
			buttons: dbuttons,
			open: function() {
				$('#field_componentrename').focus().select();
				$('#form_componentrename').submit(function() {
					var name = $('#field_componentrename');
					cm.changeclasstitle(name.val());
					dialog.dialog('close');
				});
			},
			close: function(/*event, ui*/) {
				dialog.remove();
			}
		});
	});
	$('#mi_sx').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		// Actors and notes don't have components
		if (rn.component==null)  return;

		var dialog = $('<div></div>');
		var snippet ='\
			<form id="form_suffixrename">\
			<input id="field_suffixrename" class="field_rename" name="fld" type="text" value="_SX_">\
			</form>\
		';
		snippet = snippet.replace(/_SX_/g, H(rn.suffix));
		dialog.append(snippet);
		var dbuttons = [];
		dbuttons.push({
			text: _("Cancel"),
			click: function() {
					$(this).dialog('close');
				}
		});
		dbuttons.push({
			text: _("Change suffix"),
			click: function() {
					var name = $('#field_suffixrename');
					rn.changesuffix(name.val());
					$(this).dialog('close');
				}
		});
		dialog.dialog({
			title: _("Rename suffix '%%' for node '%%'", rn.suffix, rn.title),
			modal: true,
			position: {my: 'center', at: 'center'},
			width: 350,
			height: 130,
			buttons: dbuttons,
			open: function() {
				$('#field_suffixrename').focus().select();
				$('#form_suffixrename').submit(function() {
					var name = $('#field_suffixrename');
					rn.changesuffix(name.val());
					dialog.dialog('close');
				});
			},
			close: function(/*event, ui*/) {
				dialog.remove();
			}
		});
	});
	$('#mi_sm').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		// Actors and notes don't have components
		if (rn.component==null)  return;

		var cm = Component.get(rn.component);
		new Transaction('classSingular',
			[{id: cm.id, singular: cm.single}],
			[{id: cm.id, singular: cm.single==false}]
		);
	});
	$('#mi_du').on('mouseup', function() {
		$('#nodemenu').hide();
		let fh = $('.fancyworkspace').height();
		let fw = $('.fancyworkspace').width();
		var rn = Node.get( $('#nodemenu').data('menunode') );
		let newid = createUUID();
		let cm = Component.get(rn.component);

		if (cm && cm.single) {
			// A component marked 'single' cannot be duplicated, as it would create a second
			// instance within the same diagram.
			return;
		}

		if (rn.type=='tNOT' || rn.type=='tACT') {
			new Transaction('nodeCreate',
				[{id: newid}],
				[{
					id: newid,
					type: rn.type,
					service: rn.service,
					title: Node.autotitle(rn.type,rn.title),
					x: (rn.position.x > fw/2 ? rn.position.x-70 : rn.position.x+70) + Math.random()*20 - 10,
					y: (rn.position.y > fh/2 ? rn.position.y-30 : rn.position.y+30) + Math.random()*20 - 10,
					width: rn.position.width,
					height: rn.position.height,
					label: rn.color,
					connect: rn.connect.slice()
				}]
			);
			return;
		}

		new Transaction('nodeCreate',
			[{id: newid}],
			[{
				id: newid,
				type: rn.type,
				service: rn.service,
				title: rn.title,
				suffix: cm.newsuffix(),
				x: (rn.position.x > fw/2 ? rn.position.x-70 : rn.position.x+70) + Math.random()*20 - 10,
				y: (rn.position.y > fh/2 ? rn.position.y-30 : rn.position.y+30) + Math.random()*20 - 10,
				component: rn.component,
				width: rn.position.width,
				height: rn.position.height,
				label: rn.color,
				connect: []
			}]
		);
	});
	function colorfunc(c) {
		return function() {
			$('#nodemenu').hide();
			var rn = Node.get( $('#nodemenu').data('menunode') );
			new Transaction('nodeLabel',
				[{id: rn.id, label: rn.color}],
				[{id: rn.id, label: c}]
			);
		};
	}
	$('#mi_ccnone').on('mouseup', colorfunc('none') );
	$('#mi_ccred').on('mouseup', colorfunc('red') );
	$('#mi_ccorange').on('mouseup', colorfunc('orange') );
	$('#mi_ccyellow').on('mouseup', colorfunc('yellow') );
	$('#mi_ccgreen').on('mouseup', colorfunc('green') );
	$('#mi_ccblue').on('mouseup', colorfunc('blue') );
	$('#mi_ccpink').on('mouseup', colorfunc('pink') );
	$('#mi_ccpurple').on('mouseup', colorfunc('purple') );
	$('#mi_ccgrey').on('mouseup', colorfunc('grey') );
	$('#mi_ccedit').on('mouseup', showLabelEditForm );
	$('#mi_de').on('mouseup', function() {
		$('#nodemenu').hide();
		var rn = Node.get( $('#nodemenu').data('menunode') );
//		rasterConfirm(_("Delete element node?"),
//			_("Are you sure you want to delete %% '%%'?", (rn.type=='tNOT'? _("note") : _("node") ), rn.htmltitle()),
//			_("Delete"),_("Cancel"),
//			function() {
				if (rn.type=='tNOT' || rn.type=='tACT') {
					new Transaction('nodeCreate',
						[{
							id: rn.id,
							type: rn.type,
							service: rn.service,
							title: rn.title,
							x: rn.position.x,
							y: rn.position.y,
							width: rn.position.width,
							height: rn.position.height,
							label: rn.color,
							connect: rn.connect.slice()
						}],
						[{id: rn.id}]
					);
					return;
				}

				let cm = Component.get(rn.component);
				new Transaction('nodeCreate',
					[{
						id: rn.id,
						type: rn.type,
						service: rn.service,
						title: rn.title,
						suffix: rn.suffix,
						x: rn.position.x,
						y: rn.position.y,
						component: rn.component,
						thrass: cm.threatdata(),
						accordionopened: cm.accordionopened,
						width: rn.position.width,
						height: rn.position.height,
						label: rn.color,
						connect: rn.connect.slice()
					}],
					[{id: rn.id}]
				);
//			}
//		);
	});
	$('#mi_sd').on('mouseup', function() {
		let nodes = Node.nodesinselection();
		let num = nodes.length;
		$('#selectmenu').hide();
		if (num==0) {
			$('#selectrect').hide();
			return;
		}
		// Start blinking
		nodes.forEach(n => $(Node.get(n).jnid).effect('pulsate', { times:10 }, 4000) );
		rasterConfirm(_("Delete %% %% in selection?", num, plural(_("node"),_("nodes"),num)),
			_("Are you sure you want to delete all selected nodes?"),
			_("Delete %% %%", num, plural(_("node"),_("nodes"),num)),_("Cancel"),
			function() {
				// Stop any leftover pulsate effects
				nodes.forEach(n => $(Node.get(n).jnid).stop(true,true) );
				let undo_data = [];
				let data = [];
				nodes.forEach(n => {
					let rn = Node.get(n);
					if (rn.type=='tNOT' || rn.type=='tACT') {
						undo_data.push({
							id: rn.id,
							type: rn.type,
							service: rn.service,
							title: rn.title,
							x: rn.position.x,
							y: rn.position.y,
							width: rn.position.width,
							height: rn.position.height,
							label: rn.color,
							connect: rn.connect.slice()
						});
						data.push({id: rn.id});
						return;
					}

					let cm = Component.get(rn.component);
					undo_data.push({
						id: rn.id,
						type: rn.type,
						service: rn.service,
						title: rn.title,
						suffix: rn.suffix,
						x: rn.position.x,
						y: rn.position.y,
						component: rn.component,
						thrass: cm.threatdata(),
						accordionopened: cm.accordionopened,
						width: rn.position.width,
						height: rn.position.height,
						label: rn.color,
						connect: rn.connect.slice()
					});
					data.push({id: rn.id});
				});
				new Transaction('nodeCreate', undo_data, data);
				$('#selectrect').hide();
			},
			function() {
				// Stop any leftover pulsate effects
				nodes.forEach(n => $(Node.get(n).jnid).stop(true,true).show().css("opacity","") );
			});
	});
	$('#mi_sc').on('mouseenter',function(){
		populateLabelMenu();
	});
	$('#mi_scsm').on('mouseenter',function(){
		populateLabelMenu();
	});
	function selcolorfunc(c) {
		return function() {
			let nodes = Node.nodesinselection();
			$('#selectmenu').hide();
			if (nodes.length==0) {
				$('#selectrect').hide();
				return;
			}
			let undo_data = [];
			let data = [];
			nodes.forEach( n=> {
				let rn = Node.get(n);
				undo_data.push({id: n, label: rn.color});
				data.push({id: n, label: c});
			});
			new Transaction('nodeLabel', undo_data, data);
		};
	}
	$('#mi_scnone').on('mouseup', selcolorfunc('none') );
	$('#mi_scred').on('mouseup', selcolorfunc('red') );
	$('#mi_scorange').on('mouseup', selcolorfunc('orange') );
	$('#mi_scyellow').on('mouseup', selcolorfunc('yellow') );
	$('#mi_scgreen').on('mouseup', selcolorfunc('green') );
	$('#mi_scblue').on('mouseup', selcolorfunc('blue') );
	$('#mi_scpink').on('mouseup', selcolorfunc('pink') );
	$('#mi_scpurple').on('mouseup', selcolorfunc('purple') );
	$('#mi_scgrey').on('mouseup', selcolorfunc('grey') );
	$('#mi_scedit').on('mouseup', showLabelEditForm );

	var addhandler = function(typ) {
		return function() {
			var t = new Threat(typ);
			var p = Project.get( Project.cid );
			p.addthreat(t.id);
			t.addtablerow("#"+typ+"threats");
			// Apply the change to all components of matching type
			var it = new ComponentIterator({project: p.id, match: typ});
			for (it.first(); it.notlast(); it.next()) {
				var cm = it.getcomponent();
				var ta = new ThreatAssessment(typ);
				ta.settitle(t.title);
				ta.setdescription(t.description);
				cm.addthrass(ta);
			}
			// Start editing the name of the new vulnerability
			$('#thname'+t.id).click();
			refreshThreatsDialog();
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

	$('#tWLSaddthreat').on('click', addhandler('tWLS'));
	$('#tWLScopythreat').on('click', copyhandler('tWLS'));
	$('#tWLSpastethreat').on('click', pastehandler('tWLS'));

	$('#tWRDaddthreat').on('click', addhandler('tWRD'));
	$('#tWRDcopythreat').on('click', copyhandler('tWRD'));
	$('#tWRDpastethreat').on('click', pastehandler('tWRD'));

	$('#tEQTaddthreat').on('click', addhandler('tEQT'));
	$('#tEQTcopythreat').on('click', copyhandler('tEQT'));
	$('#tEQTpastethreat').on('click', pastehandler('tEQT'));

	if (DEBUG && !Rules.consistent()) {
		bugreport('the rules are not internally consistent','initTabDiagrams');
	}
}

function initChecklistsDialog(type) {
	// When displaying multiple checklist windows, each will get the same location and size.
	// Since that is confusing, we prevent obscuration by using a type-specific offset.
	var offsets = {'tWLS': 100, 'tWRD': 130, 'tEQT': 160};
	$('#checklist_'+type).dialog({
		title: _("Common vulnerabilities for all nodes of type '%%'", Rules.nodetypes[type]),
		closeOnEscape: false,
		minWidth: 725,
		minHeight: 180,
		position: {my: 'left+'+(offsets[type]+50)+' top+'+offsets[type], at: 'left top', of: '#tabs', collision: 'fit'},
		autoOpen: false
	});
}

function populateLabelMenu() {
	var p = Project.get(Project.cid);
	$('#mi_ccred span.lc:first').html( '"' + H(p.labels[0]) + '"' );
	$('#mi_ccorange span.lc:first').html( '"' + H(p.labels[1]) + '"' );
	$('#mi_ccyellow span.lc:first').html( '"' + H(p.labels[2]) + '"' );
	$('#mi_ccgreen span.lc:first').html( '"' + H(p.labels[3]) + '"' );
	$('#mi_ccblue span.lc:first').html( '"' + H(p.labels[4]) + '"' );
	$('#mi_ccpink span.lc:first').html( '"' + H(p.labels[5]) + '"' );
	$('#mi_ccpurple span.lc:first').html( '"' + H(p.labels[6]) + '"' );
	$('#mi_ccgrey span.lc:first').html( '"' + H(p.labels[7]) + '"' );

	$('#mi_scred span.lc:first').html( '"' + H(p.labels[0]) + '"' );
	$('#mi_scorange span.lc:first').html( '"' + H(p.labels[1]) + '"' );
	$('#mi_scyellow span.lc:first').html( '"' + H(p.labels[2]) + '"' );
	$('#mi_scgreen span.lc:first').html( '"' + H(p.labels[3]) + '"' );
	$('#mi_scblue span.lc:first').html( '"' + H(p.labels[4]) + '"' );
	$('#mi_scpink span.lc:first').html( '"' + H(p.labels[5]) + '"' );
	$('#mi_scpurple span.lc:first').html( '"' + H(p.labels[6]) + '"' );
	$('#mi_scgrey span.lc:first').html( '"' + H(p.labels[7]) + '"' );
}

function showLabelEditForm() {
	var p = Project.get(Project.cid);
	$('#nodemenu').hide();
	var dialog = $('<div></div>');
	var snippet ='\
		<form id="form_editlabels">\
		<div class="smallblock Bred"></div><input id="field_red" class="field_label_text" name="fld_red" type="text" value="_RED_"><br>\
		<div class="smallblock Borange"></div><input id="field_orange" class="field_label_text" name="fld_orange" type="text" value="_ORANGE_"><br>\
		<div class="smallblock Byellow"></div><input id="field_yellow" class="field_label_text" name="fld_yellow" type="text" value="_YELLOW_"><br>\
		<div class="smallblock Bgreen"></div><input id="field_green" class="field_label_text" name="fld_green" type="text" value="_GREEN_"><br>\
		<div class="smallblock Bblue"></div><input id="field_blue" class="field_label_text" name="fld_blue" type="text" value="_BLUE_"><br>\
		<div class="smallblock Bpink"></div><input id="field_pink" class="field_label_text" name="fld_pink" type="text" value="_PINK_"><br>\
		<div class="smallblock Bpurple"></div><input id="field_purple" class="field_label_text" name="fld_purple" type="text" value="_PURPLE_"><br>\
		<div class="smallblock Bgrey"></div><input id="field_grey" class="field_label_text" name="fld_grey" type="text" value="_GREY_"><br>\
		</form>\
	';
	snippet = snippet.replace(/_RED_/g, H(p.labels[0]));
	snippet = snippet.replace(/_ORANGE_/g, H(p.labels[1]));
	snippet = snippet.replace(/_YELLOW_/g, H(p.labels[2]));
	snippet = snippet.replace(/_GREEN_/g, H(p.labels[3]));
	snippet = snippet.replace(/_BLUE_/g, H(p.labels[4]));
	snippet = snippet.replace(/_PINK_/g, H(p.labels[5]));
	snippet = snippet.replace(/_PURPLE_/g, H(p.labels[6]));
	snippet = snippet.replace(/_GREY_/g, H(p.labels[7]));
	dialog.append(snippet);
	var dbuttons = [];
	dbuttons.push({
		text: _("Cancel"),
		click: function() {
				$(this).dialog('close');
			}
	});
	dbuttons.push({
		text: _("Done"),
		click: function() {
			let newlabels = [];
			newlabels[0] = trimwhitespace(String($('#field_red').val())).substr(0,50);
			newlabels[1] = trimwhitespace(String($('#field_orange').val())).substr(0,50);
			newlabels[2] = trimwhitespace(String($('#field_yellow').val())).substr(0,50);
			newlabels[3] = trimwhitespace(String($('#field_green').val())).substr(0,50);
			newlabels[4] = trimwhitespace(String($('#field_blue').val())).substr(0,50);
			newlabels[5] = trimwhitespace(String($('#field_pink').val())).substr(0,50);
			newlabels[6] = trimwhitespace(String($('#field_purple').val())).substr(0,50);
			newlabels[7] = trimwhitespace(String($('#field_grey').val())).substr(0,50);
				for (var i=0; i<=7; i++) {
					if (newlabels[i]=="") {
						newlabels[i] = Project.defaultlabels[i];
					}
				}
//			p.store();
//			$(this).dialog('close');
//			transactionCompleted("Label edit");
			new Transaction('labelEdit',
				[{id: p.id, labels: p.labels}],
				[{id: p.id, labels: newlabels}]
			);
			$(this).remove();
		}
	});
	dialog.dialog({
		title: _("Edit labels"),
		modal: true,
		width: 285,
		height: 320,
		buttons: dbuttons
	});
}

function workspacedrophandler(event, ui) {
	let typ = ui.draggable[0].id;
	// The id of the template must be a valid type
	if (!Rules.nodetypes[typ]) {
		bugreport('object with unknown type','workspacedrophandler');
	}

	$('.tC').css('visibility','hidden');

	let newid = createUUID();
	let newtitle = Node.autotitle(typ);
	let r = $('#tab_diagrams').offset();
	let newx = event.originalEvent.pageX-50-r.left+$('#diagrams'+Service.cid).scrollLeft();
	let newy = event.originalEvent.pageY-10-r.top +$('#diagrams'+Service.cid).scrollTop();

	if (typ=='tNOT' || typ=='tACT') {
		new Transaction('nodeCreate',
			[{id: newid}],
			[{
				id: newid,
				type: typ,
				service: Service.cid,
				title: newtitle,
				x: newx,
				y: newy
			}]
		);
	} else {
		new Transaction('nodeCreate',
			[{id: newid}],
			[{
				id: newid,
				type: typ,
				service: Service.cid,
				title: newtitle,
				x: newx,
				y: newy,
				component: createUUID(),
				thrass: Project.get(Project.cid).defaultthreatdata(typ)
			}]
		);
	}
}

function refreshThreatsDialog(force) {
	if (!$('#componentthreats').dialog('isOpen') && force!==true)  return;

	// Dialog is open, nog repaint its contents
	var c = Component.get(Component.ThreatsComponent);
	var snippet = '<div id="dialogthreatlist">\
		<div class="threat">\
		<div class="th_name th_col thr_header">_LN_</div>\
		<div class="th_freq th_col thr_header">_LF_</div>\
		<div class="th_impact th_col thr_header">_LI_</div>\
		<div class="th_total th_col thr_header">_LT_</div>\
		<div class="th_remark th_col thr_header">_LR_</div>\
		</div>\
		<div id="threats_CI_" class="threats"></div>\
		<input id="dthadddia_CI_" class="addthreatbutton" type="button" value="_BA_">\
		<input id="dthcopydia_CI_" class="copybutton" type="button" value="_BC_">\
		<input id="dthpastedia_CI_" class="pastebutton" type="button" value="_BP_">\
		</div>';
	snippet = snippet.replace(/_LN_/g, _("Name"));
	snippet = snippet.replace(/_LF_/g, _("Freq."));
	snippet = snippet.replace(/_LI_/g, _("Impact"));
	snippet = snippet.replace(/_LT_/g, _("Total"));
	snippet = snippet.replace(/_LR_/g, _("Remark"));
	snippet = snippet.replace(/_BA_/g, _("+ Add vulnerability"));
	snippet = snippet.replace(/_BC_/g, _("Copy"));
	snippet = snippet.replace(/_BP_/g, _("Paste"));
	snippet = snippet.replace(/_CI_/g, c.id);
	$('#componentthreats').html(snippet);
	c.setmarkeroid(null);

	for (var i=0; i<c.thrass.length; i++) {
		if (c.thrass[i]==null) continue;
		var th = ThreatAssessment.get(c.thrass[i]);
		th.addtablerow('#threats'+c.id,'dia');
	}
	$('#dthadddia'+c.id).button();
	$('#dthcopydia'+c.id).button();
	$('#dthpastedia'+c.id).button();
	$('#dthadddia'+c.id).removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#dthcopydia'+c.id).removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#dthpastedia'+c.id).removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#dthadddia'+c.id).on('click',  function() {
		var c = Component.get(nid2id(this.id));
		var th = new ThreatAssessment((c.type=='tUNK' ? 'tEQT' : c.type));
		c.addthrass(th);
		th.addtablerow('#threats'+c.id,'dia');
		transactionCompleted("Vuln add");
	});
	$('#dthcopydia'+c.id).on('click',  function() {
		var cm = Component.get(nid2id(this.id));
		ThreatAssessment.Clipboard = [];
		for (var i=0; i<cm.thrass.length; i++) {
			var te = ThreatAssessment.get(cm.thrass[i]);
			ThreatAssessment.Clipboard.push({t: te.title, y: te.type, d: te.description, p: te.freq, i: te.impact, r: te.remark});
		}
	});
	$('#dthpastedia'+c.id).on('click',  function() {
		var cm = Component.get(nid2id(this.id));
		var newte = cm.mergeclipboard();
		for (i=0; i<cm.thrass.length; i++) {
			th = ThreatAssessment.get(cm.thrass[i]);
			if (newte.indexOf(cm.thrass[i])==-1) {
				$('#dthdia_'+th.id).remove();
			}
			th.addtablerow('#threats'+cm.id,'dia');
		}
		cm.setmarker();
		transactionCompleted("Vuln paste");
	});
	$('#threats'+c.id).sortable({
		containment: 'parent',
		helper: 'clone',
		cursor: 'ns-resize',
		deactivate: function(/*event,ui*/) {
			var newlist = [];
			for (var i=0; i<this.children.length; i++) {
				newlist.push( nid2id(this.children[i].id) );
			}
			if (newlist.length != c.thrass.length) {
				bugreport("internal error in sorting","refreshThreatsDialog");
			}
			c.thrass = newlist;
			c.store();
			transactionCompleted("Reorder thrass of component "+c.id);
		}
	});
}

function displayThreatsDialog(cid,where) {
	var c = Component.get(cid);
	Component.ThreatsComponent = cid;

	if ($('#componentthreats').dialog('isOpen')) {
		$('#componentthreats').dialog('close');
	}
	refreshThreatsDialog(true);
	$('#componentthreats').dialog({
		title: _("Vulnerability assessment for '%%'", c.title) + (c.nodes.length>1 ? _(" (%% nodes)", c.nodes.length) : ""),
		position: {my: 'left top', at: 'right', of: where, collision: 'fit'},
		closeOnEscape: false
	});
	$('#componentthreats').dialog('open');
	// First delete button gains focus, and is highlighted. Looks ugly.
	$('#dialogthreatlist input').trigger('blur');
}

function displayChecklistsDialog(type) {
	$('#'+type+'addthreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#'+type+'copythreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#'+type+'pastethreat').removeClass('ui-corner-all').addClass('ui-corner-bottom');

	$("#checklist_"+type).dialog('open');
	$('.checklist input').each( function () {
		$(this).trigger('blur'); return true;
	});
}

/* arrayJoinAsString: join strings into an English phrase.
 *
 * a: an array of strings
 * str: the joining word
 * E.g. arrayJoinAsString(["red","green","orange","blue"],"and") = "red, green, orange and blue"
 */
function arrayJoinAsString(a,str) {
	if (a.length==0)  return _("(none)");
	if (a.length==1)  return a[0];
	var last = a.pop();
	return a.join(", ")	+ " " + str + " " + last;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|	  Single Faults	  |* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function initTabSingleFs() {
	$('#singlefs_body').tabs({
		activate: bottomTabsShowHandlerSFaults,
		create: bottomTabsShowHandlerSFaults,
		classes: {
			"ui-tabs": "ui-corner-bottom ui-corner-tl",
			"ui-tabs-nav": "ui-corner-bottom",
			"ui-tabs-tab": "ui-corner-bottom",
			"ui-tabs-panel": "ui-corner-asdf"
		}
	});
	$('#singlefs_body').on('click', 'span.tabcloseicon', bottomTabsCloseHandler);
	$('#bottomtabssf').on('mouseenter', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-close').addClass('ui-icon-circle-close');
	});
	$('#bottomtabssf').on('mouseleave', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-circle-close').addClass('ui-icon-close');
	});

	$('#servaddbuttonsf').on('click',  function() {
		let newid = createUUID();
		let newtitle = Service.autotitle(Project.cid);
		new Transaction('serviceCreate',
			[{id: newid, project: Project.cid}],
			[{id: newid, project: Project.cid, title: newtitle}]
		);
	});
}

var SFSortOpt = 'alph';

function paintSingleFailures(s) {
	var appendstring = "";
	$('#singlefs_workspace'+s.id).empty();

	var it = new ComponentIterator({service: s.id});
	it.first();
	if (!it.notlast()) {
		$('#singlefs_workspace'+s.id).append(
			'<p class="firstp sfaccordion">'
			+ _("This space will show all vulnerability evaluations for the components in this service. ")
			+ _("Since this diagram for this service is empty, there is nothing to see here yet. ")
			+ _("Add some nodes to the diagrams first.")
		);
		return;
	}

	// Adding elements to the DOM is slow, so it is best to do it all at
	// once, rather than piece by piece.
	// First collect the bulk of the DOM elements to be appended. Then loop
	// over the components again, adding the vulnerabilities to them, and adding
	// behaviour stuff.
	snippet = '\
		<div id="somesf_SV_" class="displayoptsarea donotprint">\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_L1_</span><br>\n\
			<span id="expandallsf_SV_">_EA_</span>\n\
			<span id="collapseallsf_SV_" class="collapseall">_CA_</span>\n\
		  </div>\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_L2_</span><br>\n\
			<fieldset>\n\
				<input type="radio" id="sfsort_alph_SV_" name="sfsort_SV_"><label for="sfsort_alph_SV_">_O1_</label>\n\
				<input type="radio" id="sfsort_type_SV_" name="sfsort_SV_"><label for="sfsort_type_SV_">_O2_</label>\n\
				<input type="radio" id="sfsort_thrt_SV_" name="sfsort_SV_"><label for="sfsort_thrt_SV_">_O3_</label>\n\
			</fieldset>\n\
		  </div>\n\
		</div>\
		<div id="sfacclist_SV_" class="sfacclist">\
		</div>\
	';
	snippet = snippet.replace(/_L1_/g, _("Fold:"));
	snippet = snippet.replace(/_EA_/g, _("Expand all"));
	snippet = snippet.replace(/_CA_/g, _("Collapse all"));
	snippet = snippet.replace(/_L2_/g, _("Sort:"));
	snippet = snippet.replace(/_O1_/g, _("Alphabetically"));
	snippet = snippet.replace(/_O2_/g, _("by Type"));
	snippet = snippet.replace(/_O3_/g, _("by Vulnerability level"));
	snippet = snippet.replace(/_SN_/g, H(s.title));
	snippet = snippet.replace(/_SV_/g, s.id);
	snippet = snippet.replace(/_PN_/g, H(Project.get(s.project).title));
	snippet = snippet.replace(/_PJ_/g, s.project);
	$('#singlefs_workspace'+s.id).append(snippet);
	$('#somesf'+s.id).headroom({
		scroller: document.querySelector('#singlefs_workspace'+s.id),
		tolerance : {
			up : 20,
			down : 20
		}
	});

	$('#expandallsf'+s.id).button({icon: 'ui-icon-plus'});
	$('#collapseallsf'+s.id).button({icon: 'ui-icon-minus'});
	$('#somesf'+s.id+' input[type=radio]').checkboxradio({icon: false});
	$('#somesf'+s.id+' fieldset').controlgroup();

	$('#expandallsf'+s.id).on('click',  function(evt){
		$('#singlefs_workspace'+s.id).scrollTop(0);
		expandAllSingleF(nid2id(evt.target.id));
	});
	$('#collapseallsf'+s.id).on('click',  function(evt){
		$('#singlefs_workspace'+s.id).scrollTop(0);
		collapseAllSingleF(nid2id(evt.target.id));
	});

	var create_sf_sortfunc = function(opt,sid) {
		return function(/*evt*/) {
			SFSortOpt = opt;
			paintSingleFailures(Service.get(sid));
		};
	};

	$('[for=sfsort_alph'+s.id+']').on('click', create_sf_sortfunc('alph',s.id));
	$('[for=sfsort_type'+s.id+']').on('click', create_sf_sortfunc('type',s.id));
	$('[for=sfsort_thrt'+s.id+']').on('click', create_sf_sortfunc('thrt',s.id));

	switch (SFSortOpt) {
	case 'alph':
		$('#sfsort_alph'+s.id).prop('checked',true);
		it.sortByName();
		break;
	case 'type':
		$('#sfsort_type'+s.id).prop('checked',true);
		it.sortByType();
		break;
	case 'thrt':
		$('#sfsort_thrt'+s.id).prop('checked',true);
		it.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","paintSingleFailures");
	}
	$('#somesf'+s.id+' fieldset').controlgroup('refresh');

	for (it.first(); it.notlast(); it.next()) {
		var i;
		var cm = it.getcomponent();
		//if (cm.type=='tACT') continue;
		var snippet = '\n\
		  <div id="sfaccordion_SV___ID_" class="sfaccordion">\n\
			<h3><a href="#">_LSF_ "_TI_" (_TY__AP_) _LB_<span id="sfamark_SV___ID_"></span></a></h3>\n\
			<div>\n\
			 <div id="sfa_SV___ID_">\n\
			  <div class="threat">\n\
			   <div class="th_name th_col thr_header">_LN_</div>\n\
			   <div class="th_freq th_col thr_header">_LF_</div>\n\
			   <div class="th_impact th_col thr_header">_LI_</div>\n\
			   <div class="th_total th_col thr_header">_LT_</div>\n\
			   <div class="th_remark th_col thr_header">_LR_</div>\n\
			  </div>\n\
			 </div>\n\
		';
		snippet = snippet.replace(/_LSF_/g, _("Single failures for"));
		snippet = snippet.replace(/_LN_/g, _("Name"));
		snippet = snippet.replace(/_LF_/g, _("Freq."));
		snippet = snippet.replace(/_LI_/g, _("Impact"));
		snippet = snippet.replace(/_LT_/g, _("Total"));
		snippet = snippet.replace(/_LR_/g, _("Remark"));

		if (Preferences.label) {
			var p = Project.get(cm.project);
			var labels = [];
			var str;
			for (i=0; i<cm.nodes.length; i++) {
				var rn = Node.get(cm.nodes[i]);
				if (rn.color!='none' && labels.indexOf(rn.color)==-1) {
					labels.push(rn.color);
				}
			}
			if (labels.length==0) {
				snippet = snippet.replace(/_LB_/, '');
			} else if (labels.length==1) {
				str = '<div class="sflabelgroup"><div class="smallblock B'+labels[0]+'"></div><span class="labelind">'+H(p.strToLabel(labels[0]))+'</span></div>';
				snippet = snippet.replace(/_LB_/, str);
			} else {
				str = '<div class="sflabelgroup">';
				for (i=0; i<labels.length; i++) {
					str += '<div class="smallblock B'+labels[i]+'" title="' + H(p.strToLabel(labels[i])) + '"></div>';
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
			 <input id="sfaadd_SV___ID_" class="addthreatbutton" type="button" value="_BA_">\n\
			 <input id="sfacopy_SV___ID_" class="copybutton" type="button" value="_BC_">\n\
			 <input id="sfapaste_SV___ID_" class="pastebutton" type="button" value="_BP_">\n\
			</div>\n\
		  </div>\n\
		';
		snippet = snippet.replace(/_BA_/g, _("+ Add vulnerability"));
		snippet = snippet.replace(/_BC_/g, _("Copy"));
		snippet = snippet.replace(/_BP_/g, _("Paste"));
		snippet = snippet.replace(/_SV_/g, s.id);
		snippet = snippet.replace(/_ID_/g, cm.id);
		snippet = snippet.replace(/_TY_/g, Rules.nodetypes[cm.type]);
		snippet = snippet.replace(/_TI_/g, H(cm.title));
		snippet = snippet.replace(/_AP_/g, (cm.nodes.length==1 || cm.single ? '' : ', '+cm.nodes.length+' '+_("nodes") ));
		appendstring += snippet;
	}

	appendstring += '<br><br>\n';
	// Insert the bulk of the new DOM elements
	$('#sfacclist'+s.id).append(appendstring);

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
					if (newte.indexOf(cm.thrass[i])==-1) {
						$('#dthsfa'+s.id+'_'+cm.id+'_'+th.id).remove();
					}
					th.addtablerow('#sfa'+s.id+'_'+cm.id,"sfa"+s.id+'_'+cm.id);
				}
				cm.setmarker();
				transactionCompleted("Vuln paste");
			};
		};
		$('#sfaadd'+s.id+'_'+cm.id).on('click',  addhandler(s,cm) );
		$('#sfacopy'+s.id+'_'+cm.id).on('click',  copyhandler(s,cm) );
		$('#sfapaste'+s.id+'_'+cm.id).on('click',  pastehandler(s,cm) );
		var openclose = function(cm){
			return function(event,ui) {
				opencloseSFAccordion(cm,s.id,event,ui);
			};
		};
		var acc = $('#sfaccordion'+s.id+'_'+cm.id);
		acc.accordion({
			beforeActivate: openclose(cm),
			heightStyle: 'content',
			collapsible: true,
			animate: 300,
			active: (cm.accordionopened ? 0 : false)
		});

		$('#' + acc[0].id + ' .sfa_sortable').sortable({
			containment: 'parent',
			helper: 'clone',
			cursor: 'ns-resize',
			deactivate: function(/*event,ui*/) {
				var newlist = [];
				var cm = Component.get( nid2id(this.previousElementSibling.id) );
				for (var i=0; i<this.children.length; i++) {
//					var obj = $('#' + this.children[i].id);
					newlist.push( nid2id(this.children[i].id) );
				}
				if (cm==null || newlist.length != cm.thrass.length) {
					bugreport("internal error in sorting","paintSingleFailures");
				}
				cm.thrass = newlist;
				cm.store();
				transactionCompleted("Reorder thrass of component "+cm.id);
			}
		});
	}

	$('#singlefs_body input[type=button]').button();
	$('#singlefs_body input[class~="addthreatbutton"]').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#singlefs_body input[class~="copybutton"]').removeClass('ui-corner-all').addClass('ui-corner-bottom');
	$('#singlefs_body input[class~="pastebutton"]').removeClass('ui-corner-all').addClass('ui-corner-bottom');
}

/* This function is called when the head of the accordion for Component is clicked, but before
 * the accordion is opened or closed.
 */
function opencloseSFAccordion(cm,sid,event,ui) {
	cm.setaccordionopened(ui.oldPanel.length==0);
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

		if (el.accordion('option','active')===false) {
			el.accordion('option', 'active', 0);
			// The following is not necessary during normal use, but appears to be required when
			// expandAllSingleF() is called from window.onBeforePrint, or when stepping through
			// this loop using a debugger ?!
			$('#sfaccordion'+sid+'_'+cm.id+' .ui-accordion-content').css('height','').css('overflow','').css('padding-top','').css('padding-bottom','');
			el.accordion('refresh');
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
		$('#sfaccordion'+sid+'_'+cm.id).accordion('option','active',false);
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|  Common Cause Failures  |* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

// Time for submenu
var ccfmsm_timer;
// The cluster for which details are currently displayed on the right-hand side.
var CurrentCluster;

function initTabCCFs() {
	CurrentCluster = null;

	// Localise user interface
	$('#mi_ccfc span.lc:first').html( _("Create new cluster") );
	$('#mi_ccfm span.lc:first').html( _("Move to") );
	$('#ccfmenu').menu().hide();

	// Event handlers for mouse actions
	$('#ccfs_details').on('click', '.childnode', clickSelectHandler);
	$('#ccfs_details').on('click', '.clusternode', clickCollapseHandler);
	$('#ccfs_details').on('contextmenu', '.tlistitem', contextMenuHandler);
	$('#ccfs_details').on('click',  function() {
		$('.li_selected').removeClass('li_selected');
	});

	// Event handlers for menu items
	$('#mi_ccfc').on('click', createClusterHandler);
	$('#mi_ccfmsm').on('click', '.ui-menu-item', moveToClusterHandler);
}

// To be able to extend the selection.
var LastSelectedNode;
// To find the NodeCluster id on which the context menu was invoked.
var MenuCluster;


/* In the event handlers 'this.id' is of the form linodeNNN_CCC (for nodes)
 * or linodeCCC (for cluster headings), where NNN is a Node id and CCC is a NodeCluster id.
 *
 * To get the cluster id, just use nid2id().
 * To get the node id, use internalID().
 */

/* internalID(str)
 * If str ends in XXX_YYY, where XXX and YYY are UUIDs, then return XXX.
 * Else return null.
 */
function internalID(str) {
	str = str.replace(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/, '');
	var m = str.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_$/);
	if (m) {
		return m[1];
	} else {
		return null;
	}
}

function clickCollapseHandler(ev) {
	var ul = $(this).parent();
	var cluster = NodeCluster.get(nid2id(this.id));

	$('#ccfmenu').hide();

	// Ignore when clicking on the text label, as that will start editInPlace
	if (ev.target.id.match(/^litext/) || ev.target.id=='')  return;

	// Do not manually collapse the root item
	if ($(this).hasClass('tlistroot'))  return;

	if (cluster.accordionopened) {
		ul.find('.ui-icon').first().removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
		cluster.setaccordionopened(false);
		ul.children().slice(1).slideUp('fast');
	} else {
		ul.find('.ui-icon').first().removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');
		cluster.setaccordionopened(true);
		ul.children().slice(1).slideDown('fast');
	}
}

function clickSelectHandler(ev) {
	$('#ccfmenu').hide();
	// Select or deselect list items. Extend the selection using
	// the shift key.
	if ($(this).hasClass('li_selected')) {
		// Node is already selected. On a 'plain' click, unselect it.
		// When using modifier keys, select only the clicked node.
		if (!ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
			$('.tlistitem').removeClass('li_selected');
			$(this).addClass('li_selected');
		} else {
			$(this).removeClass('li_selected');
		}
	} else {
		// Node is not selected. On a 'plain' click, first undo the selection.
		// Maintain and extend the selection if a modified key is used.
		if (!ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
			$('.tlistitem').removeClass('li_selected');
			LastSelectedNode = this.id;
		}
		if (ev.shiftKey) {
			// Check whether the newly clicked node is in the same cluster as the
			// node laste selected. Else ignore.
			if (LastSelectedNode && nid2id(this.id)==nid2id(LastSelectedNode)) {
				// Select all nodes from LastSelectedId to this.id, inclusive.
				var fromnid = internalID(LastSelectedNode);
				var tonid = internalID(this.id);
//				var cluster = nid2id(this.id);

				var idlist = [];
				var jq;
				jq = $(this).parent();
				jq = jq.children('.childnode');
				jq.map(function(){
					idlist.push(this.id);
				});
				// find the from and to nodes
				var fromi, toi;
				for (var i=0; i<idlist.length; i++) {
					var nd = internalID(idlist[i]);
					if (fromnid==nd) fromi = i;
					if (tonid==nd) toi = i;
				}
				// Swap so that fromi <= toi
				if (fromi>toi) {
					i=fromi; fromi=toi; toi=i;
				}
				// Select all those nodes
				for (i=fromi; i<=toi; i++) {
					$('#'+idlist[i]).addClass('li_selected');
				}
			}
		} else {
			// No modifier key was used: select the current node.
			// Meta/ctrl key was used: select the current node (to extend the selection)
			$(this).addClass('li_selected');
			LastSelectedNode = this.id;
		}
	}
	ev.stopPropagation();
	return true;
}

function contextMenuHandler(ev) {
	var nid = internalID(this.id);
	var cluster = NodeCluster.get(nid2id(this.id));
//	var root = NodeCluster.get(cluster.root());

	MenuCluster = cluster.id;
//	$('#ccfmenu').css('left', ev.clientX+2);
//	$('#ccfmenu').css('top', ev.clientY-5);

	if (nid==null) {
		// Popup menu called on a cluster
		// Cannot move to the parent (because that's where it is already), nor can it be
		// moved into any of its own descendants. And it cannot be moved onto itself.
		populateClusterSubmenu(cluster, cluster.allclusters().concat(cluster.parentcluster));
		$('#mi_ccfc span.lc:first').html( _("Remove cluster") );
		$('#mi_ccfc div').append('<span class="ui-icon ui-icon-trash"></span>');
		$('#mi_ccfc').removeClass('ui-state-disabled');
		LastSelectedNode = null;
	} else {
		// Popup menu called on node
		populateClusterSubmenu(cluster,[]);
		$('#mi_ccfc span.lc:first').html( _("Create new cluster") );
		$('#mi_ccfc span.ui-icon').remove();
		LastSelectedNode = this.id;
		// Remove the selection unless the current node is also selected
		if (!$(this).hasClass('li_selected')) {
			$('.tlistitem').removeClass('li_selected');
		}
		$(this).addClass('li_selected');

		if ($('#ccfs_details .li_selected').length<2) {
			$('#mi_ccfc').addClass('ui-state-disabled');
		} else {
			$('#mi_ccfc').removeClass('ui-state-disabled');
		}
	}

	$('#ccfmenu').menu('collapseAll');
	$('#ccfmenu').show();
	$('#ccfmenu').position({
		my: "left top",
		at: "left+" + ev.clientX + "px top+" + ev.clientY + "px",
		of: "body",
		collision: "fit"
	});
}

function populateClusterSubmenu(cluster,exceptions) {
	var allclusters = NodeCluster.get(cluster.root()).allclusters();
	var snippet = '';
	/* Add all sub(sub)-clusters as submenuitems */
	for (var i=0; i<allclusters.length; i++) {
		var cl = NodeCluster.get(allclusters[i]);
		snippet += '<li id="ccf_msm_CI_" class="_DIS_"><div><span class="lc">_CN_</span></div></li>';
		snippet = snippet.replace(/_CI_/, cl.id);
		snippet = snippet.replace(/_DIS_/, (exceptions.indexOf(cl.id)==-1 ? '' : 'ui-state-disabled'));
		if (i==0) {
			/* root cluster */
			snippet = snippet.replace(/_CN_/, cl.title + ' ' + _("(root)"));
		} else {
			snippet = snippet.replace(/_CN_/, cl.title);
		}
	}
	$('#mi_ccfmsm').html(snippet);
	$('#ccfmenu').menu("refresh");
}

function createClusterHandler(/*event*/) {
	var cluster = NodeCluster.get(MenuCluster);

	$('#ccfmenu').hide();
	if (LastSelectedNode) {
		// Called on a node: create a new cluster from selection
		var nc = new NodeCluster(cluster.type);
		nc.setproject(cluster.project);
		nc.setparent(cluster.id);
		cluster.addchildcluster( nc.id );
		nc.addthrass();
		moveSelectionToCluster(nc);
		transactionCompleted("Create cluster from selection");
	} else {
		// Called on a cluster; absorbe that cluster into its parent.
		removeCluster(cluster);
		transactionCompleted("Remove cluster");
	}
}

function removeCluster(cluster) {
	var parent = NodeCluster.get(cluster.parentcluster);
	var root = NodeCluster.get(cluster.root());

	for (var i=0; i<cluster.childnodes.length; i++) {
		parent.addchildnode(cluster.childnodes[i]);
	}
	for (i=0; i<cluster.childclusters.length; i++) {
		parent.addchildcluster(cluster.childclusters[i]);
	}
	parent.removechildcluster(cluster.id);
	cluster.destroy();
	root.normalize();
	root.calculatemagnitude();
	repaintCluster(root.id);
	repaintClusterDetails(root);
}

function moveCluster(from_cluster,to_cluster) {
	var parent = NodeCluster.get(from_cluster.parentcluster);
	var root = NodeCluster.get(from_cluster.root());

	parent.removechildcluster(from_cluster.id);
	to_cluster.addchildcluster(from_cluster.id);

	root.normalize();
	root.calculatemagnitude();
	repaintCluster(root.id);
	repaintClusterDetails(root);
}

function moveToClusterHandler(/*event*/) {
	// Cluster indicated by the submenu item
	var to_cluster = NodeCluster.get(nid2id(this.id));

	$('#ccfmenu').hide();
	if (LastSelectedNode) {
		// Called on a node: move selection to cluster
		moveSelectionToCluster(to_cluster);
		transactionCompleted("Move selection to cluster");
	} else {
		var from_cluster = NodeCluster.get(MenuCluster);
		moveCluster(from_cluster, to_cluster);
		transactionCompleted("Move cluster");
	}
}

/* Each selected node is moved into 'cluster', then the entire set of clusters
 * is normalized, recalculated, and scheduled for repainting.
 */
function moveSelectionToCluster(cluster) {
	var root = NodeCluster.get(cluster.root());
	$('.li_selected').each(function(){
		var n = internalID(this.id);
		root.removechildnode(n);
		cluster.addchildnode(n);
	});
	root.normalize();
	root.calculatemagnitude();
	repaintCluster(root.id);
	repaintClusterDetails(root);
	// Wait for the repaint to finish, the new cluster to be painted, then
	// trigger a rename
	setTimeout(function(){
		$('#litext'+cluster.id).trigger('click');
	},500);
}

var CCFSortOpt = 'alph';
//var CCFMinOpt = '-';

function AddAllClusters() {
	var snippet = '\
		<h1 class="printonly underlay">_LCCF_</h1>\
		<h2 class="printonly underlay projectname">_LP_: _PN_</h2>\
		<p id="noccf" class="firstp sfaccordion">_N1_\
		_N2_\
		_N3_</p>\
		<div id="outerimpacthint" style="display:none"><div id="hintpoint"></div><img src="../img/hint.png"><div id="impacthint"></div></div>\
		<div id="someccf" class="donotprint displayoptsarea">\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_L1_</span><br>\n\
			<span id="expandallccf">_EA_</span>\n\
			<span id="collapseallccf" class="collapseall">_CA_</span>\n\
		  </div>\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_L2_</span><br>\n\
			<fieldset>\n\
				<input type="radio" id="ccfsort_alph" name="ccfsort"><label for="ccfsort_alph">_O1_</label>\n\
				<input type="radio" id="ccfsort_type" name="ccfsort"><label for="ccfsort_type">_O2_</label>\n\
				<input type="radio" id="ccfsort_thrt" name="ccfsort"><label for="ccfsort_thrt">_O3_</label>\n\
			</fieldset>\n\
		  </div>\n\
		</div>\
		<div id="ccfacclist">\
		</div>\
	';
	snippet = snippet.replace(/_LP_/g, _("Project"));
	snippet = snippet.replace(/_LCCF_/g, _("Common Cause Failures"));
	snippet = snippet.replace(/_N1_/g, _("This space will show all vulnerabilities domains for the components in this project."));
	snippet = snippet.replace(/_N2_/g, _("Since there are no vulnerabilities that occur in two or mode nodes, there is nothing to see here yet."));
	snippet = snippet.replace(/_N3_/g, _("Add some nodes to the diagrams first."));
	snippet = snippet.replace(/_L1_/g, _("Fold:"));
	snippet = snippet.replace(/_EA_/g, _("Expand all"));
	snippet = snippet.replace(/_CA_/g, _("Collapse all"));
	snippet = snippet.replace(/_L2_/g, _("Sort:"));
	snippet = snippet.replace(/_O1_/g, _("Alphabetically"));
	snippet = snippet.replace(/_O2_/g, _("by Type"));
	snippet = snippet.replace(/_O3_/g, _("by Vulnerability level"));
	snippet = snippet.replace(/_PJ_/g, Project.cid);
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	$('#ccfs_body').append(snippet);
	$('#someccf').headroom({
		scroller: document.querySelector('#ccfs_body'),
		tolerance : {
			up : 20,
			down : 20
		}
	});

	$('#expandallccf').button({icon: 'ui-icon-plus'});
	$('#collapseallccf').button({icon: 'ui-icon-minus'});
	$('#someccf input[type=radio]').checkboxradio({icon: false});
	$('#someccf fieldset').controlgroup();

	// create list of all vulnerabilities
	// for each vulnerability, list the nested list / vulnerability-domain-tree
	// allow manipulation of nested list
	var it = new NodeClusterIterator({project:Project.cid, isroot:true});
	if (!it.notlast()) {
		$('#noccf').css('display', 'block');
		$('#someccf').css('display', 'none');
		return;
	}

	sortClustersToCurrentOrder(it);
	$('#someccf fieldset').controlgroup('refresh');

	$('#noccf').css('display', 'none');
	$('#someccf').css('display', 'block');
	$('#expandallccf').on('click',  function(){
		$('#ccfs_body').scrollTop(0);
		expandAllCCF();
	});
	$('#collapseallccf').on('click',  function(){
		$('#ccfs_body').scrollTop(0);
		collapseAllCCF();
	});
	var create_ccf_sortfunc = function(opt) {
		return function() {
			CCFSortOpt = opt;
			$('#ccfs_body').empty();
			AddAllClusters();
		};
	};

	$('[for=ccfsort_alph]').on('click', create_ccf_sortfunc('alph'));
	$('[for=ccfsort_type]').on('click', create_ccf_sortfunc('type'));
	$('[for=ccfsort_thrt]').on('click', create_ccf_sortfunc('thrt'));

	for (it.first(); it.notlast(); it.next()) {
		var nc = it.getNodeCluster();
		addClusterElements(nc);
		repaintCluster(nc.id);
	}
	$('#ccfs_body').append('<br><br>');

	// Show the details of the first open accordion
	for (it.first(); it.notlast(); it.next()) {
		nc = it.getNodeCluster();
		if (nc.accordionopened && CurrentCluster==null) {
			// Delay painting until the accordions are done
			window.setTimeout(function() {
				repaintClusterDetails(nc);
			}, 1000);
			break;
		}
	}

	$('.ccfaccordionbody').on('click', function(event) {
		var nc = nid2id(this.id);
		if (nc!=CurrentCluster) {
			repaintClusterDetails(NodeCluster.get(nc));
		}
		event.stopPropagation();
	});
}

function sortClustersToCurrentOrder(it) {
	switch (CCFSortOpt) {
	case 'alph':
		$('#ccfsort_alph').prop('checked',true);
		it.sortByName();
		break;
	case 'type':
		$('#ccfsort_type').prop('checked',true);
		it.sortByType();
		break;
	case 'thrt':
		$('#ccfsort_thrt').prop('checked',true);
		it.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","AddAllClusters");
	}
}

function addClusterElements(nc) {
	var snippet = '\n\
	  <div id="ccfaccordion_ID_" class="ccfaccordion">\n\
		<h3><a href="#">_LCCF_ "_TI_" (_TY_) <span id="ccfamark_ID_"></span></a></h3>\n\
		<div id="ccfaccordionbody_ID_" class="ccfaccordionbody">\n\
		</div>\n\
	  </div>\n\
	';
	snippet = snippet.replace(/_LCCF_/g, _("Common Cause failures for"));
	snippet = snippet.replace(/_ID_/g, nc.id);
	snippet = snippet.replace(/_TI_/g, H(nc.title));
	snippet = snippet.replace(/_TY_/g, Rules.nodetypes[nc.type]);
	$('#ccfacclist').append(snippet);

	var acc = $('#ccfaccordion'+nc.id);
	acc.accordion({
		beforeActivate: function() {
			if (!acc.accordion('option','animate')) {
				// Activated programatically. Assume we know what we're doing.
				return true;
			}
			if (!nc.accordionopened) {
				// Open this accordion (which is closed), and paint its details
				return true;
			} else if (CurrentCluster && CurrentCluster!=nc.id) {
				// Reactivate this cluster (which was already open)
				repaintClusterDetails(nc);
				return false;	// prevent the default action = to close the accordion
			} else {
				// Close this accordion, and reactivate the first open accordion
				var it = new NodeClusterIterator({project:Project.cid, isroot:true, isstub: false});
				sortClustersToCurrentOrder(it);
				$('#ccfs_details').empty();
				CurrentCluster = null;
				for (it.first(); it.notlast(); it.next()) {
					var cl = it.getNodeCluster();
					if (cl.id==nc.id)  continue;
					if (cl.accordionopened) {
						repaintClusterDetails(cl);
						break;
					}
				}
				return true; // Close the accordion
			}
		},
		activate: function(event,ui) {
			nc.setaccordionopened(ui.oldPanel.length===0);
			if (nc.accordionopened && acc.accordion('option','animate')) {
				// If animation is off, then opening/closing is done programmatically.
				// Therefore do not paint the details.
				repaintClusterDetails(nc);
			}
		},
		heightStyle: 'content',
		collapsible: true,
		animate: 300,
		active: (nc.accordionopened ? 0 : false)
	});
	if (nc.childclusters.length + nc.childnodes.length < 2) {
		// Just an empty placeholder for a node cluster that is too small
		$('#ccfaccordion'+nc.id).css('display', 'none');
	} else {
		$('#ccfaccordion'+nc.id).css('display', 'block');
	}
}

function expandAllCCF() {
	var it = new NodeClusterIterator({project: Project.cid});

	for (it.first(); it.notlast(); it.next()) {
		var cl = it.getNodeCluster();
		if (cl.isroot()) {
			var el = $('#ccfaccordion'+cl.id);
			el.accordion('option','animate',false);
			el.accordion('option','active',0);
			el.accordion('option','animate',true);
		} else {
			if (!cl.accordionopened) {
				var ul = $('#tlist'+cl.id);
				ul.find('.ui-icon').first().removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');
				cl.setaccordionopened(true);
				ul.children().slice(1).show();
			}
		}
	}

	// Show the details of the first cluster
	it = new NodeClusterIterator({project: Project.cid, isroot:true, isstub: false});
	sortClustersToCurrentOrder(it);
	it.first();
	repaintClusterDetails(it.getNodeCluster());
}

function collapseAllCCF() {
	$('#ccfs_details').empty();
	$('.ccfaccordion').removeClass('ccfhighlight');
	CurrentCluster = null;
	var it = new NodeClusterIterator({project: Project.cid});
	for (it.first(); it.notlast(); it.next()) {
		var cl = it.getNodeCluster();
		if (cl.isroot()) {
			var el = $('#ccfaccordion'+cl.id);
			el.accordion('option','animate',false);
			el.accordion('option','active',false);
			el.accordion('option','animate',true);
		} else {
			if (cl.accordionopened) {
				var ul = $('#tlist'+cl.id);
				ul.find('.ui-icon').first().removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
				cl.setaccordionopened(false);
				ul.children().slice(1).hide();
			}
		}
	}
}

function repaintCluster(elem) {
	var nc = NodeCluster.get(elem);
	if (!nc)  return;
	if (!nc.isroot()) {
		bugreport("Repainting a non-root cluster","repaintCluster");
	}

	var snippet = '<div>\
		<div class="threat">\
		<div class="th_name th_col thr_header">_LN_</div>\
		<div class="th_freq th_col thr_header">_LF_</div>\
		<div class="th_impact th_col thr_header">_LI_</div>\
		<div class="th_total th_col thr_header">_LT_</div>\
		<div class="th_remark th_col thr_header">_LR_</div>\
		</div>\
		<div id="ccftable_ID_" class="threats">\
		</div></div>\n';
	snippet = snippet.replace(/_LN_/g, _("Name"));
	snippet = snippet.replace(/_LF_/g, _("Freq."));
	snippet = snippet.replace(/_LI_/g, _("Impact"));
	snippet = snippet.replace(/_LT_/g, _("Total"));
	snippet = snippet.replace(/_LR_/g, _("Remark"));
	snippet = snippet.replace(/_ID_/g, nc.id);
	$('#ccfaccordionbody'+nc.id).html( snippet );
	computeSpacesMakeup(nc,'#ccftable'+nc.id,'ccf'+nc.id);
	nc.calculatemagnitude();
	nc.setallmarkeroid('#ccfamark');

	if (nc.childclusters.length + nc.childnodes.length < 2) {
		// Just an empty/invisible placeholder for a node cluster that is too small
		$('#ccfaccordion'+nc.id).css('display', 'none');
		// Check whether there are any cluster remaining visible
		var it = new NodeClusterIterator({project:Project.cid, isroot:true});
		for (it.first(); it.notlast(); it.next()) {
			nc = it.getNodeCluster();
			if (nc.childclusters.length + nc.childnodes.length >= 2) {
				return;
			}
		}
		// None were visible
		$('#noccf').css('display', 'block');
		$('#someccf').css('display', 'none');
		$('#ccfs_details').empty().scrollTop(0);
		return;
	}

	$('#ccfaccordion'+nc.id).css('display', 'block');
	nc.setallmarkeroid('#ccfamark');
}

function repaintClusterDetails(nc) {
	CurrentCluster = nc.id;
	$('#ccfs_details').empty().scrollTop(0);
	$('#ccfs_details').append( listFromCluster(nc) );
	$('.ccfaccordion').removeClass('ccfhighlight');
	$('#ccfaccordion'+nc.id).addClass('ccfhighlight');

	$('#ccfs_details .tlistitem').draggable({
		containment: '#ccfs_details',
		revert: 'invalid',
		revertDuration: 300, // Default is 500 ms
		axis: 'y',
		scrollSensitivity: 40,
		scrollSpeed: 10,
		start: function(/*event,ui*/) {
			$('.li_selected').addClass('ui-draggable-dragging');
			$(this).addClass('li_selected');
		},
		stop: function(/*event,ui*/) {
			$('.li_selected').removeClass('ui-draggable-dragging li_selected');
		}
	});
	$('.tlistitem,.tlistroot').droppable({
		accept: allowDrop,
		classes: {
			'ui-droppable-active': 'tlisthigh',
			'ui-droppable-hover': 'tlisthover'
		},
		addClasses: false,
		drop: nodeClusterReorder
	});
	$('.litext').editInPlace({
		bg_over: 'rgb(255,204,102)',
		text_size: 40,
		callback: function(domid, enteredText) {
			var nc = NodeCluster.get( nid2id(domid) );
			nc.settitle(enteredText);
			$('#dthE_ccf'+nc.root()+'name'+nc.thrass).html(H(nc.title));
			transactionCompleted("Rename cluster");
			return H(nc.title);
		}
	});
}

function listFromCluster(nc) {
	var str;
	// Cluster heading
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
			<span id="cltrgl_ID_" class="ui-icon ui-icon-triangle-1-_LT_ clustericon"></span>\
			<span id="litext_ID_" class="litext">_TI_</span>\
			<span id="ccfamark_ID_"></span></a>\n\
			</li>\n\
		';
	}
	str = str.replace(/_ID_/g, nc.id);
	str = str.replace(/_LT_/g, (nc.accordionopened ? 's' : 'e'));
	str = str.replace(/_TI_/g, H(nc.title));
	str = str.replace(/_TY_/g, Rules.nodetypes[nc.type]);

	// Insert all child clusters, recursively
	for (var i=0; i<nc.childclusters.length; i++) {
		var cc = NodeCluster.get(nc.childclusters[i]);
		str += '<li';
		if (!nc.isroot() && !nc.accordionopened) {
			str += ' style="display: none;"';
		}
		str += '>\n';
		str += listFromCluster(cc);
		str += '</li>\n';
	}
	if (nc.isroot()) {
		str += '<li>&nbsp;</li>\n';
	}

	// Sort childnodes by label
	var node = [];
	// Return array of nodes from 'fromarr' with color 'col', sorted by name
	var sortednodeswithcolor = function(col,fromarr) {
		var arr = [];
		for (i=0; i<fromarr.length; i++) {
			var rn = Node.get(nc.childnodes[i]);
			if (rn==null) {
				bugreport("Child node does not exist","listFromCluster:sortednodeswithcolor");
			}
			if (rn.color==col) {
				arr.push(rn.id);
			}
		}
		// Array temp now holds all node of color 'col. Now sort those by name
		arr.sort( function(a,b) {
			var na = Node.get(a);
			var nb = Node.get(b);
			var ta = na.title+na.suffix;
			var tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
		return arr;
	};
	node = node.concat(sortednodeswithcolor('red',nc.childnodes));
	node = node.concat(sortednodeswithcolor('orange',nc.childnodes));
	node = node.concat(sortednodeswithcolor('yellow',nc.childnodes));
	node = node.concat(sortednodeswithcolor('green',nc.childnodes));
	node = node.concat(sortednodeswithcolor('blue',nc.childnodes));
	node = node.concat(sortednodeswithcolor('pink',nc.childnodes));
	node = node.concat(sortednodeswithcolor('purple',nc.childnodes));
	node = node.concat(sortednodeswithcolor('grey',nc.childnodes));
	node = node.concat(sortednodeswithcolor('none',nc.childnodes));
	if (node.length!=nc.childnodes.length) {
		bugreport("Invalidly labeled children","listFromCluster");
	}

	// Finally insert all child nodes
	for (i=0; i<node.length; i++) {
		var rn = Node.get(node[i]);
		var cm = Component.get(rn.component);
		var sv = "";

		// Single node classes can (will) be present in multiple services.
		if (cm.single) {
			for (var j=0; j<cm.nodes.length; j++) {
				var n = Node.get(cm.nodes[j]);
				if (sv!='') sv += '; ';
				sv += Service.get(n.service).title;
			}
		} else {
			sv = Service.get(rn.service).title;
		}

		str += '<li id="linode_NI___CI_" title="_SV_" class="tlistitem childnode" style="display: _DI_;">\n';
		str = str.replace(/_NI_/g, rn.id);
		str = str.replace(/_CI_/g, nc.id);
		str = str.replace(/_SV_/g, H(sv));

		str = str.replace(/_DI_/g, (nc.isroot() || nc.accordionopened ? 'list-item' : 'none'));
		str += rn.htmltitle();

		if (Preferences.label) {
			var p = Project.get(Project.cid);
			// Single node classes can have multiple labels
			var labels = [];
			if (cm.single) {
				for (j=0; j<cm.nodes.length; j++) {
					n = Node.get(cm.nodes[j]);
					if (n.color!='none' && labels.indexOf(n.color)==-1) {
						labels.push(n.color);
					}
				}
			} else {
				if (rn.color!='none') labels = [rn.color];
			}
			if (labels.length==1 ) {
				str += '<div class="ccflabelgroup"><div class="smallblock B'+rn.color+'"></div><span class="labelind">'+H(p.strToLabel(rn.color))+'</span></div>';
			} else if (labels.length>1) {
				str += '<div class="ccflabelgroup">';
				for (j=0; j<labels.length; j++) {
					str += '<div class="smallblock B'+labels[j]+'" title="' + H(p.strToLabel(labels[j])) + '"></div>';
				}
				str += '</div>';
			}
		}

		str += '</li>\n';
	}

	str += '</ul>\n';
	return str;
}

/* Each line/row is indented by a number of spaces equal to its depth.
 * The spaces are of three kinds:
 *  - blank, empty
 *  - vertic, a vertical line from top to bottom
 *  - corner, from top to center to the right
 * Both kinds can be overlayed, to form a line from top to bottom with a branch to the right.
 *
 * The rule to apply for when to have a vertic and/or corner:
 *  1. The spaces in a row must all be empty, except the rightmost one which must have corner.
 *  2. In addition to rule #1, all spaces above the rightmost one, as long as they exist, must have vertic.
 * This rule is implemented in computeRows().
 *
 * To make this easier, we make two passes.
 * First pass calculated the makeup of the spaces.
 * Second pass uses this to create the actual HTML.
 *
 * For the first pass, SpacesMakeup[row][indentlevel] contains:
 *  0 on blank
 *  1 on vertical only
 *  2 on corner only
 *  3 on both
 * This can be computer using bitwise OR.
 */
var SpacesMakeup;
var Spaces_row;

function computeSpacesMakeup(nc,domid,prefix) {
	if (DEBUG && !nc) {
		bugreport("Node cluster is undefined.", "computeSpacesMakeup");
	}
	if (DEBUG && !nc.isroot()) {
		bugreport("Node cluster is not at root.", "computeSpacesMakeup");
	}
	SpacesMakeup = [];

	Spaces_row = -1; // Gets incremented on each call of computerLine, so will start at zero.
	computeRows(nc);

	Spaces_row = -1;
	appendAllThreats(nc,domid,prefix);
}

/* eslint-disable no-bitwise */
function computeRows(nc) {
	Spaces_row++;
	SpacesMakeup[Spaces_row] = [];
//	if (nc.childnodes.length>1) {
		// With <2 child nodes no vuln assessment will be made, no row painted.
		var d = nc.depth();
		// Rule #1
		for (var i=0; i<d-1; i++) {
			SpacesMakeup[Spaces_row][i] = 0;
		}
		if (d>0) {
			SpacesMakeup[Spaces_row][d-1] |= 2;
		}
		// Rule #2
		for (i=Spaces_row-1; i>=0; i--) {
			if (SpacesMakeup[i][d-1] == undefined) break;
			SpacesMakeup[i][d-1] |= 1;
		}
//	}
	for (i=0; i<nc.childclusters.length; i++) {
		var cc = NodeCluster.get(nc.childclusters[i]);
		computeRows(cc);
	}
}
/* eslint-enable no-bitwise */

function appendAllThreats(nc,domid,prefix) {
	if (DEBUG && nc==null) {
		bugreport("nc is null","appendAllThreats");
	}
	Spaces_row++;
	var th = ThreatAssessment.get(nc.thrass);
	// Only paint threat assessment if at least two child nodes (clusters don't count)
//	if (nc.childnodes.length>1) {
		var spaces = "";
		spaces += '<span class="linechar">';
		for (var i=0; i<nc.depth(); i++) {
			spaces += '<img src="../img/_KIND_.png" class="lineimg">';
			switch (SpacesMakeup[Spaces_row][i]) {
			case 0:
				spaces = spaces.replace(/_KIND_/, 'barB');
				break;
			case 1:
				spaces = spaces.replace(/_KIND_/, 'barV');
				break;
			case 2:
				spaces = spaces.replace(/_KIND_/, 'barC');
				break;
			case 3:
				spaces = spaces.replace(/_KIND_/, 'barCV');
				break;
			default:
				bugreport("Incorrect style for indentation", "appendAllThreats");
			}
		}
		if (nc.depth()>0) {
			spaces += '&nbsp;'; // spacer between corner line and text
		}
		spaces += '</span>';
		th.addtablerow(domid,prefix,false, spaces,'');
//	} else {
//		// If less than two children, then this thrass must not contribute to the cluster total.
//		//
//		// This logic should probably move into rasterNodeCluster?
//		//
//		th.setfreq('-');
//		th.setimpact('-');
//	}
	for (i=0; i<nc.childclusters.length; i++) {
		var cc = NodeCluster.get(nc.childclusters[i]);
		appendAllThreats(cc,domid,prefix);
	}
}

/*
	Drag node onto node, belonging to the same cluster:
	Create a new node cluster, containing the drop node and all selected nodes.
	Set the parent cluster to the containing cluster of the drop node.
	If the drag and drop nodes have the same label, set the title of the new cluster to that label.
	Remove the selected nodes from their clusters (by removing them from the root cluster).
	Add the new cluster to the containing cluster, and repaint.

	Drag node onto node, belonging to a different cluster: invalid.

	Drag node onto cluster:
	Move all selected nodes into the cluster.
	Normalize all clusters.

	Drag a root cluster: invalid.

	Drag cluster onto cluster that is one of its descendants: invalid.

	Drag cluster onto its parent cluster:
	Dissolve the cluster, by moving its child nodes and clusters into
	its parent cluster, and removing the (now empty) cluster.

	Drag cluster onto a cluster, that is neither a descendant nor
	its parent: move the cluster into that other cluster.

	Drag cluster onto a node: invalid.

	Drop onto self (either node or cluster): invalid.
 */
function nodeClusterReorder(event,ui) {
	// See the note at the start of the definition of internalID()
	var dragid = ui.draggable[0].id;
	var dropid = this.id;
	// Only valid drops are to be expected.
	var drag_n, drag; // source node and cluster
	var drop_n, drop; // destination node and cluster
	var drag_cluster, drop_cluster, root_cluster;

	drag = nid2id(dragid);
	drag_n = internalID(dragid);

	drop = nid2id(dropid);
	drop_n = internalID(dropid);

	if (drag!=null) drag_cluster = NodeCluster.get(drag);
	if (drop!=null) drop_cluster = NodeCluster.get(drop);
	if (drop_cluster) root_cluster = NodeCluster.get(drop_cluster.root());

	if (drag_n!=null) {
		// A node is being dragged
		if (drop_n!=null && drag==drop) {
			// Dropped on a node of the same cluster
			var nc = new NodeCluster(drag_cluster.type);
			nc.setproject(drag_cluster.project);
			var dragNode = Node.get(drag_n);
			var dropNode = Node.get(drop_n);
			if (!dragNode || !dropNode) {
				bugreport('drag node or drop node does not exist', 'nodeClusterReorder');
			}
			if (dragNode.color==dropNode.color && dragNode.color!='none') {
				// Both have the same label. Name the new node cluster after this label.
				var p = Project.get(Project.cid);
				nc.settitle( p.strToLabel(dragNode.color) );
			}
			$(this).addClass('li_selected');
			$('.li_selected').each(function(){
				var n = internalID(this.id);
				root_cluster.removechildnode(n);
				nc.addchildnode(n);
			});
			nc.setparent(drag);
			nc.addthrass();
			drag_cluster.addchildcluster( nc.id );
			root_cluster.calculatemagnitude();
			root_cluster.normalize();
			repaintCluster(root_cluster.id);
			repaintClusterDetails(root_cluster);
			transactionCompleted("Create cluster");
		} else if (drop_n!=null && drag!=drop) {
			bugreport("Node dropped on node of a different cluster","nodeClusterReorder");
		} else if (drop_n==null && drag==drop) {
			bugreport("Node dropped on its containing cluster","nodeClusterReorder");
		} else if (drop_n==null && drag!=drop) {
			// Dropped into a different cluster
			$('.li_selected').each(function(){
				var n = internalID(this.id);
				root_cluster.removechildnode(n);
				drop_cluster.addchildnode(n);
			});
			root_cluster.normalize();
			root_cluster.calculatemagnitude();
			repaintCluster(root_cluster.id);
			repaintClusterDetails(root_cluster);
			transactionCompleted("Move node from cluster");
		}
	} else {
		// A cluster is being dragged
		if (DEBUG && drag_cluster.containscluster(drop)) {
			bugreport("Cluster dropped on a descendant","nodeClusterReorder");
		} else if (drop_n!=null) {
			bugreport("Cluster dropped on a node","nodeClusterReorder");
		} else if (drop_n==null && drop==drag_cluster.parentcluster) {
			// Cluster dropped on its parent cluster
			removeCluster(drag_cluster);
			transactionCompleted("Remove cluster");
		} else {
			// Cluster dropped on a different cluster
			moveCluster(drag_cluster,drop_cluster);
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
 *
 * Note: this callback seems to be called for just about any drag operation. As a quick
 * exckusion, return when the current tab is not the CCF tab.
 */
function allowDrop(elem) {
	if (Preferences.tab!=2)  return false;
	if (this==elem[0])  return false;
	// Source and target information
	var drag_n, drag;	// source node and cluster (id)
	var drop_n, drop; // destination node and cluster (id)
	var drag_cluster, drop_cluster; // source and destination clusters (object)

	var id = elem[0].id;
	drag = nid2id(id);
	drag_n = internalID(id);

	id = this.id;
	drop = nid2id(id);
	drop_n = internalID(id);

	drag_cluster = NodeCluster.get(drag);
	drop_cluster = NodeCluster.get(drop);

	if (drag_cluster==null)  return false; // Could have been deleted in drop handler
	if (drop_cluster==null)  return false; // Could have been deleted in drop handler
	if (drag_cluster.root()!=drop_cluster.root())  return false;

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
			return !(drag_cluster.containscluster(drop));
		}
	}
	/* unreachable */
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|		Analysis Tools		|* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


function initTabAnalysis() {
	$("a[href^='#at1']").html(_("Failures and Vulnerabilities"));
	$("a[href^='#at2']").html(_("Assessments by level"));
	$("a[href^='#at3']").html(_("Node counts"));
	$("a[href^='#at4']").html(_("Checklist reports"));
	$("a[href^='#at5']").html(_("Longlist"));

	$('#analysis_body').tabs({
		classes: {
			"ui-tabs": "ui-corner-bottom ui-corner-tl",
			"ui-tabs-nav": "ui-corner-bottom",
			"ui-tabs-tab": "ui-corner-bottom",
			"ui-tabs-panel": "ui-corner-tl"
		}
	});
}

function AddAllAnalysis() {
	paintNodeThreatTables();
	paintVulnsTable();
	paintNodeTypeStats();
	paintChecklistReports();
	paintLonglist();
}

var FailureThreatSortOpt = {node: 'thrt', threat: 'type'};

function paintNodeThreatTables() {
	ComponentExclusions = {};
	ClusterExclusions = {};

	$('#at1').empty();
	var snippet = '\
		<h1 class="printonly underlay">_LTT_</h1>\
		<h2 class="printonly underlay projectname">_LP_ _PN_</h1>\
		<h2 class="printonly underlay projectname">_L1_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LP_/g, _("Project:") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	snippet += '\n\
		<div id="ana_nodevuln" class="displayoptsarea donotprint">\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_LS1_</span><br>\n\
			<fieldset>\n\
				<input type="radio" id="ana_nodesort_alph" name="ana_nodesort"><label for="ana_nodesort_alph">_O1_</label>\n\
				<input type="radio" id="ana_nodesort_type" name="ana_nodesort"><label for="ana_nodesort_type">_O2_</label>\n\
				<input type="radio" id="ana_nodesort_thrt" name="ana_nodesort"><label for="ana_nodesort_thrt">_O3_</label>\n\
			</fieldset>\n\
		  </div>\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_LS2_</span><br>\n\
			<fieldset>\n\
				<input type="radio" id="ana_failsort_alph" name="ana_failsort"><label for="ana_failsort_alph">_O1_</label>\n\
				<input type="radio" id="ana_failsort_type" name="ana_failsort"><label for="ana_failsort_type">_O2_</label>\n\
			</fieldset>\n\
		  </div>\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_LS3_</span><br>\n\
			<input type="button" id="quickwinslink" value="_Q1_">\n\
			<input type="button" id="clearexclusions" value="_Q2_"><br>\n\
		  </div>\n\
		</div>\n\
		<div id="ana_nodethreattable" class="ana_nodeccfblock"></div>\n\
		<div id="ana_ccftable" class="ana_nodeccfblock"></div>\n\
	';
	snippet = snippet.replace(/_L1_/g, _("Single & Common Cause Failures versus Vulnerabilities"));
	snippet = snippet.replace(/_LS1_/g, _("Sort nodes and clusters:"));
	snippet = snippet.replace(/_LS2_/g, _("Sort vulnerabilities:"));
	snippet = snippet.replace(/_LS3_/g, _("Click cells to include/exclude them."));
	snippet = snippet.replace(/_O1_/g, _("Alphabetically"));
	snippet = snippet.replace(/_O2_/g, _("by Type"));
	snippet = snippet.replace(/_O3_/g, _("by Vulnerability level"));
	snippet = snippet.replace(/_Q1_/g, _("show Quick Wins"));
	snippet = snippet.replace(/_Q2_/g, _("clear exclusions"));
	$('#at1').html(snippet);
	$('#ana_nodevuln').headroom({
		scroller: document.querySelector('#at1'),
		tolerance : {
			up : 20,
			down : 20
		}
	});

	$('#ana_nodevuln input[type=button]').button();
	$('#ana_nodevuln input[type=radio]').checkboxradio({icon: false});
	$('#ana_nodesort_'+FailureThreatSortOpt.node).prop('checked',true);
	$('#ana_failsort_'+FailureThreatSortOpt.threat).prop('checked',true);
	$('#ana_nodevuln fieldset').controlgroup();

	var create_ananode_sortfunc = function(opt) {
		return function() {
			FailureThreatSortOpt.node = opt;
			paintSFTable();
			paintCCFTable();
		};
	};
	$('[for=ana_nodesort_alph]').on('click', create_ananode_sortfunc('alph'));
	$('[for=ana_nodesort_type]').on('click', create_ananode_sortfunc('type'));
	$('[for=ana_nodesort_thrt]').on('click', create_ananode_sortfunc('thrt'));

	var create_anafail_sortfunc = function(opt) {
		return function() {
			FailureThreatSortOpt.threat = opt;
			paintSFTable();
			paintCCFTable();
		};
	};
	$('[for=ana_failsort_alph]').on('click', create_anafail_sortfunc('alph'));
	$('[for=ana_failsort_type]').on('click', create_anafail_sortfunc('type'));

	$('#quickwinslink').button().button('option','disabled',false).on('click',  function() {
		var exclCm = computeComponentQuickWins();
		var exclCl = computeClusterQuickWins();
		ComponentExclusions = { };
		ClusterExclusions = { };
		for (var i=0; i<exclCm.length; i++) {
			ComponentExclusions[exclCm[i]] = true;
		}
		for (i=0; i<exclCl.length; i++) {
			ClusterExclusions[exclCl[i]] = true;
		}
		paintSFTable();
		paintCCFTable();
		$('#clearexclusions').button('option','disabled', (exclCm.length==0 && exclCl.length==0));
	});
	$('#clearexclusions').button().button('option','disabled',true).on('click',  function() {
		ComponentExclusions = { };
		ClusterExclusions = { };
		paintSFTable();
		paintCCFTable();
		$('#clearexclusions').button('option','disabled',true);
	});

	paintSFTable();
	paintCCFTable();
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
		if (cm.magnitude=='-' || cm.magnitude=='L' || cm.magnitude=='U') continue;
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
		if (cnt==1) {
			suggestions.push(cm.id+'_'+keepid);
		}
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
		if (cl.magnitude=='-' || cl.magnitude=='L' || cl.magnitude=='U') continue;

		var candidates = cl.allclusters();
		for (var i=0; i<candidates.length; i++) {
			var aarr = {};
			exclusionsAdd(aarr,candidates[i],0);
			if (ClusterMagnitudeWithExclusions(cl,aarr) != cl.magnitude){
				suggestions.push(candidates[i]+'_0');
			}
		}
	}

	return suggestions;
}

function paintSFTable() {
	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	var cit = new ComponentIterator({project: Project.cid});

	switch (FailureThreatSortOpt.node) {
	case 'alph':
		cit.sortByName();
		break;
	case 'type':
		cit.sortByType();
		break;
	case 'thrt':
		cit.sortByLevel();
		break;
	default:
		bugreport("Unknown component sort option","paintSFTable");
	}

	switch (FailureThreatSortOpt.threat) {
	case 'alph':
		tit.sortByName();
		break;
	case 'type':
		tit.sortByType();
		break;
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
		$('#ana_nodethreattable').html("<p style=\"margin-left:3em; width:50em;\">"
			+ _("This space will show an overview of all diagram nodes and their vulnerabilities. ")
			+ _("Since all service diagrams are empty, there is nothing to see here yet. ")
			+ _("Add some nodes to the diagrams first.")
		);
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
		  <td class="nodetitlecell largetitlecell">_SF_</td>\n\
	';
	// 20em = width of first column
	// 1.7em = width of threat columns
	// numthreats = number of threat columns
	snippet = snippet.replace(/_SF_/, _("Single failures"));
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*(numthreats+1));
	snippet = snippet.replace(/_NT_/, numthreats+1);
	for (tit.first(); tit.notlast(); tit.next()) {
		var nc = tit.getNodeCluster();
		snippet += '<td class="headercell">'+H(nc.title)+'</td>\n';
	}
	snippet += '<td class="headercell"><b>_OV_</b></td>\n\
		 </tr>\n\
		</thead>\n\
		<tbody>\n\
	';
	snippet = snippet.replace(/_OV_/, _("Overall"));
	// Do each of the table rows
	for (cit.first(); cit.notlast(); cit.next()) {
		var cm = cit.getcomponent();
		snippet += '<tr><td class="nodetitlecell">';
		snippet += H(cm.title);
		snippet += '&nbsp;</td>';
		for (tit.first(); tit.notlast(); tit.next()) {
			nc = tit.getNodeCluster();
			// Find the threat assessment for this node
			var ta = {};
			for (var i=0; i<cm.thrass.length; i++) {
				ta = ThreatAssessment.get(cm.thrass[i]);
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
				if (!exclusionsContains(ComponentExclusions,cm.id,ta.id)) {
					Nodesum[cm.id] = ThreatAssessment.sum(Nodesum[cm.id], ta.total);
				}
			} else {
				snippet += '<td class="blankcell">&thinsp;</td>';
			}
		}
		snippet += '<td class="M_CL_" title="_TI_">_TO_</td><td>_ZZ_</td></tr>\n';
		snippet = snippet.replace(/_CL_/g, ThreatAssessment.valueindex[Nodesum[cm.id]]);
		snippet = snippet.replace(/_TO_/g, Nodesum[cm.id]);
		snippet = snippet.replace(/_TI_/g, H(cm.title)+" / overall vulnerability level");
		if (cm.magnitude==Nodesum[cm.id]) {
			snippet = snippet.replace(/_ZZ_/g, '');
		} else {
			snippet = snippet.replace(/_ZZ_/g, '<span class="reduced">' + _("reduced") + '</span>');
		}
	}
	// Do the ending/closing
	snippet += '\n\
		</tbody>\n\
		</table><p></p>\n\
	';
	$('#ana_nodethreattable').html(snippet);

	$('.nodecell').on('click',  function(evt){
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
	case 'alph':
		ncit.sortByName();
		break;
	case 'type':
		ncit.sortByType();
		break;
	case 'thrt':
		ncit.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","paintCCFTable");
	}

	switch (FailureThreatSortOpt.threat) {
		case 'alph':
			tit.sortByName();
			break;
		case 'type':
			tit.sortByType();
			break;
		default:
			bugreport("Unknown threat sort option","paintCCFTable");
	}

	$('#ana_ccftable').empty();
	var numthreats = 0;
	for (tit.first(); tit.notlast(); tit.next()) numthreats++;
	// Do not paint an empty table
	ncit.first();
	if (!ncit.notlast() || numthreats==0)  return;

	// Do the header
	var snippet = '\n\
	<table style="width:_TW_em">\n\
	<colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
	<colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
	<thead>\n\
	<tr>\n\
	<td class="nodetitlecell largetitlecell">_CCF_</td>\n\
	';
	snippet = snippet.replace(/_CCF_/, _("Common cause failures"));
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
	snippet += '<td class="headercell"><b>_OV_</b></td>\n\
		 </tr>\n\
		</thead>\n\
		<tbody>\n\
	';
	snippet = snippet.replace(/_OV_/, _("Overall"));

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

	$('.clustercell').on('click',  function(evt){
		var cid = parseInt($(evt.currentTarget).attr('cluster'),10);
		if (exclusionsContains(ClusterExclusions,cid,0)) {
			exclusionsRemove(ClusterExclusions,cid,0);
		} else {
			exclusionsAdd(ClusterExclusions,cid,0);
		}
		paintCCFTable();
	});
}

function addCCFTableRow(col,numthreats,ta,cl,indent) {
	var suffix = "";
	if (indent>0) {
		suffix = " :" + new Array(indent+1).join("&nbsp;&nbsp;");
	}
	var snippet = '<tr><td class="nodetitlecell">'+H(cl.title)+suffix+'&nbsp;</td>\n';
	for (var i=0; i<numthreats; i++) {
		if (i==col &&cl.childnodes.length>1) {
			snippet += '<td class="clustercell _EX_ M_CL_" cluster="_CI_" title="_TI_">_TO_</td>';
			snippet = snippet.replace(/_CL_/g, ThreatAssessment.valueindex[ta.total]);
			snippet = snippet.replace(/_TO_/g, ta.total);
			snippet = snippet.replace(/_TI_/g, "CCF for "+H(cl.title)+" ("+Rules.nodetypes[cl.type]+")");
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
		if (cl.magnitude==clustertotal) {
			snippet = snippet.replace(/_ZZ_/g, '');
		} else {
			snippet = snippet.replace(/_ZZ_/g, '<span class="reduced">' + _("reduced") + '</span>');
		}
	}
	for (i=0; i<cl.childclusters.length; i++) {
		var ccl = NodeCluster.get(cl.childclusters[i]);
		ta = ThreatAssessment.get(ccl.thrass);
		snippet += addCCFTableRow(col,numthreats,ta,ccl,indent+1);
	}

	return snippet;
}

function ClusterMagnitudeWithExclusions(cl,list) {
	if (cl.thrass==null)  return '-';
	var ta = ThreatAssessment.get(cl.thrass);
	var mag = exclusionsContains(list,cl.id,0) ? "U" : ta.total;
	for (var i=0; i<cl.childclusters.length; i++) {
		var cc = NodeCluster.get(cl.childclusters[i]);
		mag = ThreatAssessment.sum(mag,ClusterMagnitudeWithExclusions(cc,list));
	}
	return mag;
}

function paintVulnsTable() {
	var freq_snippet = paintVulnsTableType(1);
	var impact_snippet;
	var total_snippet;
	var snippet = '\
		<h1 class="printonly underlay">_LTT_</h1>\
		<h2 class="printonly underlay projectname">_LP_ _PN_</h2>\
		<h2 class="printonly underlay projectname">_LD_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LP_/g, _("Project:") );
	snippet = snippet.replace(/_LD_/g, _("Vulnerability assessment details") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	$('#at2').html(snippet);

	// If the table would be empty, then don't paint row and column headers
	// but show a message instead
	if (freq_snippet=="") {
		snippet = '<p style="margin-left:3em; margin-top:4em; width:50em;">'
			+ _("This space will show an overview of all assessments. ")
			+ _("Since all service diagrams are empty, there is nothing to see here yet. ")
			+ _("Add some nodes to the diagrams first.");
		$('#at2').append(snippet);
		return;
	}

	impact_snippet = paintVulnsTableType(2);
	total_snippet = paintVulnsTableType(0);

	snippet = '\
		<div id="svulns_tabs">\
			<ul>\
				<li><a href="#freq_acc">_LF_</a></li>\
				<li><a href="#impact_acc">_LI_</a></li>\
				<li><a href="#total_acc">_LO_</a></li>\
			</ul>\
			<div id="freq_acc"></div>\
			<div id="impact_acc"></div>\
			<div id="total_acc"></div>\
		</div>\
  	';
	snippet = snippet.replace(/_LF_/g, _("Frequencies"));
	snippet = snippet.replace(/_LI_/g, _("Impacts"));
	snippet = snippet.replace(/_LO_/g, _("Overall levels"));
	$('#at2').append(snippet);

	$('#freq_acc').append(freq_snippet);
	$('#impact_acc').append(impact_snippet);
	$('#total_acc').append(total_snippet);
	$('#svulns_tabs').tabs({
		event: 'mouseenter',
		heightStyle: 'content'
	});
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

	// Sum the threatassessment into the arrays
	function addUp(ta) {
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

	// Precompute all numbers
	// Iterate over all components
	var cit = new ComponentIterator({project: Project.cid});
	for (cit.first(); cit.notlast(); cit.next()) {
		var cm = cit.getcomponent();
		for (var i=0; i<cm.thrass.length; i++) {
			addUp(ThreatAssessment.get(cm.thrass[i]));
		}
	}
	// Tterate over all cluster assessments
	var tit = new NodeClusterIterator({project: Project.cid, isempty: false});
	for (tit.first(); tit.notlast(); tit.next()) {
		var nc = tit.getNodeCluster();
		addUp(ThreatAssessment.get(nc.thrass));
	}

	var grandtotal = v_U['__TOTAL__']+v_L['__TOTAL__']+v_M['__TOTAL__']+v_H['__TOTAL__']+
		v_V['__TOTAL__']+v_X['__TOTAL__']+v_A['__TOTAL__']+v_N['__TOTAL__'];
	if (grandtotal==0) {
		return "";
	}

	// Do the header
	var snippet = '\n\
	<table class="SFvulnstable" style="width:57em">\n\
	<colgroup><col span="1" style="width:30em"></colgroup>\n\
	<colgroup><col span="9" style="width:3em"></colgroup>\n\
	<thead>\n\
	<tr>\n\
	<td class="nodetitlecell largetitlecell">_SV_ _TT_</td>\n\
	<td class="headercell">U: _LVU_</td>\n\
	<td class="headercell">L: _LVL_</td>\n\
	<td class="headercell">M: _LVM_</td>\n\
	<td class="headercell">H: _LVH_</td>\n\
	<td class="headercell">V: _LVV_</td>\n\
	<td class="headercell">X: _LVX_</td>\n\
	<td class="headercell">A: _LVA_</td>\n\
	<td class="headercell">-: _LVN_</td>\n\
	<td class="headercell"><b>_LT_</b></td>\n\
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

	snippet = snippet.replace(/_LJ_/g, _("Jump to:"));
	snippet = snippet.replace(/_LF_/g, _("Frequencies"));
	snippet = snippet.replace(/_LI_/g, _("Impacts"));
	snippet = snippet.replace(/_LO_/g, _("Overall levels"));
	snippet = snippet.replace(/_SV_/g, _("Assessments for"));
	snippet = snippet.replace(/_LVU_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['U']] );
	snippet = snippet.replace(/_LVL_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['L']] );
	snippet = snippet.replace(/_LVM_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['M']] );
	snippet = snippet.replace(/_LVH_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['H']] );
	snippet = snippet.replace(/_LVV_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['V']] );
	snippet = snippet.replace(/_LVX_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['X']] );
	snippet = snippet.replace(/_LVA_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['A']] );
	snippet = snippet.replace(/_LVN_/g, ThreatAssessment.descr[ThreatAssessment.valueindex['-']] );
	snippet = snippet.replace(/_LT_/g, _("Total") );
	snippet = snippet.replace(/_TT_/g, (tabletype==0 ? _("levels") : (tabletype==1 ? _("frequencies") : _("impacts")) ));
	// Do each of the table rows
	tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	tit.sortByType();
//	var col = 0;
	for (tit.first(); tit.notlast(); tit.next()) {
		var cl = tit.getNodeCluster();
		var ta = ThreatAssessment.get(cl.thrass);
		var t = ta.title + ' (' + Rules.nodetypes[ta.type] + ')';

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

	var max = Math.max(
		v_U['__TOTAL__'],
		v_L['__TOTAL__'],
		v_M['__TOTAL__'],
		v_H['__TOTAL__'],
		v_V['__TOTAL__'],
		v_X['__TOTAL__'],
		v_A['__TOTAL__']
	);

	// Do the ending/closing
	snippet += '\n\
	<tr class="thinrow">\n\
	  <td></td>\n\
	  <td><div class="M2" style="height: _2_px"></div></td>\n\
	  <td><div class="M3" style="height: _3_px"></div></td>\n\
	  <td><div class="M4" style="height: _4_px"></div></td>\n\
	  <td><div class="M5" style="height: _5_px"></div></td>\n\
	  <td><div class="M6" style="height: _6_px"></div></td>\n\
	  <td><div class="M7" style="height: _7_px"></div></td>\n\
	  <td><div class="M1" style="height: _1_px"></div></td>\n\
	  <td><div class="M0" style="height: 4px; border:1px solid grey;"></div></td>\n\
	</tr>\n\
	</tbody>\n\
	</table>\n\
	';
	const MAXCOLH = 30;
	snippet = snippet.replace(/_2_/, 5 + MAXCOLH*v_U['__TOTAL__']/max);
	snippet = snippet.replace(/_3_/, 5 + MAXCOLH*v_L['__TOTAL__']/max);
	snippet = snippet.replace(/_4_/, 5 + MAXCOLH*v_M['__TOTAL__']/max);
	snippet = snippet.replace(/_5_/, 5 + MAXCOLH*v_H['__TOTAL__']/max);
	snippet = snippet.replace(/_6_/, 5 + MAXCOLH*v_V['__TOTAL__']/max);
	snippet = snippet.replace(/_7_/, 5 + MAXCOLH*v_X['__TOTAL__']/max);
	snippet = snippet.replace(/_1_/, 5 + MAXCOLH*v_A['__TOTAL__']/max);

	return snippet;
}


function paintNodeTypeStats() {
	var tStats = {};
	var tTot = 0;
	var numservice = 0;
	var sit = new ServiceIterator(Project.cid);
	sit.sortByName();

	$('#at3').empty();

	var snippet = '\
		<h1 class="printonly underlay">_LTT_</h1>\
		<h2 class="printonly underlay projectname">_LP_ _PN_</h2>\
		<h2 class="printonly underlay projectname">_LD_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LP_/g, _("Project:") );
	snippet = snippet.replace(/_LD_/g, _("Node types counted by service") );
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
		<thead><th class="statstype">_LT_</th><th class="statsnum">_LN_</th></thead>\n\
		<tbody>\n\
		';
		snippet = snippet.replace(/_LT_/g, _("Type") );
		snippet = snippet.replace(/_LN_/g, _("Num") );
		snippet = snippet.replace(/_SI_/g, s.id);
		snippet = snippet.replace(/_SN_/g, H(s.title));
		for (nit.first(); nit.notlast(); nit.next()) {
			var rn = nit.getnode();
			var cm = Component.get(rn.component);
			sStats[rn.type]++;
			if (rn.type!='tNOT') sTot++;
			// Count 'single' node classes only once
			if (rn.component==null || !cm.single || cm.nodes[0]==rn.id) {
				tStats[rn.type]++;
				if (rn.type!='tNOT') tTot++;
			}
		}
		for (typ in Rules.nodetypes) {
			if (typ=='tNOT') continue;
			snippet += '<tr><td class="statstype">'+Rules.nodetypes[typ]+'</td><td class="statsnum">'+sStats[typ]+'</td></tr>\n';
		}
		snippet += '<tr><td class="statstype">_LT_</td><td class="statsnum">'+sTot+'</td></tr>\n';
		snippet += '<tr><td class="statstype">('+Rules.nodetypes['tNOT']+'</td><td class="statsnum">'+sStats['tNOT']+')</td></tr>\n';
		snippet += '\
		</tbody></table></div>\n\
		</td>\n\
		';
		snippet = snippet.replace(/_LT_/g, _("Total") );
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
	<b>_LP_</b><br>\n\
	<table class="statstable">\n\
	<thead><th class="statstype">_LT_</th><th class="statsnum">_LN_</th></thead>\n\
	<tbody>\n\
	';
	snippet = snippet.replace(/_LP_/g, _("Entire project:") );
	snippet = snippet.replace(/_LT_/g, _("Type") );
	snippet = snippet.replace(/_LN_/g, _("Num") );
	for (typ in Rules.nodetypes) {
		if (typ=='tNOT') continue;
		snippet += '<tr><td class="statstype">'+Rules.nodetypes[typ]+'</td><td class="statsnum">'+tStats[typ]+'</td></tr>';
	}
	snippet += '\n\
	<tr><td class="statstype">_LT_</td><td class="statsnum">'+tTot+'</td></tr>\n\
	<tr><td class="statstype">('+Rules.nodetypes['tNOT']+'</td><td class="statsnum">'+tStats['tNOT']+')</td></tr>\n\
	</tbody></table></div>\n\
	</td>\n\
	';
	snippet = snippet.replace(/_LT_/g, _("Total") );
	// Finishing
	snippet += '\n\
	</tr></table>\n\
	';
	$('#at3').append(snippet);
}

function paintChecklistReports() {
	$('#at4').empty();


	var snippet = '\
		<h1 class="printonly underlay">_LTT_</h1>\
		<h2 class="printonly underlay projectname">_LP_ _PN_</h2>\
		<h2 class="printonly underlay projectname">_LD_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LP_/g, _("Project:") );
	snippet = snippet.replace(/_LD_/g, _("Checklist usage") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	snippet += '<h3>' + _("Removed vulnerabilities") + '</h3>\n';
	snippet += showremovedvulns();
	snippet += '<h3>' + _("Custom vulnerabilities") + '</h3>\n';
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
				// we have a match
				if (th.type==ta.type && th.title==ta.title) break;
			}
			if (i<cm.thrass.length) continue;
			// We found a checklist threat that was not used on this component
			if (VulnIDs.indexOf(th.id)==-1) VulnIDs.push(th.id);
			if (CompIDs.indexOf(cm.id)==-1) CompIDs.push(cm.id);
			if (CompVulns[cm.id]==undefined) CompVulns[cm.id] = [];
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

	if (num==0) {
		snippet += _("No checklist vulnerabilities have been discarded on components of this project.");
	} else {
		snippet += '<br>'+
			_("%% checklist %% (for %% unique %%) discarded on %% %% of this project.",
			num,
			plural(_("vulnerability"), _("vulnerabilities"), num),
			VulnIDs.length,
			plural(_("vulnerability"), _("vulnerabilities"), VulnIDs.length),
			CompIDs.length,
			plural(_("component"), _("components"), CompIDs.length)
		);
	}
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
				// we have a match
				if (th.type==ta.type && th.title==ta.title) break;
			}
			if (tit.notlast()) continue;
			// We found a threat assessment that does not occur in the checklists
			if (VulnTitles.indexOf(ta.title)==-1) VulnTitles.push(ta.title);
			if (CompIDs.indexOf(cm.id)==-1) CompIDs.push(cm.id);
			if (CompVulns[cm.id]==undefined) CompVulns[cm.id] = [];
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
				snippet += '<td class="blankcell">+</td>';
			}
		}
		snippet += '</tr>\n';
	}

	// Do the ending/closing
	snippet += '\n\
	</tbody>\n\
	</table>\n\
	';

	if (num==0) {
		snippet += _("No custom vulnerabilities have been added to any of the components in this project.");
	} else {
		snippet += '<br>'+
			_("%% custom %% (for %% unique %%) added to %% %% of this project.",
				num,
				plural(_("vulnerability"), _("vulnerabilities"), num),
				VulnTitles.length,
				plural(_("vulnerability"), _("vulnerabilities"), VulnTitles.length),
				CompIDs.length,
				plural(_("component"), _("components"), CompIDs.length)
			);
	}
	snippet += '<br><br>\n';

	return snippet;
}

// Initial cut-off for longlist
var MinValue = 'H';

function paintLonglist() {
	$('#at5').empty();


	var snippet = '\
		<h1 class="printonly underlay">_LTT_</h1>\
		<h2 class="printonly underlay projectname">_LP_ _PN_</h2>\
		<h2 class="printonly underlay projectname">_LD_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LP_/g, _("Project:") );
	snippet = snippet.replace(/_LD_/g, _("Risk longlist") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	snippet += '\n\
		<div id="lloptions" class="displayoptsarea donotprint">\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_L1_</span><br>\n\
			<input type="checkbox" id="incX" checked><label for="incX">_LU_</label><br>\n\
			<input type="checkbox" id="incA" checked><label for="incA">_LA_</label>\n\
		  </div>\n\
		  <div class="displayopt">\n\
			<span class="displayoptlabel">_L2_</span><br>\n\
			<select id="minV"></select>\n\
		  </div>\n\
		</div>\n\
		<div id="longlist"></div>\
	';
	snippet = snippet.replace(/_L1_/g, _("Include:") );
	snippet = snippet.replace(/_LU_/g, _("Unknown") );
	snippet = snippet.replace(/_LA_/g, _("Ambiguous") );
	snippet = snippet.replace(/_L2_/g, _("Minimum value:") );

	var selectoptions = "";
	for (var i=ThreatAssessment.valueindex['U']; i<=ThreatAssessment.valueindex['V']; i++) {
		selectoptions += '<option value="_V_">_D_</option>\n';
		selectoptions = selectoptions.replace(/_V_/g, ThreatAssessment.values[i]);
		selectoptions = selectoptions.replace(/_D_/g, ThreatAssessment.descr[i]);
	}
	$('#at5').html(snippet);
	$('#lloptions').headroom({
		scroller: document.querySelector('#at5'),
		tolerance : {
			up : 20,
			down : 20
		}
	});

	$('#minV').html(selectoptions).selectmenu({
		select: function(/*event,ui*/) {
			MinValue = $('#minV').val();
			$('#longlist').html(listSelectedRisks());
		}
	}).val(MinValue).selectmenu('refresh');

	$('#incX').on('change',  function() {
		$('#longlist').html(listSelectedRisks());
	});
	$('#incA').on('change',  function() {
		$('#longlist').html(listSelectedRisks());
	});

	$('#longlist').html(listSelectedRisks());
}

function listSelectedRisks() {
	var snippet = '';
	var matches = [];
	var cit = new ComponentIterator({project: Project.cid});
	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	// exclCm is a list (array) of "componentID_ThreatAssessmentID"
	// exclCl is a list (array) of "clusterID_0"
	var exclCm = computeComponentQuickWins();
	var exclCl = computeClusterQuickWins();
	cit.sortByName();

	for (cit.first(); cit.notlast(); cit.next()) {
		var cm = cit.getcomponent();
		for (tit.first(); tit.notlast(); tit.next()) {
			var nc = tit.getNodeCluster();
			// Find the threat assessment for this node
			var ta = null;
			for (var i=0; i<cm.thrass.length; i++) {
				ta = ThreatAssessment.get(cm.thrass[i]);
				if (ta.title==nc.title && ta.type==nc.type) break;
			}
			if (ta && ta.title==nc.title && ta.type==nc.type
			&& (
				(ThreatAssessment.valueindex[ta.total]>=ThreatAssessment.valueindex[MinValue] && ThreatAssessment.valueindex[ta.total]<ThreatAssessment.valueindex['X'])
				||
				(ThreatAssessment.valueindex[ta.total]==ThreatAssessment.valueindex['X'] && $('#incX').prop('checked'))
				||
				(ThreatAssessment.valueindex[ta.total]==ThreatAssessment.valueindex['A'] && $('#incA').prop('checked'))
				)
			) {
				matches.push({
					ta: ta.title,
					cm: cm.title,
					ccf: false,
					qw: (exclCm.indexOf(cm.id+'_'+ta.id)>=0),
					v: ThreatAssessment.valueindex[ta.total]
				});
			}
		}
	}
	tit = new NodeClusterIterator({project: Project.cid, isempty: false});
	for (tit.first(); tit.notlast(); tit.next()) {
		nc = tit.getNodeCluster();
		if (!nc.thrass) continue;

		ta = ThreatAssessment.get(nc.thrass);
		if (
			(ThreatAssessment.valueindex[ta.total]>=ThreatAssessment.valueindex[MinValue] && ThreatAssessment.valueindex[ta.total]<ThreatAssessment.valueindex['X'])
			||
			(ThreatAssessment.valueindex[ta.total]==ThreatAssessment.valueindex['X'] && $('#incX').attr('checked')=='checked')
			||
			(ThreatAssessment.valueindex[ta.total]==ThreatAssessment.valueindex['A'] && $('#incA').attr('checked')=='checked')
		) {
			var r = NodeCluster.get(nc.root());
			matches.push({
				ta: r.title,
				cm: (nc.isroot() ? _("All nodes") : nc.title),
				ccf: true,
				qw: (exclCl.indexOf(nc.id+'_0')>=0),
				v: ThreatAssessment.valueindex[ta.total]
			});
		}
	}
	matches.sort( function(a,b) {
		// A(mbiguous) is the highest
		if (a.v==ThreatAssessment.valueindex['A']) {
			if (b.v==ThreatAssessment.valueindex['A'])  return 0;
			else return 1;
		}
		if (b.v==ThreatAssessment.valueindex['A']) {
			return -1;
		}
		// Neither A nor B is A(mbiguous). We can compare by valueindex
		if (a.v!=b.v) {
			return b.v - a.v;
		}
		// Same threat level, prefer quick wins
		if (a.qw!=b.qw) {
			return (a.qw ? -1 : +1);
		}
		// both (or neither) are quick wins: sort by component title
		return a.cm.toLocaleLowerCase().localeCompare(b.cm.toLocaleLowerCase());
	});
	var lastV = null;
	var lastQW = null;
	var count = [];
	for (i=0; i<matches.length; i++) {
		var m = matches[i];
		if (m.v!=lastV || m.qw!=lastQW) {
			if (snippet!='') snippet+='<br>\n';
			snippet += '<b>' + H(ThreatAssessment.descr[m.v]) +
				(m.qw ? ' ' + _("(quick wins)") : '')+
				'</b><br>\n';
			lastV = m.v;
			lastQW = m.qw;
		}
		if (count[m.v]) count[m.v]++;
		else count[m.v]=1;
		snippet +=
			H(m.cm) +
			' <span style="color: grey;">' +
			(m.ccf ? _("and common cause risk") : _("and risk")) +
			'</span> ' +
			H(m.ta) +
			'<br>\n';
	}
	// Add a line with subtotals and totals to the front of the snippet.
	var head = '';
	for (i=ThreatAssessment.valueindex['A']; i<=ThreatAssessment.valueindex['X']; i++) {
		if (!count[i]) continue;
		if (head=='') {
			head += '(';
		} else {
			head += ', ';
		}
		head += count[i] + ' ' + H(ThreatAssessment.descr[i]);
	}
	if (head!='') {
		head += ')';
	}

	var total = 0;
	for (i=0; i<count.length; i++) {
		total += (count[i] ? count[i] : 0);
	}
	head = _("Number of risks on longlist:") + ' ' + total + ' '+ head;
	head += '<br>\n';

	return head + '<br>' + snippet;
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
