/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals
#ifdef SERVER
urlEncode,
#endif
AssessmentIterator, Component, ComponentIterator, NodeCluster, NodeClusterIterator, PreferencesObject, Project, ProjectIterator, Rules, Service, ServiceIterator, Vulnerability, Assessment, VulnerabilityIterator, Transaction, _t, transactionCompleted, urlDecode
*/

"use strict";
/* Global preferences */
const DEBUG = true;  // set to false for production version
let Preferences;
let ToolGroup;		// eslint-disable-line no-unused-vars
/* GroupSettings: an object with these properties:
 * classroom: the classroom setting from group.json
 * template: idem
 * iconset: idem
 * localonly: idem
 * templatestring: the Raster details of the template project, as stored on the server at startup
*/
let GroupSettings;

/* LS is prefixed to all keys of data entered into localStorage. The prefix
 * is versioned. In future, the app can check for presence of keys from
 * previous versions and perform an upgrade.
 */
const LS_prefix = 'raster';
const LS_version = 4;
const LS = LS_prefix+':'+LS_version+':';		// eslint-disable-line no-unused-vars

const tab_height = 31;		// See CSS definition of <body>
//const toolbar_height = 94;	// See CSS definition of <body>
const MaxStringLen = 5000;	// Limit on object titles, descriptions, etc.

#ifdef STANDALONE
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Glue code for Electron
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

let WindowID = null;
let prefsDir = null;		// eslint-disable-line no-unused-vars
let ipc = require('electron').ipcRenderer;
let Modified = false;		// eslint-disable-line no-unused-vars

ipc.on('window-id', function(event,id) {
	WindowID = id;
});
ipc.on('prefs-dir', function(event,dir) {
	prefsDir = dir;
});
ipc.on('document-start-save', function() {
	var s = CurrentProjectAsString();
	ipc.send('document-save',WindowID,s);
});
ipc.on('document-finalsave', function() {
	var s = CurrentProjectAsString();
	ipc.send('document-save-then-close',WindowID,s);
});
ipc.on('document-start-saveas', function() {
	var s = CurrentProjectAsString();
	ipc.send('document-saveas',WindowID,s);
});
ipc.on('document-save-success', function(event,docname) {
	clearModified();
	if (!docname)  return;
	docname = docname.replace(/\.raster$/,"");
	$('.projectname').text(docname);
	Project.get(Project.cid).settitle(docname);
});
ipc.on('document-start-open', function(event,str) {
	lengthy(function() {
		var newp = loadFromString(str,{strsource: _("File")});
		if (newp!=null) {
			let p = Project.get(newp);
			p.shared = false;
			p.store();
			switchToProject(newp);
			checkForErrors(false);
			checkUpgradeDone();
		}
		clearModified();
	});
});
ipc.on('options', function(event,option,val) {
	switch (option) {
	case 'labels':
		Preferences.setlabel(val);
		break;
	case 'vulnlevel':
		if (val==0) {
			Preferences.setemblem('em_none');
		} else if (val==1) {
			Preferences.setemblem('em_small');
		} else {
			Preferences.setemblem('em_large');
		}
		break;
	case 'minimap':
		Preferences.setmap(val);
		break;
	case 'iconsets': {
		const obj = JSON.parse(val);
		if (Array.isArray(obj)) GroupSettings.iconsets = obj;
		break;
		}
	}
});
ipc.on('props-show', function() {
	ShowDetails();
});
ipc.on('labeledit-show', function() {
	showLabelEditForm();
});
ipc.on('help-show', function() {
	$('#helppanel').dialog('open');
});
ipc.on('find-show', function() {
	StartFind();
});
ipc.on('pdf-settings-show', function(event,pdfoptions) {
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
ipc.on('edit-undo', function() {
	// When we are editing text, emit a keyboard event. Otherwise perform an undo
	if ($(':focus').length>0) return;
	simulateClick('#undobutton');
});
ipc.on('edit-redo', function() {
	if ($(':focus').length>0) return;
	simulateClick('#redobutton');
});

function setModified() {
	Modified = true;
	ipc.send('document-modified',WindowID);
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

/* Perform a lengthy action. Change the cursor to a wait-cursor, then defer to the main thread
 * for that to take effect. In the next cycle of the event loop execute the function, and reset
 * the cursor.
 * The small wait time is necessary; otherwise the cursor sometimes does not change?!
 */
function lengthy(func) {
	$('body').addClass('waiting');
	window.setTimeout(function() {
		func();
		$('body').removeClass('waiting');
	},50);
}

function lengthyFunction(func) {
	return function() {lengthy(func);};
}

function initAllAndSetup() {
	$.ajaxSetup({
		timeout: 10000	// Cancel each AJAX request after 10 seconds
	});
#ifdef SERVER
	if (!testLocalStorage()) {
		// The splash screen is still visible, and will obscure any interaction.
		$('#splashstatus').html( _("Error: no local storage available.<br>Adjust cookie or privacy settings?") );
		return;
	}
#endif
	// Load preferences
	Preferences = new PreferencesObject();
	var remembertab = Preferences.tab;

#ifdef SERVER
	ToolGroup = $('meta[name="group"]').attr('content');
	// Initialise default values, then attempt to retrieve settings from the server
	GroupSettings = {
		classroom: false,
		template: 'Project Template',
		iconsets: ['Default'],
		localonly: false,
		templatestring: ''
	};
	getGroupSettingsAtInitialisation();
	if (GroupSettings.localonly) {
		$('#onlinesection').hide();
	}
#else
	Preferences.online = false;
	ToolGroup = '_%standalone%_';
	GroupSettings = {
		classroom: false,
		template: '',
		iconsets: ['Default'],
		localonly: true,
		templatestring: ''
	};
	// Prevent file drops
	document.addEventListener('dragover', function(event) {event.preventDefault();} );
	document.addEventListener('drop', function(event) {event.preventDefault();} );

	// Some CSS tweaks for the standalone version
	$('#currentProject').hide();
//	$('#toolbars li:first-child').hide();
//	$('#tb_projects').hide();
	$('#onlinesection').hide();
	
	// PDF print options dialog
	$('#pdf_orientation span').text(_("Orientation:"));
	$('#label_portrait').text(_("Portrait"));
	$('#label_landscape').text(_("Landscape"));
	$('#pdf_papersize span').text(_("Paper size:"));
	$('#pdf_scale span').text(_("Scale:"));

	$('[for=paperorientation_portrait]').on('click',  function() { ipc.send('option-modified',WindowID,'pdforientation',0); });
	$('[for=paperorientation_landscape]').on('click',  function() { ipc.send('option-modified',WindowID,'pdforientation',1); });
	$('[for=papersize_a3]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfsize',3); });
	$('[for=papersize_a4]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfsize',4); });
	$('[for=pdfscale_40]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',40); });
	$('[for=pdfscale_50]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',50); });
	$('[for=pdfscale_60]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',60); });
	$('[for=pdfscale_70]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',70); });
	$('[for=pdfscale_80]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',80); });
	$('[for=pdfscale_90]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',90); });
	$('[for=pdfscale_100]').on('click',  function() { ipc.send('option-modified',WindowID,'pdfscale',100); });

	$('#pdfoptions').dialog({
		title: _("Save as PDF"),
		autoOpen: false,
		modal: false,
		width: 420,
		resizable: false,
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		buttons: [
			{ text: _("Cancel"),
				click: function() {$('#pdfoptions').dialog('close');}
			},
			{ text: _("Save as PDF"),
				click: function() {
					$('#pdfoptions').dialog('close');
					ipc.send('do-saveaspdf',WindowID);
				}
			}
		]
	});
	// Don't print the settings dialog. This means you can leave it open while saving a PDF. Convenient!
	$('#pdfoptions').parent().addClass('donotprint');
#endif

	// General UI
	$('input[type=button]').button();
	$('input[type=submit]').button();
	$('input[type=radio]').checkboxradio({icon: false});
	$('fieldset').controlgroup();
	// Toolbar items
	$('.toolbarlargebutton,.toolbarbutton,.toolbarlargeiconbutton,.toolbariconbutton').addClass('ui-widget ui-button ui-corner-all');
	$('.toolbarlabel').addClass('ui-widget');

	initTabDiagrams();
	initTabSingleFs();
	initTabCCFs();
	initTabAnalysis();

	$('#toolbars').tabs({
		beforeActivate: toolbartabselected
	});

	initProjectsToolbar();
	initHomeToolbar();
	initSettingsToolbar();
	$('#toolbars').tabs('option','active',TabTBHome);

	// Vertical tabs
	$('#workspace').tabs({heightStyle: 'fill', activate: vertTabSelected});
	$('#workspace').addClass('ui-tabs-vertical-sw ui-helper-clearfix');
	$('#workspacetabs').addClass('rot-neg-90');
	
	$("a[href^='#tab_diagrams']").attr('title', _("Draw diagrams for the services."));
	$("a[href^='#tab_singlefs']").attr('title', _("Assess all single failures."));
	$("a[href^='#tab_ccfs']").attr('title', _("Assess all common cause failures."));
	$("a[href^='#tab_analysis']").attr('title', _("Reporting and analysis tools."));
	$("a[href^='#tab_diagrams']").text(_("Diagrams"));
	$("a[href^='#tab_singlefs']").text(_("Single failures"));
	$("a[href^='#tab_ccfs']").text(_("Common cause failures"));
	$("a[href^='#tab_analysis']").text(_("Analysis"));
	
	$('#tab_singlefs').on('click', removetransientwindows);
	$('#tab_ccfs').on('click', removetransientwindows);
	$('#tab_analysis').on('click', removetransientwindows);

	// Make sure that each tool window has a unique name
	if (!window.name.match(/^RasterTool\d+$/)) {
		window.name = 'RasterTool'+String(Math.random()).substring(2);
	}

	var p;
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
	if (loadFromString(str,{allowempty: true, strsource: _("Browser local storage")})!=null) {
		// Loading from localStorage succeeded. Try to active the project
		// indicated by Preferences.currentproject, or take any one project
		// if that one does not exist.
		i = Project.withTitle(Preferences.currentproject);
		p = (i==null ? Project.firstProject() : Project.get(i) );
		if (p==null) {
			loadDefaultProject();
		} else {
			p.load();
			p.dorefresh(false); // Check for update on the server
			var it = new ServiceIterator({project: p.id});
			var found = false;
			var s;
			for (s of it) {
				found = (s.title == Preferences.service);
				if (found) break;
			}
			if (found) {
				Service.cid = s.id;
			}
		}
	} else {
		loadDefaultProject();
	}
	startWatchingCurrentProject();
	populateProjectList();
#else
	localStorage.clear();
	loadEmptyProject();
#endif

	// Diagrams have already been painted on Project.load()
	p = Project.get(Project.cid);
	p.services.forEach(sid => paintSingleFailures(Service.get(sid)));
	PaintAllClusters();
	repaintCurrentAnalysis();
	SizeDOMElements();

	// Set/perform all preferences with side effects
	Preferences.setlabel(Preferences.label);
	Preferences.setemblem(Preferences.emsize);
	Preferences.settab(remembertab);
	forceSelectVerticalTab(Preferences.tab);

	$('body').on('keydown', function(evt){
		// Backspace, unfortunately, is bound in the browser to 'Return to previous page'
		if (evt.key=='Delete' || evt.key=='Backspace') {
			if (!$(evt.target).is('input:not([readonly]):not([type=radio]):not([type=checkbox]), textarea, [contentEditable], [contentEditable=true]')) {
				// Only when focus is NOT on input or textarea
				$('#mi_sd').trigger('mouseup');
				evt.preventDefault();
				return;
			}
		}

#ifdef SERVER
		// F1 (mostly for Windows): to trigger the Help panel
		if (evt.key=='F1') {
			simulateClick('#helpbutton');
			evt.preventDefault();
			return;
		}
		// Cmd-F for MacOS or Ctrl-F for Windows: to trigger the Find panel
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='f') {
			simulateClick('#findbutton');
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
		// Cmd-2 for MacOS or Ctrl-2 for Windows: to trigger the Single Failures screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='2') {
			forceSelectVerticalTab(1);
			evt.preventDefault();
			return;
		}
		// Cmd-3 for MacOS or Ctrl-3 for Windows: to trigger the Common cause failures screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='3') {
			forceSelectVerticalTab(2);
			evt.preventDefault();
			return;
		}
		// Cmd-4 for MacOS or Ctrl-4 for Windows: to trigger the Analsys screen
		if ((evt.ctrlKey || evt.metaKey) && evt.key=='4') {
			forceSelectVerticalTab(3);
			evt.preventDefault();
			return;
		}

		// Cmd-Z for MacOS or Ctrl-Z for Windows: to trigger Undo
		if ((evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key=='z') {
			// Make sure no element has focus, to not interfere with text editing
			if ($(':focus').length>0) return;
			simulateClick('#undobutton');
			evt.preventDefault();
			return;
		}
		// Shift-Cmd-Z for MacOS or Ctrl-Y for Windows: to trigger Redo
		if ((evt.metaKey && evt.shiftKey && evt.key=='z')
		 || (evt.ctrlKey && evt.key=='y')) {
			// Make sure no element has focus, to not interfere with text editing
			if ($(':focus').length>0) return;
			simulateClick('#redobutton');
			evt.preventDefault();
			return;	// eslint-disable-line no-useless-return
		}
		// Cmd-L for MacOS or Ctrl-L for Windows: to show Label editor
		if ((evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key=='l') {
			// Make sure no element has focus, to not interfere with text editing
			simulateClick('#buttlabels');
			evt.preventDefault();
			return;
		}
		// tab: cycle the toolbars
		if (!evt.ctrlKey && !evt.metaKey && !evt.shiftKey && evt.key=='Tab') {
			// Make sure no element has focus, to not interfere with text editing
			switch ($('#toolbars').tabs('option','active')) {
			case TabTBProjects:
				$('#toolbars').tabs('option','active',TabTBHome);
				break;
			case TabTBHome:
				$('#toolbars').tabs('option','active',TabTBSettings);
				break;
			case TabTBSettings:
				$('#toolbars').tabs('option','active',TabTBProjects);
				break;
			}
			evt.preventDefault();
			return;	// eslint-disable-line no-useless-return
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
		if (localStorage.RasterToolIsLoaded && localStorage.RasterToolIsLoaded==window.name) {
			localStorage.removeItem('RasterToolIsLoaded');
		}
	}));
#endif
	$(window).on('resize', function(evt) {
		if ($(evt.target).hasClass('ui-dialog')) return;
		SizeDOMElements();
	});

	// The onbeforeprint handler is supported by IE and Firefox only.
	window.onbeforeprint = function() {
		switch (Preferences.tab) {
		case 0:
			var os = $('#scroller_overview'+Service.cid).offset();
			$('#scroller_region'+Service.cid).offset( {top: os.top+1, left: os.left+1});
			$('#tab_diagrams'+Service.cid).scrollTop(0);
			$('#tab_diagrams'+Service.cid).scrollLeft(0);
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

// Make a button appear active, wait 50ms, click, wait 100ms, make inactive
function simulateClick(elem) {
	$(elem).addClass('ui-state-active');
	window.setTimeout(function() {
		$(elem).trigger('click');
		window.setTimeout(function() {
			$(elem).removeClass('ui-state-active');
		}, 100);
	}, 50);
}

function initProjectsToolbar() {
	$("a[href^='#tb_projects']").text(_("Projects"));
	$('#buttadd').attr('title',_("Add a new default project to the library."));
	$('#buttimport').attr('title',_("Load a project from a file."));
	$('#buttexport').attr('title',_("Save the current project to a file."));
	$('#buttduplicate').attr('title',_("Create a copy of the current project."));
	$('#projectprops').attr('title',_("Inspect and modify the current project."));
	// Props ------------------
	$('#projectprops').on('click',  ShowDetails);
	// Add --------------------
#ifdef SERVER
	$('#buttadd').on('click',function() {
		lengthy(loadDefaultProject);
	});
	// Duplicate --------------------
	$('#buttduplicate').on('click',  lengthyFunction(() => {
			let p = Project.get(Project.cid);
			let clone = p.duplicate();
			clone.setshared(false,false);
			clone.settitle(p.title+_(" (copy)"));
			populateProjectList();
			switchToProject(clone.id,false);
		})
	);
	// Import --------------------
	$('#buttimport').on('click',  function() {
		$('#buttimport').removeClass('ui-state-hover');
		$('#body').off('click');
		$('#fileElem').trigger('click');
		$('#body').on('click',  function(){ return false; });
	});
	$('#fileElem').on('change',  function(event) {
		var files = event.target.files;
		if (files.length==null || files.length==0)  return;
		var reader = new FileReader();
		reader.onload = function(evt) {
			lengthy(function() {
				var newp = loadFromString(evt.target.result,{strsource:`File "${files[0].name}"`});
				if (newp!=null) {
					// Make sure the newly imported project is indeed private
					var p = Project.get(newp);
					p.setshared(false,false);
					switchToProject(newp);
					populateProjectList();
				}
				// Remove the default project, as long as it is still unmodified??
				transactionCompleted("Project add");
				// Import checks are not as thorough as the internal consistency checks on components.
				// Therefore, force a check after load.
				checkForErrors(false);
				checkUpgradeDone();
			});
		};
		reader.readAsText(files[0]);
	});
	// Export --------------------
	$('#buttexport').on('click',  function() {
		singleProjectExport(Project.cid);
	});

	$('#projlistsection>div:first-child').text(_("Project library"));
	$('#projlist').selectmenu({
		open: showProjectList,
		select: function(event,data) {
			// data.item.value = id of selected project
			// data.item.label = name of selected project
			refreshSelProjectButtons(data.item.value);
		}
	});
	$('#selector').attr('title',_("Library of all projects."));
	$('#buttactivate').attr('title',_("Switch to the selected project."));
	$('#buttdel').attr('title',_("Permanently remove the selected project."));
	$('#buttmerge').attr('title',_("Join the selected project into the current one."));
	// Project list
	// Activate --------------------
	$('#buttactivate').on('click',  function() {
		let p = Project.get( $('#projlist').val() );
		if (!p) return;
		if (!p.stub) {
			lengthy(function() {
				switchToProject(p.id,true);
				refreshProjectToolbar(Project.cid);
			});
		} else {
			// Activating a stub project.
			// Make sure that there is no local project with that name
			if (Project.withTitle(p.title)!=null) {
				rasterAlert(_("That project name is used already"),
					_H("There is already a project called '%%'. Please rename that project first.", p.title)
				);
			} else {
				lengthy(function() {
					// Do a retrieve operation, and switch to that new project, if successful.
					Project.asyncRetrieveStub(p.id,function(newpid){
						populateProjectList();
						switchToProject(newpid);
						Project.get(newpid).updateUndoRedoUI();
						startWatchingCurrentProject();
					});
					refreshProjectToolbar(Project.cid);
				});
			}
		}
	});
	// Delete --------------------
	$('#buttdel').on('click',  function(/*evt*/){
		let p = Project.get( $('#projlist').val() );
		if (p==null) {
			bugreport('No project selected','buttdel click handler');
		}
		let dokill = function() {
			if (p.shared || p.stub) {
				// Disable the project watch. Otherwise a notification would be triggered.
				stopWatching(p.id);
				// remove from the server
				p.deleteFromServer();
				populateProjectList();
			}
			if (p.id==Project.cid) {
				p.destroy();
				p = Project.firstProject();
				// Add a blank project if none would be left
				if (p==null) {
					loadDefaultProject();
				} else {
					switchToProject(p.id);
				}
			} else {
				p.destroy();
				refreshProjectToolbar(Project.cid);
			}
		};
		newRasterConfirm(_("Delete project %%?", p.title),
		_("Are you sure you want to remove project <i>'%%'</i>?\n<strong>This cannot be undone.</strong>", H(p.title)),
		_("Remove"),_("Cancel")
		).done(function() {
			var t=p.totalnodes();
			if (t>3) {
				newRasterConfirm(_("Delete project %%?", p.title),
					_("This project has %% nodes.\nAre you <i>really</i> sure you want to discard these?", t),
					_("Yes, really remove"),_("Cancel"))
				.done(lengthyFunction(dokill));
			} else {
				lengthy(dokill);
			}
		});
	});
	// Merge --------------------
	$('#buttmerge').on('click',  function() {
		var otherproject = Project.get( $('#projlist').val() );
		if (otherproject.stub) {
			rasterAlert(_("Cannot merge a remote project"),_H("This tool currently cannot merge remote projects. Activate that project first, then try to merge again."));
			return;
		}
		var currentproject = Project.get( Project.cid );
		rasterConfirm(_("Merge '%%' into '%%'?",otherproject.title,currentproject.title),
			_("Are you sure you want to fold project '%%' into the current project? <strong>This cannot be undone.</strong><br>",
				H(otherproject.title))
			+'<br>\n'+
			_H("This will copy the diagrams of '%%' into '%%'.",
				otherproject.title,currentproject.title),
			_("Merge"),_("Cancel"),
			lengthyFunction(function() {
				currentproject.merge(otherproject.id);
				currentproject.updateUndoRedoUI();
				let it = new ServiceIterator({project: Project.cid});
				it.forEach( (s) => {
					if (s._loaded) return;
					s.load();
					paintSingleFailures(s);
				});
				PaintAllClusters();
			})
		);
	});
#else
	// Hide stuff for standalone version
	$('#projselected').hide();
	$('#buttduplicate').hide();
	$('#buttadd').on('click',function() { ipc.send('document-new',WindowID); });
	$('#buttimport').on('click',function() { ipc.send('document-import',WindowID); });
	$('#buttexport').on('click',function() {
		let s = CurrentProjectAsString();
		ipc.send('document-save',WindowID,s);
	});
#endif

	$('#projdebugsection>div:first-child').text(_("Debugging functions"));
	$('#buttcheck').text(_("Check"));
	$('#buttexportall').text(_("Export all"));
	$('#buttzap').text(_("Wipe library"));
	$('#buttcheck').attr('title',_("Check the projects for internal consistency."));
	$('#buttexportall').attr('title',_("Save all projects into a single file."));
	$('#buttzap').attr('title',_("Permanently remove all projects."));
	$('#networkactivity').attr('title',_("Flashes on network activity."));
	// Check --------------------
	$('#buttcheck').on('click',  function() {
		checkForErrors(true);
	});
	// Export all --------------------
	$('#buttexportall').on('click',  function() {
		exportAll();
	});
	// Zap! --------------------
	$('#buttzap').on('click',  function(){
		rasterConfirm(_("Delete all?"),
			_H("This will delete all your projects and data.\n\nYou will lose all your unsaved work!\n\nAre you sure you want to proceed?"),
			_("Erase everything"),_("Cancel"),
			function() {
				rasterConfirm(_("Delete all?"),
					_("Really sure? You will lose <b>all private</b> projects!\n"),
					_("Yes, really erase all"),_("Cancel"),
					Zap
				);
			}
		);
	});

#ifdef SERVER
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
}

#ifdef SERVER
function refreshProjectToolbar(pid) {
	$('#projlist').val(pid).selectmenu('refresh');
	refreshSelProjectButtons(pid);
}

function refreshSelProjectButtons(pid) {
	if (pid==Project.cid) {
		$('#buttactivate').addClass('ui-state-disabled');
		$('#buttmerge').addClass('ui-state-disabled');
	} else {
		$('#buttactivate').removeClass('ui-state-disabled');
		$('#buttmerge').removeClass('ui-state-disabled');
	}
}

/* populateProjectList: Fill the project list using current stubs
 */
function populateProjectList() {
	var snippet = "";
	var newoptions = "";
	var it = new ProjectIterator({group: ToolGroup});
	it.sortByTitle();

	// First all private projects
	for (const p of it) {
		if (p.stub || p.shared) continue;
		if (snippet=="") {
			snippet = '<optgroup class="optgroup" label="'+_H("Private projects")+'">\n';
		}
		snippet += '<option value="'+p.id+'" title="'+H(p.description)+'">'+H(p.title)+'</option>\n';
	}
	if (snippet!="") {
		snippet += '</optgroup>\n';
	}
	newoptions += snippet;
	//	 Then all shared projects, if they belong to group ToolGroup
	if (!GroupSettings.localonly) {
		snippet = "";
		for (const p of it) {
			if (p.stub || !p.shared) continue;
			if (snippet=="") {
				snippet = '<optgroup class="optgroup" label="'+_H("Shared projects")+'">\n';
			}
			snippet += '<option value="'+p.id+'" title="'+H(p.description)+'">'+H(p.title)+'</option>\n';
		}
		if (snippet!="") {
			snippet += '</optgroup>\n';
		}
		newoptions += snippet;
	}
	$('#projlist').html(newoptions);
	// Finally all stubs projects
	refreshStubList(true); // Add current stubs, possibly outdated wrt server status
}

/* showProjectList: Show project list using current stubs, and do fire periodic updates
 */
function showProjectList() {
	populateProjectList();
	if (!GroupSettings.localonly && Preferences.online) {
		startPeriodicStubListRefresh(); // Update stubs from server and refresh
	}
}

var ProjectListTimer = null;

function startPeriodicStubListRefresh() {
	if (ProjectListTimer!=null)  return;
	// Update very 2 seconds. Updates in progress will not be interrupted
	Project.UpdateStubs();
	ProjectListTimer = window.setInterval(function() {
		if ($('#projlist-menu').parent().css('display')=='none') {
			window.clearInterval(ProjectListTimer);
			ProjectListTimer=null;
			return;
		}
		Project.UpdateStubs();
	},2000);
}


function refreshStubList(dorepaint=false) {
	if (GroupSettings.localonly) return;
	let snippet = '';
	let it = new ProjectIterator({group: ToolGroup, stub: true});
	it.sortByTitle();
	let str = (GroupSettings.classroom ? _("Exercises") : _("Other projects on the server"));
	for (const p of it) {
		if (snippet=='') {
			snippet = `<optgroup id="stubgroup" class="optgroup" label="${str}">\n`;
		}
		snippet += `<option value="${p.id}" title="${H(p.description)}">${H(p.title)}, by ${H(p.creator)} on ${prettyDate(p.date)}</option>\n`;
	}
	if (snippet!='') {
		snippet += '</optgroup>\n';
	}
	$('#stubgroup').remove();
	$('#projlist').append(snippet);
	if (dorepaint) {
		refreshProjectToolbar(Project.cid);
	}
	// This hack will ensure that the item under the pointer, that is currently highlighted,
	// will not change its color after the menu has been refreshed.
	$('#projlist-menu li').trigger('mousemove');
}
#endif

#ifdef SERVER
function getGroupSettingsAtInitialisation() {
	$.ajax({
		url: 'group.json',
		async: false,
		dataType: 'json',
		success: function(data) {
			if (data.classroom===true) {
				GroupSettings.classroom = true;
				$("#classroom").text(_("Classroom version")).show();
			}
			if (typeof data.template==='string') {
				GroupSettings.template = data.template;
			}
			if (data.localonly===true) {
				GroupSettings.localonly = true;
				GroupSettings.classroom = true;
			}
			if (typeof data.iconsets==='object' && Array.isArray(data.iconsets) && data.iconsets.every(s => typeof s==='string') ) {
				GroupSettings.iconsets = data.iconsets;
			}
		}
	});
	if (GroupSettings.template=='') return;
	// Try to fetch the template.
	Project.UpdateStubs(false,false); // async, and do not repaint
	let stubproj=null;
	// Check for a template
	for (const idobj of Project._all) {
		let p = idobj[1]; // idobj[0]=key, idobj[1]=value
		if (p.group!=ToolGroup) continue;
		if (p.stub && isSameString(p.title,GroupSettings.template)) stubproj = p;
	}
	if (!stubproj) return;
	// Try to fetch it
	$.ajax({
		url: 'share.php?op=get'+
			'&name=' + urlEncode(stubproj.title) +
			'&creator=' + urlEncode(stubproj.creator) +
			'&date=' + urlEncode(stubproj.date),
		async: false,
		dataType: 'text',
		success: function (data) {
			GroupSettings.templatestring = data;
		}
	});
}
#endif

function initHomeToolbar() {
	$("a[href^='#tb_home']").text(_("Home"));
	$('#undobutton').attr('title', _("Undo"));
	$('#redobutton').attr('title', _("Redo"));
	$('#findbutton').attr('title', _("Locate nodes"));
	$('#helpbutton').attr('title', _("Assistance"));
	$('#undobutton').on('click', function() {
		Transaction.undo();
	});
	$('#redobutton').on('click', function() {
		Transaction.redo();
	});
	$('#findbutton').on('click', StartFind);
	$('#helpbutton').on('click',  function() {
		$('#helppanel').dialog('open');
	});

	let rsfunc = function(/*event,ui*/) {
		$('#helptabs ul').width($('#helppanel').width()-14);
		let hp = $('#helppanel').height();
		let tb = $('#helppanel ul').height();
		let padding = 36;
		$('#helppanel iframe').height(hp-tb-padding);
	};
	$('#helppanel').dialog({
		title: _("Information on using this tool"),
		autoOpen: false,
		height: 450,
		minHeight: 120,
		width: 700,
		minWidth: 470,
		maxWidth: 800,
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
//		open: function(/*event*/) {
//			initFrequencyTool();
//			rsfunc();
//		},
		resize: rsfunc
	});
	$('#helppanel').dialog('widget').addClass('donotprint');

	$('#helptabs a').eq(0).text( _("Frequency") );
	$('#helptabs a').eq(1).text( _("Impact") );
	$('#helptabs a').eq(2).text( _("Shortcuts") );
	$('#helptabs a').eq(3).text( _("Manual") );
	$('#helptabs a').eq(4).text( _("About") );
	$('#helptabs a').eq(0).attr('href', _("../help/Frequency.html") );
	$('#helptabs a').eq(1).attr('href', _("../help/Impact.html") );
	$('#helptabs a').eq(2).attr('href', _("../help/Shortcuts.html") );
	$('#helptabs a').eq(3).attr('href', _("../help/Process.html") );
	$('#helptabs a').eq(4).attr('href', _("../help/About.html") );
	$('#helptabs li:last-of-type').css("margin-left","10px");
	$('#helptabs').tabs({
		heightStyle: 'content',
		load: function(/*event,ui*/) {
			let tb = $('#helptabs').tabs('option','active');
			if (tb==0) {
				initFrequencyTool();
			} else if (tb==3) {
				rsfunc();
			}
		}
	});

	// Home toolbar | label section
	$('#buttlabels').attr('title', _("Edit labels"));
	$('#buttlabels').on('click', showLabelEditForm);

	// Home toolbar | Diagram items: templates are set up in Project.load()

	// Home toolbar | SF items
	$('#sffoldsection>div:first-child').text(_("Fold"));
	$('#sfexpandall').text(_("Expand all"));
	$('#sfcollapseall').text(_("Collapse all"));
	$('#sfexpandall').button({icon: 'ui-icon-arrowthickstop-1-s'});
	$('#sfcollapseall').button({icon: 'ui-icon-arrowthickstop-1-n'});
	$('#sfexpandall').on('click',  function(){
		$('#singlefs_workspace'+Service.cid).scrollTop(0);
		expandAllSingleF(Service.cid);
	});
	$('#sfcollapseall').on('click',  function(){
		$('#singlefs_workspace'+Service.cid).scrollTop(0);
		collapseAllSingleF(Service.cid);
	});
	$('#sfsortsection>div:first-child').text(_("Sort"));
	$('#sfsort_alph').checkboxradio('option', 'label', _("Alphabetically"));
	$('#sfsort_type').checkboxradio('option', 'label', _("by Type"));
	$('#sfsort_thrt').checkboxradio('option', 'label', _("by Vulnerability level"));
	$('label[for=sfsort_alph]').attr('title', _("List by title A-Z"));
	$('label[for=sfsort_type]').attr('title', _("Group by type"));
	$('label[for=sfsort_thrt]').attr('title', _("Most vulnerable first, least vulnerable last"));
	$('#sfsort_alph').prop('checked',true);
	$('input[name=sfsort]').checkboxradio('refresh');
	$('#sfsortsection input').on('change', function() {
		paintSingleFailures(Service.get(Service.cid));
	});

	// Home toolbar | CCF items
	$('#ccffoldsection>div:first-child').text(_("Fold"));
	$('#ccfexpandall').text(_("Expand all"));
	$('#ccfcollapseall').text(_("Collapse all"));
	$('#ccfexpandall').button({icon: 'ui-icon-arrowthickstop-1-s'});
	$('#ccfcollapseall').button({icon: 'ui-icon-arrowthickstop-1-n'});
	$('#ccfexpandall').on('click', function(){
		$('#ccfs_body').scrollTop(0);
		expandAllCCF();
	});
	$('#ccfcollapseall').on('click', function(){
		$('#ccfs_body').scrollTop(0);
		collapseAllCCF();
	});
	$('#ccfsortsection>div:first-child').text(_("Sort"));
	$('#ccfsort_alph').checkboxradio('option', 'label', _("Alphabetically"));
	$('#ccfsort_type').checkboxradio('option', 'label', _("by Type"));
	$('#ccfsort_thrt').checkboxradio('option', 'label', _("by Vulnerability level"));
	$('label[for=ccfsort_alph]').attr('title', _("List by title A-Z"));
	$('label[for=ccfsort_type]').attr('title', _("Group by type"));
	$('label[for=ccfsort_thrt]').attr('title', _("Most vulnerable first, least vulnerable last"));
	$('#ccfsort_alph').prop('checked',true);
	$('input[name=ccfsort]').checkboxradio('refresh');
	$('#ccfsortsection input').on('change', function(){
		PaintAllClusters();
	});

	// Home toolbar | Analysis items
	$('#anavnsortsection>div:first-child').text(_("Sort nodes and clusters"));
	$('#anavfsortsection>div:first-child').text(_("Sort vulnerabilities"));
	$('#ana_nodesort_alph').checkboxradio('option', 'label', _("Alphabetically"));
	$('#ana_nodesort_type').checkboxradio('option', 'label', _("by Type"));
	$('#ana_nodesort_thrt').checkboxradio('option', 'label', _("by Vulnerability level"));
	$('label[for=ana_nodesort_alph]').attr('title', _("List rows by title A-Z"));
	$('label[for=ana_nodesort_type]').attr('title', _("Group rows by type"));
	$('label[for=ana_nodesort_thrt]').attr('title', _("Most vulnerable top, least vulnerable bottom"));
	$('#ana_failsort_alph').checkboxradio('option', 'label', _("Alphabetically"));
	$('#ana_failsort_type').checkboxradio('option', 'label', _("by Type"));
	$('label[for=ana_failsort_alph]').attr('title', _("List columns by title A-Z"));
	$('label[for=ana_failsort_type]').attr('title', _("Group columns by type"));
	$('#ana_nodesort_'+FailureThreatSortOpt.node).prop('checked',true);
	$('#ana_failsort_'+FailureThreatSortOpt.threat).prop('checked',true);
	$('input[name=ana_nodesort]').checkboxradio('refresh');
	$('input[name=ana_failsort]').checkboxradio('refresh');
	$('#anavexcludesection>div:first-child').text(_("Click cells to include/exclude them"));
	$('#quickwinslink').text(_("Quick wins"));
	$('#clearexclusions').text(_("Clear exclusions"));
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
		ComponentExclusions.clear();
		ClusterExclusions.clear();
		for (const id of exclCm) ComponentExclusions.add(id);
		for (const id of exclCl) ClusterExclusions.add(id);
		paintSFTable();
		paintCCFTable();
		$('#clearexclusions').button('option','disabled', (exclCm.length==0 && exclCl.length==0));
	});
	$('#clearexclusions').button().button('option','disabled',true).on('click',  function() {
		ComponentExclusions.clear();
		ClusterExclusions.clear();
		paintSFTable();
		paintCCFTable();
		$('#clearexclusions').button('option','disabled',true);
	});
	
	$('#anallincsection>div:first-child').text(_("Include"));
	$('#anallminsection>div:first-child').text(_("Minimum value"));
	$('#anallincsection label[for=incX]').text(_("Undetermined"));
	$('#anallincsection label[for=incA]').text(_("Ambiguous"));
}

function initSettingsToolbar() {
	$("a[href^='#tb_settings']").text(_("Settings"));
	// Options toolbar | diagrams options
	$('#vulnlevelsection>div:first-child').text(_("Vulnerability levels"));

	$('#em_none').checkboxradio('option', 'label', _("None"));
	$('#em_small').checkboxradio('option', 'label', _("Small"));
	$('#em_large').checkboxradio('option', 'label', _("Large"));
	$('label[for=em_none]').attr('title', _("Hide vulnerability of nodes in diagrams"));
	$('label[for=em_small]').attr('title', _("Show vulnerability of nodes using small color square"));
	$('label[for=em_large]').attr('title', _("Show vulnerability of nodes using large color square and letter"));
	$('#'+Preferences.emsize).prop('checked',true);
	$('input[name=emblem_size]').checkboxradio('refresh');
	$('#vulnlevelsection input').on('change', function() {
		Preferences.setemblem($('input[name=emblem_size]:checked').val());
#ifdef STANDALONE
		ipc.send('option-modified',WindowID,'vulnlevel',(Preferences.emsize=='em_none' ? 0 : (Preferences.emsize=='em_small' ? 1 : 2 )));
#endif
	});
	$('#labelsection>div:first-child').text(_("Label colors"));
	$('#label_off').checkboxradio('option', 'label', _("hide"));
	$('#label_on').checkboxradio('option', 'label', _("show"));
	$('label[for=label_off]').attr('title', _("Paint nodes in white"));
	$('label[for=label_on]').attr('title', _("Paint nodes using the color of their label"));
	$('#label_off').prop('checked',!Preferences.label);
	$('#label_on').prop('checked',Preferences.label);
	$('input[name=labelonoff]').checkboxradio('refresh');
	$('#labelsection input').on('change', function() {
		Preferences.setlabel($('#label_on').prop('checked'));
#ifdef STANDALONE
		ipc.send('option-modified',WindowID,'labels',Preferences.label);
#endif
	});
	$('#mapsection>div:first-child').text(_("Mini-map"));
	$('#showmap_off').checkboxradio('option', 'label', _("off"));
	$('#showmap_on').checkboxradio('option', 'label', _("on"));
	$('label[for=showmap_off]').attr('title', _("Hide the miniature overview of the workspace"));
	$('label[for=showmap_on]').attr('title', _("Show a miniature overview of the workspace"));
	$('#showmap_off').prop('checked',!Preferences.showmap);
	$('#showmap_on').prop('checked',Preferences.showmap);
	$('input[name=showmap]').checkboxradio('refresh');
	$('#mapsection input').on('change', function() {
		Preferences.setmap($('#showmap_on').prop('checked'));
#ifdef STANDALONE
		ipc.send('option-modified',WindowID,'minimap',Preferences.showmap);
#endif
	});

#ifdef SERVER
	// Creator name
	if (!Preferences.creator) Preferences.creator = _("Anonymous");
	$('#creatorlabel>div:first-child').text(_("Your name"));
	$('#creatorf').prop('placeholder',Preferences.creator);
	$('#creatorf').attr('title',_("The author's name on projects that you share."));
	$('#creatorf').on('click', function() {
		$(this).val(Preferences.creator);
	});
	$('#creatorf').on('keypress', (e) => {if (e.which == 13) $('#creatorf').trigger('blur');});
	$('#creatorf').on('blur', function() {
		Preferences.setcreator($(this).val());
		$('#creatorf').val("").prop('placeholder',Preferences.creator);
	});
	// Online / offline settings
	$('#onlinelabel>div:first-child').text(_("Server synchronisation"));
	$('#online_off').checkboxradio('option', 'label', _("offline"));
	$('#online_on').checkboxradio('option', 'label', _("online"));
	$('label[for=online_off]').attr('title', _("Do not synchronise changes to the server"));
	$('label[for=online_on]').attr('title', _("Synchronize all changes to the server for instant collaboration"));
	$('#online_off').prop('checked',!Preferences.online);
	$('#online_on').prop('checked',Preferences.online);
	$('input[name=onlineonoff]').checkboxradio('refresh');
	$('#onlinesection input').on('change', function() {
		Preferences.setonline($('#online_on').prop('checked'));
	});
#endif
}

const TabTBProjects = 0;
const TabTBHome = 1;
const TabTBSettings = 2;

function toolbartabselected(/*evt,ui*/) {
	let p;
	switch ($('#toolbars').tabs('option','active')) {
	case TabTBProjects:
		break;
	case TabTBHome:
		break;
	case TabTBSettings:
		p = Project.get(Project.cid);
		$('#projname').text(p.title);
		$('#projdescr').text(p.description);
		$('#sharing_off').prop('checked',!p.shared);
		$('#sharing_on').prop('checked',p.shared);
		break;
	default:
		bugreport('unknown tab encountered','toolbartabselected');
	}
}

var findTimer;
var nodeFindString = "";
var FindScrollPos = 0;

var updateFind = function() {
	let str = $('#field_find').val();
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
	
	let res = "";
	let currtype='';
	let p = Project.get(Project.cid);
	if (nodeFindString!='') {
		let it = new NodeIterator({project: Project.cid});
		it.sortByType();
		for (const rn of it) {
			let s = Service.get(rn.service);
			let cm = null;
			if (rn.component) cm=Component.get(rn.component);
			// Several text fields can give a match with the search string:
			// - node title or suffix
			// - node label
			// - custom vulnerabilities on the node
			// - remarks on the node's assessments
			// We concatenate all these text fields into one single searchstring. Elements are separated
			// by the string _%_%_ (which is unlikely to appear in the elements), to prevent the case whereby
			// the nodeFindStrings happens across two elements.
			let sep = '_%_%_';
			let searchstring = rn.title+sep+rn.suffix+sep;
			if (Preferences.label && rn.color && rn.color!='none') searchstring += rn.color+sep;
			if (cm) {
				for (const aid of cm.assmnt) {
					let a = Assessment.get(aid);
					let vln = Vulnerability.get(a.vulnerability);
					if (!vln.common)  searchstring += vln.title+sep;
					searchstring += a.remark+sep;
				}
			}
			if (searchstring.toLocaleUpperCase().indexOf(nodeFindString.toLocaleUpperCase())!=-1) {
				if (rn.type!=currtype) {
					if (res!='') res += '<br>\n';
					res += '<b>'+H(Rules.nodetypes[rn.type])+'</b><br>\n';
					currtype = rn.type;
				}
				// Show a small circle in the label color, if any.
//				if (Preferences.label) {
					if (rn.color && rn.color!='none') {
						res += '<div class="tinyblock B' + rn.color + '" title="' + H(p.strToLabel(rn.color)) + '"></div>';
					} else {
						res += '<div class="tinyblock" style="border: 1px solid white;"></div>';
					}
//				}
				// Show a small square in the overall vulnerability level, if any
				if (cm) {
					if (cm.magnitude!='-') {
						res += '<div class="tinysquare M'
						+ Assessment.valueindex[cm.magnitude]
						+ '" title="' + H(Assessment.descr[Assessment.valueindex[cm.magnitude]])
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
				res += ' <span style="color:grey;">'
				+ _("in service")
				+ '</span> '
				+ H(s.title);
				res += '</span>';
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
		$('#workspace').tabs('option','active',TabWorkDia);
		// Activate the right service. Since this will remove dialogs, including the Find window, restore the Find window after activation.
		if (svc_id != Service.cid) {
			$('#tab_diagramstabtitle'+svc_id).trigger('click');
			FindScrollPos = -FindScrollPos;
			StartFind(nodeFindString);
		}
		// Scroll the node into view
		var scrolldist_l = 0;
		var scrolldist_t = 0;
//		var view_l = $('#tab_diagrams'+svc_id).scrollLeft();
//		var view_t = $('#tab_diagrams'+svc_id).scrollTop();
		var view_o = $('#tab_diagrams'+svc_id).offset();
		var view_w = $('#tab_diagrams'+svc_id).width();
		var view_h = $('#tab_diagrams'+svc_id).height();
		var nodepos = $(node.jnid).offset();
		if (nodepos.left < view_o.left)  scrolldist_l = view_o.left - nodepos.left + 100;
		if (nodepos.left > view_o.left+view_w)  scrolldist_l = view_w - nodepos.left - view_o.left - 100;
		if (nodepos.top < view_o.top)    scrolldist_t = view_o.top - nodepos.top + 100;
		if (nodepos.top > view_o.top+view_h)  scrolldist_t = view_h - nodepos.top - view_o.top - 100;
		// The node may be behind the Find window, or the scroller
		$('#findpanel').dialog('widget').stop().fadeTo('slow', 0.5);
		$('#scroller_overview'+svc_id).stop().fadeTo('slow', 0.5);
		
		var draw_and_wiggle = function() {
			let o = $('#tab_diagrams'+svc_id).offset();
			let scrollp = $('#diagrams_workspace'+svc_id).position();
			$('#selectrectC').hide();
			$('#selectrect')
			.show()
			.offset({left: node.position.x-15+o.left+scrollp.left, top: node.position.y-15+o.top+scrollp.top})
			.width(node.position.width+30)
			.height(node.position.height+30)
			.effect('shake',{distance:10, times:8},1000, function() {
				$('body').one('mousemove', function() {
					// Immediately show when we wiggle the mouse
					$('#findpanel').dialog('widget').stop().css('opacity',1);
					$('#scroller_overview'+svc_id).stop().css('opacity', 1);
					$('#selectrect').hide();
				});
			});
		};

		if (scrolldist_l==0 && scrolldist_t==0) {
			// No scrolling, just wiggle
			draw_and_wiggle();
		} else {
			// First scroll the workspace, then wiggle the target
			$('#selectrect').hide();
			$('#tab_diagrams'+svc_id).animate({
				scrollLeft: '-='+scrolldist_l,
				scrollTop: '-='+scrolldist_t
			}, 400, 'swing', draw_and_wiggle);
		}
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
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
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

/* ShowDetails: a dialog to edit the current project's properties
 */
function ShowDetails() {
#ifdef SERVER
	Project.UpdateStubs(true,false); // async, no need to repaint
#endif
	let p = Project.get(Project.cid);
	let snippet =`<form id="form_projectprops">
		${_H("Title:")}<br><input id="field_projecttitle" name="fld" type="text" value="${H(p.title)}"><br>
		`;
	if (!GroupSettings.localonly && p.shared) { //For standalone .localonly==true
		snippet += `<div>${_H("Creator:")} ${p.stub ? p.creator : Preferences.creator}, ${_("last stored on")} ${H(prettyDate(p.date))}.<br><br></div>`;
	}
	snippet +=`${_H("Description:")}<br><textarea id="field_projectdescription" rows="3">${H(p.description)}</textarea><br>`;
	snippet += '<div id="psettings">';
	// Private or Shared
	if (!GroupSettings.localonly) { //For standalone .localonly==false
		snippet += `<div class="psitem">${_H("Sharing: ")}<br>
		<fieldset>
			<input type="radio" id="sh_off" value="off" name="sh_onoff"><label for="sh_off">${_H("Private")}</label>
			<input type="radio" id="sh_on" value="on" name="sh_onoff"><label for="sh_on">${_H("Shared")}</label>
		</fieldset>
		</div>
		`;
	} else {
		snippet += '<div class="psitem" style="margin:0"></div>';
	}
	// Worst Plausible Actor
	snippet += `<div class="psitem">${_H("Worst plausible attacker: ")}<br>
		<select name="wpalist" id="wpalist">
			<option value="A">${_H("Customers, employees")}</option>
			<option value="B">${_H("Activists")}</option>
			<option value="C">${_H("Criminals")}</option>
			<option value="D">${_H("Competitors")}</option>
			<option value="E">${_H("State actors")}</option>
		</select>
		</div>`;
	// Iconset
	if (GroupSettings.iconsets.length>1) { //For standalone .localonly==false
		snippet += `<div class="psitem">${_H("Iconset: ")}<br>
			<select name="iconsetlist" id="iconsetlist">`;
		GroupSettings.iconsets.forEach(is => snippet += `<option value="${H(is)}">${H(is)}</option>` );
		snippet += '</select></div>';
	} else {
		snippet += '<div class="psitem"></div>';
	}
	snippet += '</div">';
	
	snippet += '</form>';
	let dialog = $('<div></div>');
	dialog.append(snippet);
	$('#wpalist').selectmenu();
	$('#iconsetlist').selectmenu();

	let dbuttons = [];
	dbuttons.push({
		text: _("Cancel"),
		click: function() {
				$(this).dialog('close');
			}
	});
	dbuttons.push({
		text: _("Change properties"),
		click: lengthyFunction(function() {
					let fname = $('#field_projecttitle').val();
					let fdescr = $('#field_projectdescription').val();
					let fwpa = $('#wpalist').val();
					let fset = $('#iconsetlist').val();
#ifdef SERVER
					let becomesShared = $('#sh_on').prop('checked');
#endif
					dialog.dialog('close');
					
					p.settitle(fname);
					$('.projectname').text(p.title);
					document.title = "Raster - " + p.title;
					Preferences.setcurrentproject(p.title);
					
					p.setdescription(fdescr);
					p.setwpa(fwpa);
					p.seticonset(fset);
#ifdef SERVER
					if (!GroupSettings.localonly) {
						if (!p.shared && becomesShared) {
							// Before changing the sharing status from 'private' to 'shared', first
							// check if there already is a project with this name. If so, refuse to rename.
							let it = new ProjectIterator({title: p.title, group: ToolGroup, stub: true});
							if (it.count()>0) {
								rasterAlert(_("Cannot share this project yet"),
									_H("There is already a project named '%%' on the server. You must rename this project before it can be shared.", p.title)
								);
							} else {
								// transactionCompleted() will take care of the server, if project p is the current project.
								p.setshared(becomesShared,false);
							}
						} else if (p.shared && !becomesShared) {
							// Stop watching the project, or we will notify ourselves about its deletion
							stopWatching(p.id);
							p.setshared(becomesShared,true);
						} else if (p.shared && becomesShared) {
							p.storeOnServer();
						}
					}
					showProjectList();
#endif
					transactionCompleted("Project props change");
			})
	});
	dialog.dialog({
		title: _("Properties for project '%%'", p.title),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		modal: true,
		width: 540, maxWidth: 540, minWidth: 540,
		buttons: dbuttons,
		open: function() {
#ifdef SERVER
			if (!GroupSettings.localonly) {
				$('#form_projectprops input[type=radio]').checkboxradio({icon: false});
				$('#form_projectprops fieldset').controlgroup();
				$('#sh_off').prop('checked',!p.shared);
				$('#sh_on').prop('checked',p.shared);
				$('input[name="sh_onoff"]').checkboxradio('refresh');
			}
			if (GroupSettings.classroom) {
				$('input[name="sh_onoff"]').checkboxradio('option','disabled',true);
			}
#endif
			$('#wpalist').val(p.wpa);
			$('#iconsetlist').val(p.iconset);
			$('#field_projecttitle').focus().select();
			$('#form_projectprops').submit(function() {
				// Ignore, must close with dialog widgets
				return false;
			});
		},
		close: function(/*event, ui*/) {
			dialog.remove();
		}
	});
}


function log10(x) { return Math.LOG10E * Math.log(x); }


/* In the code, use ⎽("blue sky") instead of "blue sky"
 * Use
 *		⎽("I have %% potatoes!", num)
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
 *
 * Note: any label |...| at the start will be deleted. This is necessary for rare cases where
 * the same English string used in different contexts requires a different translation.
 * For example, "wired link" is normally translated as "kabelverbinding", but can be translated as "kabel"
 * when space is limited. Use "wired link" -> "kabelverbinding", and "|short|wired link" -> "kabel"
 * The label 'short' indicates the type of translation requested.
 *
 * Not that we trust the translation to be safe HTML. Still, it is good practice use _H().
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
		str=s.replace(/^\|[^|]+\|/,'');	// strip leading |...|
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

/* Return an HTML-escaped version of _(s)
 */
function _H() {
	return H(_(...arguments));
}

/* testLocalStorage(): returns boolean
 * Checks whether the browser supports storing values in localStorage.
 */
#ifdef SERVER
function testLocalStorage() {
	try {
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
#endif

/* SizeDOMElements()
 * Set the size of various containers, based on the size of the browser window.
 *  - the rotation of the vertical tabs
 *  - the size of the region within the mini map
 *  - the position of the mini maps
 */
function SizeDOMElements() {
	let ww = $('#workspace').width();
	let wh = $('#workspace').height();

	$('.rot-neg-90').css('transform',
		`rotate(-90deg) translateX(-${ ww-tab_height+5 }px)`	// top-right becomes top-left, bottom-right becomes top-right
	);

	let fw = $('.fancyworkspace').width();
	let fh = $('.fancyworkspace').height();
	let scroller_w = $('.scroller_overview').width();
	let scroller_h = $('.scroller_overview').height();
	$('.scroller_region').width( (ww/fw) * scroller_w -3);	// -3 to stay within the border
	$('.scroller_region').height( (wh/fh) * scroller_h -3);

	let scroller = $('#scroller_overview'+Service.cid);
	let o = scroller.offset();
	if (!o || !o.left || !o.top) return;
	let wo = $('#workspace').offset();
	
	if (o.left+scroller_w>wo.left+ww-30) {
		let t = wo.left+ww-scroller_w-30;
		scroller.css('left', (t<wo.left+15 ? wo.left+15 : t) + 'px');
	}
	if (o.top+scroller_h>wo.top+wh-30) {
		let t = wo.top+wh-scroller_h-30;
		scroller.css('top', (t<wo.top+15 ? wo.top+15 : t) + 'px');
	}
}

function loadEmptyProject() {
	var p = new Project();
	var s = new Service(p.id);
	p.adddefaultvulns();
	p.addservice(s.id);
	s.autosettitle();
	p.autosettitle();
	switchToProject(p.id);
	transactionCompleted("Project add");
}

#ifdef SERVER
/* Load a fresh default project. If a template is defined and exists, then start a new project based on
 * that template. Otherwise, start an empty project with builtin default labels and vulnerabilities.
 */
function loadDefaultProject() {
	if (GroupSettings.templatestring) {
		let pid = loadFromString(GroupSettings.templatestring, {
			showerrors: false,
			duplicate: true,
			strsource: _("Template project '%%'", GroupSettings.teplate)
		});
		if (pid) {
			let p = Project.get(pid);
			p.autosettitle();
			p.shared = false;
			p.stub = false;
			p.store();
			switchToProject(pid);
		} else {
			loadEmptyProject();
		}
	} else {
		// Blank project
		loadEmptyProject();
	}
	populateProjectList();
}
#endif

// Remove menus, but *not* the selectrect
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
#ifdef SERVER
	stopWatching();
#endif
	removetransientwindowsanddialogs();
	$('#ccfs_details').empty();
	CurrentCluster = null;

	if (Project.get(Project.cid)!=null) {
		// Project might have been deleted by buttdel button
		Project.get(Project.cid).unload();
	}
	var p = Project.get(pid);
	p.load();
#ifdef SERVER
	refreshProjectToolbar(Project.cid);
#endif
	p.services.forEach(sid => paintSingleFailures(Service.get(sid)));
	PaintAllClusters();
	repaintCurrentAnalysis();

	var it = new ServiceIterator({project: pid, title: Preferences.service});
	if (!it.isEmpty()) {
		Service.cid = it.first().id;
	}
	forceSelectVerticalTab(Preferences.tab);
	if (dorefresh) {
		p.dorefresh(false);
	}
}

//const NilUUID = '00000000-0000-0000-0000-000000000000';

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

/* H: make a string safe to use inside HTML code */
function H(str) {
//	return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
	return $('<div></div>').text(str)[0].innerHTML;
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
function prependIfMissing(a,b) {		// eslint-disable-line no-unused-vars
	a = a.trim();
	b = b.trim();
	if (b=="") {
		return a;
	} else {
		return (b.indexOf(a)==-1 ? a+' '+b : b);
	}
}

/* reasonableString: fix str to something of reasonable length and without leading or trailing whitespace
 */
function reasonableString(str) {	// eslint-disable-line no-unused-vars
	return String(str).substr(0,MaxStringLen).trim();
}

/* Test whether two strings are identical in a locale and case-insensitive way.
*/
function isSameString(a,b) {
	return a.toLocaleUpperCase().localeCompare(b.toLocaleUpperCase())==0;
}

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
 * - the msg will take HTML content
 * - you can set the title (text only, no need to HTML-escape)
 */
function rasterAlert(title,msg) {
	let modaldialog = $('<div id="modaldialog"></div>');

	$('body').removeClass('waiting');
	modaldialog.dialog({
		title: String(title),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		modal:true,
		width: 400,
		height: 'auto',
		maxHeight: 600
	});
	modaldialog.html( String(msg) );
	modaldialog.dialog('option', 'buttons', [
		{text: _("Close"), click: function(){
			modaldialog.remove();
		} }
	]);
	console.log(String(msg));
}

/* Replacement for the standard Javascript confirm() function. Several differences:
 * - it won't block the browser (only this tab)
 * - themeable, you can set the title, the buttons and the HTML content
 * - does not return true/false, but takes a callback function as its last parameter
 *   (and optionally a function to call on Cancel/deny)
 *
 * Title and buttons are text-only and do not need to be HTML-escaped.
 * The msg can contain HTML code; use H() whenever possible.
 */
function rasterConfirm(title,msg,buttok,buttcancel,funcaction,funcnoaction) {
	let modaldialog = $('<div id="modaldialog"></div>');

	$('body').removeClass('waiting');
	modaldialog.dialog({
		title: String(title),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		modal:true,
		width: 400,
		height: 'auto',
		maxHeight: 600,
		close: function(/*event, ui*/) { modaldialog.remove(); }
	});
	modaldialog.html( String(msg) );
	modaldialog.dialog('option', 'buttons', [
		{text: buttcancel, click: function(){
			$(this).dialog('close');
			if (funcnoaction) funcnoaction();
		} },
		{text: buttok, click: function(){
			$(this).dialog('close');
			funcaction();
		} }
	]);
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus').blur();
}

function newRasterConfirm(title,msg,buttok,buttcancel) {  //eslint-disable-line no-unused-vars
	var dfd = $.Deferred();
	let modaldialog = $('<div id="modaldialog"></div>');

	$('body').removeClass('waiting');
	modaldialog.dialog({
		title: String(title),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		modal:true,
		width: 400,
		height: 'auto',
		maxHeight: 600,
		close: function(/*event, ui*/) { modaldialog.remove(); }
	});
	modaldialog.html( String(msg) );
	modaldialog.dialog('option', 'buttons', [
		{text: buttcancel, click: function(){
			$(this).dialog('close');
			dfd.reject(false);
		} },
		{text: buttok, click: function(){
			$(this).dialog('close');
			dfd.resolve(true);
		} }
	]);
	$('.ui-dialog-buttonpane button').removeClass('ui-state-focus').blur();
	return dfd.promise();
}


/* bugreport: Notify the user of a bug, save the project and block the UI.
 */
function bugreport(mess,funcname) {
	console.log('bugreport: "'+mess+'" in function "'+funcname+'".');
#ifdef SERVER
	stopWatching();
#endif
	let dialog = $('<div id="bugreport"></div>').dialog({
  		title: _H("Please report this bug"),
		dialogClass: "no-close",
		closeOnEscape: false,
		classes: {"ui-dialog-titlebar": "ui-corner-top no-close"},
		buttons: [{
			text: _("Close"),
			click: function() {
				$(this).dialog('close');
				exportAll();
				$('#splash').show();
				$('#splashstatus').html( _("Halted on error: %% in function %%.",mess,funcname) );
			}
		}]
	});
	$('#bugreport').html(_H("You found a bug in this program.")
		+ '<br><br><i>'
		+ _H("%% in function %%.", mess, funcname)
		+ '</i><br><br>'
		+ _H("This program will save your work, then halt to prevent further damage to the database.")
	);
	dialog.dialog('open');
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
 * we must also periodically check for server changes using startWatching().
 * When the remote project is deleted by another client, watching will stop. It must
 * be restarted whenever a local change is propagated to the server again.
 *
 * If the server version is deleted by another client and the local copy is not
 * changed, then the local project will be shown as 'shared' without a server version
 * being present.
 *
 */
function startWatchingCurrentProject() {
	var p = Project.get(Project.cid);
	if (p==null || !p.shared || !Preferences.online) {
		if (Preferences!=null && !Preferences.online) {
			$('#networkactivity').removeClass("activityyes activityno").addClass("activityoff");
		}
		return;
	}
	startWatching(p);
}

let SSERetriesHack = 0;
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
			if (SSERetriesHack<3) {
console.log(`SSE_PROJMON RETRIES = ${SSERetriesHack}`);
				SSERetriesHack++;
				window.setTimeout(function(){
					startWatching(p);
				},500);
			} else {
				SSERetriesHack = 0;
			}
		} else if (msg.data=="NOP") {
			// Sent periodically for testing connectivity. No action required
			SSERetriesHack = 0;
		} else  if (msg.data=="DELETED") {
			SSERetriesHack = 0;
			// Project has been deleted from the server
			let pp = Project.get(Project.cid);
			stopWatching(Project.cid);
			pp.setshared(false,false);
			removetransientwindows();
			rasterAlert( _("Project has been made private"),
				_H("Project '%%' has been deleted from the server by someone. ", pp.title)+
				_H("Your local version of the project will now be marked as private. ")+
				_H("If you wish to share your project again, you must set its details to 'Shared' yourself.")+
				"<br><p><i>"+
				_H("Your changes are not shared with others anymore.")+
				"</i>"
			);
		} else {
			SSERetriesHack = 0;
			// msg.data is the id of the last transaction on the server
			let p = Project.get(Project.cid);
			// First check for Undo/Redo: does a Transaction with id==msg.data exist behind/in front of TransactionCurrent?
			let undo=false, numundo=0;
			let tr=p.TransactionCurrent.prev;
			while (!undo && tr!=null) {
				undo = tr.id==msg.data;
				tr = tr.prev;
				if (tr==null || !tr.chain) numundo++;
			}
			let redo=false, numredo=0;
			tr=p.TransactionCurrent.next;
			while (!redo && tr!=null) {
				if (!tr.chain) numredo++;
				redo = tr.id==msg.data;
				tr = tr.next;
			}
			// All the following actions are either lengthy() or async ajax calls
			if (undo) {
				Transaction.undo(numundo,true);
			} else if (redo) {
				Transaction.redo(numredo,true);
			} else if (msg.data!=p.TransactionCurrent.id) {
				// Only fetch updates if this project is out of sync (no fetch if we caused the SSEvent outselves).
				p.getNewTransactionsFromServer();
			} else {
				// We are already up to date.
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

/* saveThenStartWatching: save current project on server, then begin monitoring from transactions posted by other clients
 */
function saveThenStartWatching() {		// eslint-disable-line no-unused-vars
	var p = Project.get(Project.cid);
	if (!p.shared || !Preferences.online) {
		if (!Preferences.online) {
			$('#networkactivity').removeClass('activityyes activityno').addClass('activityoff');
		}
		return;
	}
	// First, stop watching the file so that we do not notify ourselves
//	stopWatching(p.id);
	p.storeOnServer({auto: false});
}
#endif

/* loadFromString(str,options): with string 'str' containing an entire file, try to
 *		read and create the objects in it.
 * options is an object containing these properties (all optional):
 *	showerrors: (bool, default true) Show errors in a modal dialog.
 *	allowempty: (bool, default false) Allow input with no projects without error.
 *	strsource: (string, default "input") Name of the source, used in error messages.
 *	duplicate: (bool, default false) Renumber all objects, create fresh UUIDs.
 *
 * Side effects:
 *	- creates new objects
 *	- sets Flag_Upgrade_Done and Upgrade_Description
 * Returns the id of one of the projects loaded, or null on failure.
 *
 * Version 0 is ancient, and is not supported anymore.
 * To upgrade from version 1:
 *  - Names/titles of nodes, services and clusters are now case-insensitive. When upgrading from
 *    version 1, it may be necessary to add a sequence number to titles (or increase the one that
 *    is already there).
 *  - There is one additional label (Pink).
 *  - Plus all the upgrades necessary for version 2 and 3.
 * To upgrade from version 2:
 *  - ID's are no longer simple numbers but UUIDs. This simplifies the loading of projects, because
 *    it is not necessary to check whether an id is already in use. The use of UUID virtually guarantees
 *    that no collisions occur.
 *  - Plus all the upgrades from version 3
 * To upgrade from version 3:
 *  - Change Threat to Vulnerability; change ThreatAssessment to Assessment
 *  - Create extra Vulnerability for custom ThreatAssessments.
 */
var Flag_Upgrade_Done = false;
var Upgrade_Description = "";

function loadFromString(str,options) {
	var lProject = [];
	var lService = [];
	var lThreat = [];
	var lComponent = [];
	var lNode = [];
	var lNodeCluster = [];
	var lThrEval = [];
	var lAssmnt = [];
	var lVuln = [];

	var res, key, val;
	var upgrade_1_2 = false;
	var upgrade_2_3 = false;
	var upgrade_3_4 = false;

	if (options==null) options={};
	if (options.showerrors==null) options.showerrors=true;
	if (options.allowempty==null) options.allowempty=false;
	if (options.strsource==null) options.strsource="input";
	if (options.duplicate==null) options.duplicate=false;

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
					// Can upgrade from version 1 to version 4
					upgrade_1_2 = true;
					upgrade_2_3 = true;
					upgrade_3_4 = true;
				} else if (key[1]==2) {
					// Can upgrade from version 2 to version 4
					upgrade_2_3 = true;
					upgrade_3_4 = true;
				} else if (key[1]==3) {
					// Can upgrade from version 3 to version 4
					upgrade_3_4 = true;
				} else {
					throw new Error("The file has version ("+key[1]+"); expected version ("+LS_version+"). You must use a more recent version of the Raster tool.");
				}
			}
			val = JSON.parse(urlDecode(res[2]));
			// Integer in version 1 and 2, string in version 3 and up
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
			case 'A':
				lAssmnt.push(val);
				break;
			case 'V':
				lVuln.push(val);
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
		str = str.trim();
		if (str.length!=0) throw new Error("Invalid text");
		if (lProject.length==0 && options.allowempty)  return null;
	}		// eslint-disable-line brace-style
	catch(e) {
		if (!options.showerrors)  return null;
		$('#splash').hide();
		var errdialog = $('<div></div>');
		var s = str.substr(0,40);
		s = H(s).replace(/\s+/g," ");
		errdialog.append('<p>' + options.strsource + ' contains an error:</p>\
			<blockquote>' + e.message + '</blockquote>\
			<p>The incorrect text is:</p>\
			<blockquote>' + s + '...</blockquote>');
		errdialog.dialog({
			title: options.strsource + " contains an error",
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

	var i,j,k;
	var lProjectlen=lProject.length;
	var lThreatlen=lThreat.length;
	var lServicelen=lService.length;
	var lNodelen=lNode.length;
	var lNodeClusterlen=lNodeCluster.length;
	var lComponentlen=lComponent.length;
	var lThrEvallen=lThrEval.length;
	var lAssmntlen=lAssmnt.length;
	var lVulnlen=lVuln.length;

	try {
		if (lProjectlen==0) throw new Error('There are no projects; there must be at least one');
		if (lServicelen==0) throw new Error('There are no services; there must be at least one');
		if (lThreatlen>0 && lVulnlen>0) throw new Error('Cannot contain old-style and new-style Vulnerabilities.');
		if (lThrEvallen>0 && lAssmntlen>0) throw new Error('Cannot contain old-style and new-style Assessments.');
		for (i=0; i<lProjectlen; i++) {
			/* lProject[i].s[] must contain IDs of services */
			if (!containsAllIDs(lService,lProject[i].s)) throw new Error('Project '+lProject[i].id+' has an invalid service.');
			/* lProject[i].s must not be empty */
			if (lProject[i].s.length==0) throw new Error('Project '+lProject[i].id+' does not contain any services.');
			/* lProject[i].t[] must contain IDs of threats/vulnerabilities */
			if (lThreatlen>0 && !containsAllIDs(lThreat,lProject[i].t)) throw new Error('Project '+lProject[i].id+' has an invalid checklist.');
			if (lVulnlen>0 && !containsAllIDs(lVuln,lProject[i].t)) throw new Error('Project '+lProject[i].id+' has an invalid common vulnerability.');
			// Check at least for the projects (not for other objects) whether their id's are unique
			if (Project.get(lProject[i].id)!=null && !options.duplicate) throw new Error('Projects cannot be imported twice.');
		}
		for (i=0; i<lThreatlen; i++) {
			/* lThreat[i].p must be the ID of a project */
			if (!containsID(lProject,lThreat[i].p)) throw new Error('Vulnerability '+lThreat[i].id+' does not belong to a valid project.');
			/* lThreat[i].t must be a valid type */
			if (Rules.nodetypes[lThreat[i].t]==null) throw new Error('Vulnerability '+lThreat[i].id+' has an invalid type.');
		}
		for (i=0; i<lVulnlen; i++) {
			/* lVuln[i].p must be the ID of a project */
			if (!containsID(lProject,lVuln[i].p)) throw new Error('Vulnerability '+lVuln[i].id+' does not belong to a valid project.');
			/* lVuln[i].t must be a valid type */
			if (Rules.nodetypes[lVuln[i].t]==null) throw new Error('Vulnerability '+lVuln[i].id+' has an invalid type.');
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
			/* lComponent[i].e[] must contain IDs of threat evaluations / assessments*/
			if (lThrEvallen>0 && !containsAllIDs(lThrEval,lComponent[i].e)) throw new Error('Component '+lComponent[i].id+' has an invalid vulnerability evaluation.');
			if (lAssmntlen>0 && !containsAllIDs(lAssmnt,lComponent[i].e)) throw new Error('Component '+lComponent[i].id+' has an invalid assessment.');
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
			if (Assessment.values.indexOf(lThrEval[i].p)==-1) throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid frequency.');
			/* lThrEval[i].i must be a valid frequency/impact string */
			if (Assessment.values.indexOf(lThrEval[i].i)==-1) throw new Error('Vulnerability assessment '+lThrEval[i].id+' has an invalid impact.');
		}
		for (i=0; i<lAssmntlen; i++) {
			/* lAssmnt[i].t must be a valid type */
			if (Rules.nodetypes[lAssmnt[i].t]==null) throw new Error('Assessment '+lAssmnt[i].id+' has an invalid type.');
			/* lAssmnt[i].m, if non-null, must be the ID of a Component */
			if (lAssmnt[i].m!=null && !containsID(lComponent,lAssmnt[i].m)) throw new Error('Assessment '+lAssmnt[i].id+' does not belong to a valid component.');
			/* lAssmnt[i].u, if non-null, must be the ID of a NodeCluster */
			if (lAssmnt[i].u!=null && !containsID(lNodeCluster,lAssmnt[i].u)) throw new Error('Assessment '+lAssmnt[i].id+' does not belong to a valid cluster.');
			/* lAssmnt[i].v, if non-null, must be the ID of a Vulnerability */
			if (lAssmnt[i].v!=null && !containsID(lVuln,lAssmnt[i].v)) throw new Error('Assessment '+lAssmnt[i].id+' does not belong to a valid Vulnerability.');
			/* lAssmnt[i].p must be a valid frequency/impact string */
			if (Assessment.values.indexOf(lAssmnt[i].p)==-1) throw new Error('Assessment '+lAssmnt[i].id+' has an invalid frequency.');
			if (Assessment.values.indexOf(lAssmnt[i].i)==-1) throw new Error('Assessment '+lAssmnt[i].id+' has an invalid impact.');
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
			/* lNodeCluster[i].e must be the ID of a threat evaluation / assessment */
			if (lThrEvallen>0 && !containsID(lThrEval,lNodeCluster[i].e)) throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid vulnerability evaluation.');
			if (lAssmntlen>0 && !containsID(lAssmnt,lNodeCluster[i].e)) throw new Error('Node cluster '+lNodeCluster[i].id+' contains an invalid assessment.');
		}
	}		// eslint-disable-line brace-style
	catch (e) {
		if (DEBUG) console.log("Error: "+e.message);
		if (!options.showerrors)  return null;
		$('#splash').hide();
		errdialog = $('<div></div>');
		errdialog.append('<p>' + options.strsource + ' contains an error:</p>\
			<blockquote>' + H(e.message) + '</blockquote>');
		errdialog.dialog({
			title: options.strsource + " is not valid",
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

	if (upgrade_2_3 || options.duplicate) {
		/* Before version 3, IDs were numerical instead of UUIDs, so replace those.
		 * Also replace IDs when options.duplicate==true
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
		// These are not necessary for upgrade_2_3, but for options.duplicate
		for (i=0; i<lVulnlen; i++) {
			lVuln[i].oldid = lVuln[i].id;
			lVuln[i].id = createUUID();
		}
		for (i=0; i<lAssmntlen; i++) {
			lAssmnt[i].oldid = lAssmnt[i].id;
			lAssmnt[i].id = createUUID();
		}

		for (i=0; i<lProjectlen; i++) {
			// Replace Service and Threat/Vulnerability ids
			if (upgrade_2_3) {
				for (k=0; k<lThreatlen;  k++)  arrayReplace(lProject[i].t, lThreat[k].oldid, lThreat[k].id);
			} else {
				for (k=0; k<lVulnlen;  k++)  arrayReplace(lProject[i].t, lVuln[k].oldid, lVuln[k].id);
			}
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
			// Replace project, nodes, and (threat)assessment ids
			for (k=0; k<lProjectlen; k++)  lComponent[i].p = (lComponent[i].p==lProject[k].oldid ? lProject[k].id : lComponent[i].p);
			for (k=0; k<lNodelen;    k++)  arrayReplace(lComponent[i].n, lNode[k].oldid, lNode[k].id);
			if (upgrade_2_3) {
				for (k=0; k<lThrEvallen; k++)  arrayReplace(lComponent[i].e, lThrEval[k].oldid, lThrEval[k].id);
			} else {
				for (k=0; k<lAssmntlen; k++)  arrayReplace(lComponent[i].e, lAssmnt[k].oldid, lAssmnt[k].id);
			}
		}
		for (i=0; i<lThrEvallen; i++) {
			// Replace component, cluster ids
			for (k=0; k<lComponentlen;   k++)  lThrEval[i].m = (lThrEval[i].m==lComponent[k].oldid ? lComponent[k].id : lThrEval[i].m);
			for (k=0; k<lNodeClusterlen; k++)  lThrEval[i].u = (lThrEval[i].u==lNodeCluster[k].oldid ? lNodeCluster[k].id : lThrEval[i].u);
		}
		for (i=0; i<lNodeClusterlen; i++) {
			// Replace project, (threat)assessment, parentcluster, childclusters, nodes
			for (k=0; k<lProjectlen;     k++)  lNodeCluster[i].p = (lNodeCluster[i].p==lProject[k].oldid ? lProject[k].id : lNodeCluster[i].p);
			if (upgrade_2_3) {
				for (k=0; k<lThrEvallen;     k++)  lNodeCluster[i].e = (lNodeCluster[i].e==lThrEval[k].oldid ? lThrEval[k].id : lNodeCluster[i].e);
			} else {
				for (k=0; k<lAssmntlen;     k++)  lNodeCluster[i].e = (lNodeCluster[i].e==lAssmnt[k].oldid ? lAssmnt[k].id : lNodeCluster[i].e);
			}
			for (k=0; k<lNodeClusterlen; k++)  lNodeCluster[i].u = (lNodeCluster[i].u==lNodeCluster[k].oldid ? lNodeCluster[k].id : lNodeCluster[i].u);
			for (k=0; k<lNodeClusterlen; k++)  arrayReplace(lNodeCluster[i].c, lNodeCluster[k].oldid, lNodeCluster[k].id);
			for (k=0; k<lNodelen;        k++)  arrayReplace(lNodeCluster[i].n, lNode[k].oldid, lNode[k].id);
		}
		for (i=0; i<lVulnlen; i++) {
			// Replace project id
			for (k=0; k<lProjectlen; k++)  lVuln[i].p = (lVuln[i].p==lProject[k].oldid ? lProject[k].id : lVuln[i].p);
		}
		for (i=0; i<lAssmntlen; i++) {
			// Replace component, cluster ids
			for (k=0; k<lVulnlen;        k++)  lAssmnt[i].v = (lAssmnt[i].v==lVuln[k].oldid ? lVuln[k].id : lAssmnt[i].v);
			for (k=0; k<lComponentlen;   k++)  lAssmnt[i].m = (lAssmnt[i].m==lComponent[k].oldid ? lComponent[k].id : lAssmnt[i].m);
			for (k=0; k<lNodeClusterlen; k++)  lAssmnt[i].u = (lAssmnt[i].u==lNodeCluster[k].oldid ? lNodeCluster[k].id : lAssmnt[i].u);
		}
	}

	function isroot(id) {
		for (let i=0; i<lNodeClusterlen; i++) {
			let nc = lNodeCluster[i];
			if (nc.id==id && nc.u==null) return true;
		}
		return false;
	}
	function componentproject(id) {
		for (let i=0; i<lComponentlen; i++) {
			if (lComponent[i].id==id) return lComponent[i].p;
		}
		return null;
	}
	function clusterproject(id) {
		for (let i=0; i<lNodeClusterlen; i++) {
			if (lNodeCluster[i].id==id) return lNodeCluster[i].p;
		}
		return null;
	}

	if (upgrade_3_4) {
		// Give all projects the Classic iconset
		for (i=0; i<lProjectlen; i++) {
			lProject[i].i = 'Classic';
		}
		// Promote Threats to Vulnerabilities
		for (i=0; i<lThreatlen; i++) {
			let th = lThreat[i];
			lVuln.push({
				id: th.id,
				p: th.p,
				t: th.t,
				l: th.l,
				d: th.d,
				c: true
			});
			lVulnlen = lVuln.length;
		}
		// Promote ThreatAssessments to Assessments
		for (i=0; i<lThrEvallen; i++) {
			let te = lThrEval[i];
			let vln = null;
			if (te.m!=null || isroot(te.u)) {
				// Find an existing Vulnerability
				for (let j=0; j<lVulnlen; j++) {
					let v = lVuln[j];
					if (v.l==te.l && v.t==te.t) {
						vln = v;
						break;
					}
				}
				if (!vln) {
					// Vulnerability did not exist; must be a custom vulnerability. Add it.
					vln = {
						id: createUUID(),
						p: (te.m ? componentproject(te.m) : clusterproject(te.u)),
						t: te.t,
						l: te.l,
						d: te.d,
						c: false
					};
					lVuln.push(vln);
					lVulnlen++;
				}
			}
			lAssmnt.push({
				id: te.id,
				t: te.t,
				v: (vln ? vln.id : null),
				m: te.m,
				u: te.u,
				l: (vln ? null : te.l),
				p: te.p,
				i: te.i,
				r: te.r
			});
		}
		lAssmntlen = lAssmnt.length;
	}
	
	// Append a sequence number to the title of str,
	// or increase the number it it already had one.
	function titleincrement(str){
		let seq = str.match(/^(.+) \((\d+)\)$/);
		if (seq==null) {
			return str + ' (1)';
		} else {
			seq[2]++;
			return seq[1] + ' (' + seq[2] + ')';
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
					lService[j].l = titleincrement(lService[j].l);
					Flag_Upgrade_Done = true;
					Upgrade_Description += '<LI>' + _H("Services '%%' and '%%'.", ls.l, lService[j].l);
				}
			}
		}
		s.settitle(ls.l);
	}
	for (i=0; i<lVulnlen; i++) {
		var lv = lVuln[i];
		var vln = new Vulnerability(lv.p,lv.t,lv.id);
		vln.setdescription(lv.d);
		if (upgrade_1_2) {
			// Check if there is another Vulnerability in this project with the same type and case-insensitive name
			for (j=i+1; j<lVulnlen; j++) {
				if (lv.p==lVuln[j].p && lv.t==lVuln[j].t && isSameString(lv.l,lVuln[j].l)) {
					var oldtitle, newtitle;
					oldtitle = lVuln[j].l;
					newtitle = titleincrement(oldtitle);
					lVuln[j].l = newtitle;
					// Now change this title too in the Assessments of all top-level NodeClusters of this project.
					for (k=0; k<lNodeClusterlen; k++) {
						if (lNodeCluster[k].p==lv.p && lNodeCluster[k].u==null && lNodeCluster[k].l==oldtitle) {
							lNodeCluster[k].l = newtitle;
						}
					}

					Flag_Upgrade_Done = true;
					Upgrade_Description += '<LI>' + _H("Vulnerabilities '%%' and '%%'.", oldtitle, newtitle);
				}
			}
		}
		vln.settitle(lv.l);
		vln.setcommon(lv.c);
		vln.setmalice(lv.m);
	}
	for (i=0; i<lProjectlen; i++) {
		var lp = lProject[i];
		var p = new Project(lp.id);
		p.settitle(String(lp.l));
		p.shared = (lp.a===true);
		if (lp.g) p.group = lp.g;
		if (lp.d) p.description = lp.d;
		if (lp.w) p.date = lp.w;
		if (lp.i) p.iconset = lp.i;
		if (lp.q) p.wpa = lp.q;
		for (k=0; k<lp.s.length; k++) {
			p.addservice(lp.s[k]);
		}
		p.vulns = lp.t.slice(0); // Omit the "-1" property, if it exists
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
		rn.title = lrn.l.trim();
		if (lrn.f) rn.suffix = lrn.f.trim();
		rn.position = {x: lrn.x, y: lrn.y, width: lrn.w, height: lrn.h};
		rn.component = lrn.m;
		rn.connect = lrn.c.slice(0);
		if (lrn.o) rn.color = lrn.o;
		if (lrn.i) rn.icon = lrn.i;
		rn.store();
	}
	for (i=0; i<lComponentlen; i++) {
		var lc = lComponent[i];
		var cm = new Component(lc.t,lc.p,lc.id);
		cm.assmnt = lc.e.slice(0);
		cm.nodes = lc.n.slice(0); // Omit the "-1" property, if it exists;
		cm.single = (lc.s===true);
		cm.accordionopened = (lc.o===true);
		if (upgrade_1_2) {
			// Check if there is another Component in this project with the same case-insensitive name
			for (j=i+1; j<lComponentlen; j++) {
				if (lc.p==lComponent[j].p && isSameString(lc.l,lComponent[j].l)) {
					// Append a sequence number to the title of lComponent[j],
					// or increase the number if it already had one.
					oldtitle = lComponent[j].l;
					newtitle = titleincrement(oldtitle);
					lComponent[j].l = newtitle;
					Flag_Upgrade_Done = true;
					Upgrade_Description += '<LI>' + _H("Components '%%' and '%%'.", lc.l, lComponent[j].l);
				}
			}
		}
		cm.title = lc.l;
		if (upgrade_1_2) {
			// Component title may have been made unique case-insensitive
			for (const n of cm.nodes) {
				rn = Node.get(n);
				rn.settitle(cm.title);
				rn.store();
			}
		}
		cm.store();
		// Delay calculation until Assessments have been loaded
		//cm.calculatemagnitude();
	}
	for (i=0; i<lAssmntlen; i++) {
		let lv = lAssmnt[i];
		let assmnt = new Assessment(lv.t,lv.id);
		if (lv.v) {
			assmnt.vulnerability=lv.v;
		} else {
			assmnt.settitle(lv.l);
		}
		assmnt.freq=lv.p;
		assmnt.impact=lv.i;
		assmnt.remark=lv.r;
		assmnt.computetotal();
		assmnt.component=lv.m;
		assmnt.cluster=lv.u;
		assmnt.store();
	}
	for (i=0; i<lNodeClusterlen; i++) {
		var lnc = lNodeCluster[i];
		var nc = new NodeCluster(lnc.t,lnc.id);
		nc.title = lnc.l;
		nc.project = lnc.p;
		nc.parentcluster = lnc.u;
		nc.childclusters = lnc.c.slice(0); // Omit the "-1" property, if it exists;
		nc.childnodes = lnc.n.slice(0); // Omit the "-1" property, if it exists
		nc.assmnt = lnc.e;
		nc.accordionopened = (lnc.o===true);
		//nc.calculatemagnitude(); // Not all childclusters may have been loaded
		nc.store();
	}

	// As from version 3, there should be rootclusters for each Vulnerability
	for (i=0; upgrade_2_3 && i<lVulnlen; i++) {
		lv = lVuln[i];
		let it = new NodeClusterIterator({project: lv.p, title: lv.l, type: lv.t, isroot: true});
		// If the project has a rootcluster with that type and title, then OK.
		if (it.count()>0)  continue;
		// else make sure that a stub rootcluster exists, and has a threat assessment.
		nc = new NodeCluster(lv.t);
		nc.setproject(lv.p);
		nc.settitle(lv.l);
		nc.addassessment();
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
		_H("Your project was updated to a newer version. Some names of components and other items have been altered.")
		+ '<UL>' + Upgrade_Description + '</UL>'
	);
}

///* Find the lowest unused number in arr. Array arr must not contain negative numbers.
// */
//function lowestunused(arr) {
//	var lu = 0;
//	arr.sort(function(a,b){return a - b;});
//	for (var i=0,alen=arr.length; i<alen; i++) {
//		if (lu<arr[i]) break;
//		lu=arr[i]+1;
//	}
//	return lu;
//}

#ifdef SERVER
/* singleProjectExport(p): save all data into a local file.
 */
function singleProjectExport(p) {
	let proj = Project.get(p);
	saveStringAsRasterFile(exportProject(p),proj.title);
//	$('#exp_name').val(proj.title);
//	$('#exp_contents').val(s);
//	$('#exp_form').submit();
}
#endif

function exportProject(pid) {
	let p = Project.get(pid);
	let s = "";
	// We must ignore the date on export. It must be preserved in localStorage, but
	// like the creator it is not part of the project data. It is metadata, stored
	// and retrieved by the server separately from the project data.
	let olddate = p.date;
	p.date = "";
	s += p.exportstring(p.TransactionCurrent.id);
	p.date = olddate;
	let it;
	it = new AssessmentIterator({project: pid});
	it.forEach(obj => s+=obj.exportstring());
	it = new ComponentIterator({project: pid});
	it.forEach(obj => s+=obj.exportstring());
	it = new NodeIterator({project: pid});
	it.forEach(obj => s+=obj.exportstring());
	it = new NodeClusterIterator({project: pid});
	it.forEach(obj => s+=obj.exportstring());
	it = new ServiceIterator({project: pid});
	it.forEach(obj => s+=obj.exportstring());
	it = new VulnerabilityIterator({project: pid});
	it.forEach(obj => s+=obj.exportstring());
	return s;
}

/* dateAsAstring: returns the current datetime as string "YYYYMMDD HHMM SS"
 */
function dateAsAstring() {
	let dt = new Date();
	let x;
	let s = '';
	s += dt.getFullYear();
	x = dt.getMonth()+1;
	s += (x<10?'0':'')+x;
	x = dt.getDate();
	s += (x<10?'0':'')+x;
	s += ' ';
	x = dt.getHours();
	s += (x<10?'0':'')+x;
	x = dt.getMinutes();
	s += (x<10?'0':'')+x;
	s += ' ';
	x = dt.getSeconds();
	s += (x<10?'0':'')+x;
	return s;
}

/* saveStringAsRasterFile: make the browser download a Raster file using a given filename
 * s: (String) contents of the new file
 * name: (String) filename in which to save string s
 * append: (Boolean, default true) append a datetime string and extension to the filename
 */
function saveStringAsRasterFile(s,name, append=true) {
	if (append) name += ` ${dateAsAstring()}.raster`;
	let fileBlob = new Blob([s], {type: 'text/x-raster'});
	let url = window.URL.createObjectURL(fileBlob);
	let anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	window.URL.revokeObjectURL(url);
	// the line below gives a DOMException
//	document.removeChild(anchor);
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
//	var url = 'data:text/x-raster;,' + urlEncode(s);
//	document.location.assign(url);
	saveStringAsRasterFile(s,'exportall');
}

const TabWorkDia = 0;
const TabWorkSF  = 1;
const TabWorkCCF = 2;
const TabWorkAna = 3;

function forceSelectVerticalTab(n) {
	$('#workspace').tabs('option','active',n);
	vertTabSelected();
}

/* vertTabSelected(event,ui)
 * Event 'event' selects the vertical tab 'ui' of the main window.
 */
function vertTabSelected(/*event, ui*/) {
	removetransientwindowsanddialogs();
	$('#tb_home .toolbarsection').hide();
	switch ($('#workspace').tabs('option','active')) {
	case TabWorkDia:
		$('#diaopts').show();
		$('#projectpropsection').show();
		// Switch to the right service. A new service may have been created while working
		// in the Single Failures tab.
		$('#tab_diagramstabtitle'+Service.cid).trigger('click');
		// The click won't do anything if that service was already selected, so make sure the repaint occurs.
		Service.get(Service.cid)._jsPlumb.repaintEverything();
		Preferences.settab(0);
		break;
	case TabWorkSF:
		$('#sfopts').show();
		$('#tab_singlefstabtitle'+Service.cid).trigger('click');
		Preferences.settab(1);
		break;
	case TabWorkCCF:
		$('#ccfopts').show();
		Preferences.settab(2);
		break;
	case TabWorkAna:
		repaintCurrentAnalysis();
		Preferences.settab(3);
		break;
	default:
		bugreport('unknown tab encountered','vertTabSelected');
	}
}

/* Reset the tool. Useful from the CLI when debugging */
function Zap() {
	localStorage.clear();
	// Preserve the user's preferences
	Preferences.settab(0);
	lengthy(function() {
		window.location.reload();
	});
}

/* Show an alert if there are any errors in the projects (e.g. in a newly loaded project).
 * If verbose, show an explicit alert to say that there are no errors.
 * Import checks are not as thorough as the internal consistency checks on components.
 * Therefore, it is a good idea to checkForErrors after importing a project.
 */
function checkForErrors(verbose) {
	let errors = '';
	let projects = new Set();
	let it = new ProjectIterator();
	it.sortByTitle();
	for (const p of it) {
		projects.add(p.id);
		let err = p.internalCheck();
		if (err!='') {
			var e = err.split('\n');
			//e.sort();
			if (errors!='') errors += '<p>';
			errors += _("Project <i>%%</i>:\n", H(p.title)) + e.join('<br>\n');
		}
	}
	// Add checks for stuff outside projects
	let err = '';
	it = new VulnerabilityIterator();
	for (const v of it) {
		if (!projects.has(v.project)) {
			err += _H("Vulnerability %% does not belong to any known project.", v.id);
			err += '<br>';
		}
	}
	it = new ComponentIterator();
	for (const cm of it) {
		if (!projects.has(cm.project)) {
			err += _H("Component %% does not belong to any known project.", cm.id);
			err += '<br>';
		}
	}
	it = new ServiceIterator();
	for (const s of it) {
		if (!projects.has(s.project)) {
			err += _H("Service %% does not belong to any known project.", s.id);
			err += '<br>';
		}
	}
	it = new NodeClusterIterator();
	for (const cl of it) {
		if (!projects.has(cl.project)) {
			err += _H("Cluster %% does not belong to any known project.", cl.id);
			err += '<br>';
		}
	}
	if (err!='') {
		if (errors!="") errors += '<p>';
		errors += err;
	}

	if (verbose && errors=='') {
		rasterAlert(_("Checked all projects"), _H("There were no errors; all projects are OK.\n"));
	}
	if (errors!='') {
		rasterAlert(_("Your projects contain errors:"), errors);
	}
}

function bottomTabsCloseHandler(event) {
	var p = Project.get(Project.cid);
	if (p.services.length==1) {
		$('#tab_diagrams'+p.services[0]).effect('pulsate', { times:2 }, 800);
		return;
	}
	$('#selectrect').hide();
	var s = Service.get(nid2id(event.target.id));
	rasterConfirm(_("Delete service?"),
		_H("Are you sure you want to remove service '%%' from project '%%'?", s.title, p.title),
		_("Remove service"),_("Cancel"),
		function() {
			let nodes = [];
			var it = new NodeIterator({service: s.id});
			it.forEach(rn => nodes.push(rn.id));
			if (nodes.length!=0) nodesDelete(nodes,_("Remove service %%", s.title),true);
			new Transaction('serviceCreate',
				[{id: s.id, project: s.project, title: s.title, index: p.services.indexOf(s.id)}],
				[{id: s.id, project: s.project}],
				_("Remove service %%", s.title)
			);
		}
	);
}

function bottomTabsShowHandlerDiagrams(event,ui) {
	/* ui.newPanel.selector is the DOM object with id #tabtitle<nn> */
	if (!ui.newPanel)  return;
	var id = nid2id(ui.newPanel[0].id);
	$('#selectrect').hide();
	// Reattach the selectrect within this diagram
	// Attach to diagrams_workspace *not* to tab_diagrams, because then the mousup event is sometimes not fired,
	// probably because it happens to occur *on* the selectrect. Mousemoves over the selectrect also do not register
	// on diagrams_workspace then.
	$('#selectrect').detach().appendTo('#diagrams_workspace'+id);
	removetransientwindowsanddialogs();
	Service.cid = id;
//	$('.scroller_overview').hide();
//	if (Preferences.showmap) $('#scroller_overview'+id).show();
	Service.get(id)._jsPlumb.repaintEverything();
}

function bottomTabsShowHandlerSFaults(event,ui) {
	/* ui.newPanel.selector is the DOM object with id #tabtitle<nn> */
	if (!ui.newPanel) return;
	let id = nid2id(ui.newPanel[0].id);
	Service.cid = id;
	let s = Service.get(id);
	let currorder = $('input[name=sfsort]:checked').val();
	if (s.sfsortorder!=currorder) {
		// Repaint if the sort order has changed
		paintSingleFailures(s);
	}
}

function initTabDiagrams() {
	initChecklistsDialog('tWLS');
	initChecklistsDialog('tWRD');
	initChecklistsDialog('tEQT');
	
	$('#componentthreats').dialog({
		closeOnEscape: false,
		autoOpen: false,
		minHeight: 180,
		minWidth: 775,
		maxWidth: 779,
		width: 775,
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		create: function() {
			// Add vulnerability
			$('<div id="dthadddia" class="titlebarbutton"></div>')
			.appendTo($(this).dialog('widget').children('.ui-dialog-titlebar'));
			$('#dthadddia').button({label: _("+ Add vulnerability")});
			// Copy button
			$(`<div id="dthcopydia" class="titlebaricon" title="${_("Copy")}"><img src="../img/ccopy.png" alt="${_("Copy")}"></div>`)
			.appendTo($(this).dialog('widget').children('.ui-dialog-titlebar'));
			$('#dthcopydia').button();
			// Paste button
			$(`<div id="dthpastedia" class="titlebaricon" title="${_("Paste")}"><img src="../img/cpaste.png" alt="${_("Paste")}"></div>`)
			.appendTo($(this).dialog('widget').children('.ui-dialog-titlebar'));
			$('#dthpastedia').button();
		}
	});
	$('#dthadddia').on('click', function() {return addvulnhandler(Component.ThreatsComponent);} );
	$('#dthcopydia').on('click',  function() {
		var cm = Component.get(Component.ThreatsComponent);
		Assessment.Clipboard = [];
		for (const tid of cm.assmnt) {
			var te = Assessment.get(tid);
			Assessment.Clipboard.push({t: te.title, y: te.type, d: te.description, p: te.freq, i: te.impact, r: te.remark});
		}
	});
	$('#dthpastedia').on('click',  function() {
		var cm = Component.get(Component.ThreatsComponent);
		cm.mergeclipboard();
	});

	$('#tab_diagrams').tabs({
		activate: bottomTabsShowHandlerDiagrams,
		create: bottomTabsShowHandlerDiagrams,
		classes: {
			"ui-tabs": "ui-corner-bottom ui-corner-tl",
			"ui-tabs-nav": "ui-corner-bottom",
			"ui-tabs-tab": "ui-corner-bottom"
		}
	});
	$('#tab_diagrams').on('click', 'span.tabcloseicon', bottomTabsCloseHandler);
	$('#bottomtabsdiagrams').on('mouseenter', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-close').addClass('ui-icon-circle-close');
	});
	$('#bottomtabsdiagrams').on('mouseleave', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-circle-close').addClass('ui-icon-close');
	});

	$('.th_mal.thr_header').text( _("Cause") );
	$('.th_name.thr_header').text( _("Name") );
	$('.th_descr.thr_header').text( _("Description") );
	$('.addthreatbutton').val( _("+ Add vulnerability"));
	$('.copybutton').val( _("Copy"));
	$('.pastebutton').val( _("Paste"));

	$('#mi_th span').text( _("Vulnerabilities...") );
	$('#mi_ci span').text( _("Icon") );
	$('#mi_ct span').text( _("Type") );
	$('#mi_cttWLS span').text( _("Wireless link") );
	$('#mi_cttWRD span').text( _("Wired link") );
	$('#mi_cttEQT span').text( _("Equipment") );
	$('#mi_cttACT span').text( _("Actor") );
	$('#mi_cttUNK span').text( _("Unknown link") );
	$('#mi_cl span').text( _("Class") );
	$('#mi_rc span').text( _("Rename class") );
	$('#mi_sx span').text( _("Rename suffix") );
	// Menu item Similar/Identical is handled inside Nodecluster:_showpopupmenu()
	$('#mi_du span').text( _("Duplicate") );
	$('#mi_de span').text( _("Delete") );
	$('#mi_ccnone span').text( _("No label") );
	$('#mi_ccedit span').text( _("Edit labels...") );
//	$('#nodemenu li.lcT span').text(_("Node"));
	$('#nodemenu').menu().hide();

	$('#mi_sd span').text( _("Delete selection") );
	$('#mi_sc span').text( _("Label") );
	$('#mi_scnone span').text( _("No label") );
	$('#mi_scedit span').text( _("Edit labels...") );
	$('#selectmenu li.lcT span').text(_("Selection"));
	$('#selectmenu').menu().hide();
	$('#selectrect').on('contextmenu', showSelectMenu);
	$('#selectrect').on('click', function(evt) {
		if (evt.button==0)  $('#selectmenu').hide(); // left mousebutton
	});
	$('#selectrectC').on('click', showSelectMenu);

	$('#nodereport').dialog({
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		autoOpen: false,
		minHeight: 80
	});

	// This wil set the behavior of the plus-button on the SF tab as well
	$('.servplusbutton').on('click', function() {
		let newid = createUUID();
		let newtitle = Service.autotitle(Project.cid);
		new Transaction('serviceCreate',
			[{id: newid, project: Project.cid}],
			[{id: newid, project: Project.cid, title: newtitle}],
			_("Add a service")
		);
	});

	$('#templates').on('mouseenter', function() {
		$('.tC').show();
	}).on('mouseleave',function() {
		$('.tC').hide();
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
		displayComponentThreatAssessmentsDialog(rn.component,e);
	});
	$('#mi_ci').on('click', 'li', function(evt) {
		let icn = $(evt.currentTarget).attr('foricon');
		let rn = Node.get( $('#nodemenu').data('menunode') );
		$('#nodemenu').hide();
		if (rn.component==null) {
			new Transaction('nodeIconChange',[{id: rn.id, icon: rn.icon}],[{id: rn.id, icon: icn}], _("Change icon for %%",rn.title));
		} else {
			// Change all nodes for this component
			let undo_data = [];
			let do_data = [];
			let cm = Component.get(rn.component);
			cm.nodes.forEach(nid => {
				let nd = Node.get(nid);
				undo_data.push({id: nd.id, icon: nd.icon});
				do_data.push({id: nd.id, icon: icn});
			});
			new Transaction('nodeIconChange',undo_data,do_data, _("Change icons for %%",rn.title));
		}
	});

	function ctfunction(t) {
		return function() {
			$('#nodemenu').hide();
			let rn = Node.get( $('#nodemenu').data('menunode') );
			let newid = createUUID();
			let newcmid = createUUID();
			// Two simultaneous transactions, both for do and undo: create new node, destroy old node
			// We first do the creation of the new node
			let do_data={nodes: [], clusters: []}, undo_data={nodes: [], clusters: []};
			do_data.nodes.push({
				id: newid,
				type: t,
				title: Node.autotitle(t,rn.title),
				suffix: 'a',
				service: rn.service,
				label: rn.color,
				x: rn.position.x,
				y: rn.position.y,
				connect: rn.connect.slice(),
				component: newcmid,
				assmnt: Project.get(rn.project).defaultassessmentdata(t),
				accordionopened: false
			});
			undo_data.nodes.push({id: newid});
			// Now do the deletion of the old node
			do_data.nodes.push({id: rn.id});
			let ud = {
				id: rn.id,
				type: rn.type,
				title: rn.title,
				suffix: rn.suffix,
				service: rn.service,
				label: rn.color,
				x: rn.position.x,
				y: rn.position.y,
				width: rn.position.width,
				height: rn.position.height,
				connect: rn.connect.slice()
			};
			if (rn.component) {
				let cm = Component.get(rn.component);
				ud.component = cm.id;
				ud.accordionopened = cm.accordionopened;
				ud.assmnt = cm.assessmentdata();
			}
			undo_data.nodes.push(ud);
			undo_data.clusters = NodeCluster.structuredata(rn.project);
			new Transaction('nodeCreateDelete', undo_data, do_data, _("Change type"));
		};
	}
	$('#mi_cttWLS').on('mouseup', ctfunction('tWLS'));
	$('#mi_cttWRD').on('mouseup', ctfunction('tWRD'));
	$('#mi_cttEQT').on('mouseup', ctfunction('tEQT'));
	$('#mi_cttACT').on('mouseup', ctfunction('tACT'));
	$('#mi_cttUNK').on('mouseup', ctfunction('tUNK'));

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
			classes: {"ui-dialog-titlebar": "ui-corner-top"},
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
			classes: {"ui-dialog-titlebar": "ui-corner-top"},
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
		let rn = Node.get( $('#nodemenu').data('menunode') );
		// Actors and notes don't have components
		if (rn.component==null)  return;

		let cm = Component.get(rn.component);
		if (!cm.single) {
			// Only allow Class to become singular iff there is at most one member node per service
			let count = {};
			for (const s of Project.get(cm.project).services) count[s]=0;
			for (const n of cm.nodes) count[Node.get(n).service]++;
			for (const s in count) {
				if(count[s]<2) continue;
				// Flash the offending nodes
				for (const n of cm.nodes) $('#node'+n).effect('pulsate', { times:2 }, 800);
				return;
			}
		}
		new Transaction('classSingular',
			[{id: cm.id, singular: cm.single}],
			[{id: cm.id, singular: cm.single==false}],
			_("singular/class")
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
			new Transaction('nodeCreateDelete', {
					nodes: [{id: newid}],
					clusters: []
				}, {
					nodes: [{
						id: newid,
						type: rn.type,
						service: rn.service,
						title: Node.autotitle(rn.type,rn.title),
						x: (rn.position.x > fw/2 ? rn.position.x-70 : rn.position.x+70) + Math.random()*20 - 10,
						y: (rn.position.y > fh/2 ? rn.position.y-30 : rn.position.y+30) + Math.random()*20 - 10,
						width: rn.position.width,
						height: rn.position.height,
						label: rn.color,
						connect: []
					}],
					clusters: []
				},
				_("Duplicate node")
			);
			return;
		}

		new Transaction('nodeCreateDelete', {
				nodes: [{id: newid}],
				clusters: []
			}, {
				nodes: [{
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
					icon: rn.icon,
					connect: []
				}],
				clusters: []
			},
			_("Duplicate")
		);
	});
	function colorfunc(c) {
		return function() {
			$('#nodemenu').hide();
			var rn = Node.get( $('#nodemenu').data('menunode') );
			new Transaction('nodeLabel',
				[{id: rn.id, label: rn.color}],
				[{id: rn.id, label: c}],
				_("Change color to %%",c)
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
					new Transaction('nodeCreateDelete', {
							nodes: [{
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
							clusters: []
						}, {
							nodes: [{id: rn.id}],
							clusters: []
						},
						_("Delete node")
					);
					return;
				}

				let cm = Component.get(rn.component);
				new Transaction('nodeCreateDelete', {
						nodes: [{
							id: rn.id,
							type: rn.type,
							service: rn.service,
							title: rn.title,
							suffix: rn.suffix,
							x: rn.position.x,
							y: rn.position.y,
							component: rn.component,
							assmnt: cm.assessmentdata(),
							accordionopened: cm.accordionopened,
							single: (cm.single ? cm.nodes[0] : false),
							width: rn.position.width,
							height: rn.position.height,
							label: rn.color,
							connect: rn.connect.slice()
							}],
						clusters: NodeCluster.structuredata(rn.project)
					}, {
						nodes: [{id: rn.id}],
						clusters: []
					},
					_("Delete node")
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
		for (const n of nodes) $(Node.get(n).jnid).effect('pulsate', { times:10 }, 4000);
		rasterConfirm(_("Delete %% %% in selection?", num, plural(_("node"),_("nodes"),num)),
			_H("Are you sure you want to delete all selected nodes?"),
			_("Delete %% %%", num, plural(_("node"),_("nodes"),num)),_("Cancel"),
			function() {
				// Stop any leftover pulsate effects
				for (const n of nodes) $(Node.get(n).jnid).stop(true,true);
				nodesDelete(nodes, _("Delete selection"), false);
				$('#selectrect').hide();
			},
			function() {
				// Stop any leftover pulsate effects
				for (const n of nodes) $(Node.get(n).jnid).stop(true,true).show().css("opacity","");
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
			for (const n of nodes) {
				let rn = Node.get(n);
				undo_data.push({id: n, label: rn.color});
				data.push({id: n, label: c});
			}
			new Transaction('nodeLabel', undo_data, data, _("Change color to %%",c));
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
			// To create a new common vulnerability:
			// - create the vulnerability
			// - add a corresponding assessment to all matching components for the vulnerability type
			let vid = createUUID();
			let clid = createUUID();
			let claid = createUUID();
			let p = Project.get(Project.cid);
			let newtitle = Vulnerability.autotitle(p.id);
			let it = new ComponentIterator({project: p.id, match: typ});
			let chain = (it.count()>0);
			new Transaction('vulnCreateDelete',[{
					create: false,
					id: vid
				}],[{
					create: true,
					id: vid,
					project: p.id,
					type: typ,
					title: newtitle,
					description: "",
					common: true,
					cluster: clid,
					cla: claid
				}],_("Add vulnerability '%%'",newtitle),chain);
			
			if (chain) {
				let do_data = {create: true, vuln: vid, assmnt: [], clid: clid};
				let undo_data = {create: false, vuln: vid, assmnt: [], clid: clid};
				for (const cm of it) {
					let aid = createUUID();
					do_data.assmnt.push({id: aid, component: cm.id});
					undo_data.assmnt.push({id: aid});
				}
				new Transaction('assmCreateDelete', [undo_data], [do_data], _("Add vulnerability '%%'",newtitle));
			}
		};
	};
//	var copyhandler = function(typ) {
//		return function() {
//			ThreatAssessment.Clipboard = [];
//			var it = new VulnerabilityIterator(Project.cid,typ);
//			for (const th of it) {
//				ThreatAssessment.Clipboard.push({t: th.title, y: th.type, d: th.description, p: '-', i: '-', r: ''});
//			}
//		};
//	};
//	var pastehandler = function(typ) {
//		return function() {
//			var it = new VulnerabilityIterator(Project.cid,typ);
//			var newth = [];
//			for (const clip of ThreatAssessment.Clipboard) {
//				// Check whether a threat with same title already exists
//				let th;
//				let found = false;
//				for (th of it) {
//					if (clip.t==th.title) {
//						found = true;
//						break;
//					}
//				}
//
//				if (found) {
//					// Paste into existing threat
//					th.setdescription(clip.d);
//					$('#threat'+th.id).remove();
//					th.addtablerow('#'+typ+'threats');
//				} else {
//					// Create a new threat
//					th = new Threat(Project.cid,typ);  // Ignore the type in the Clipboard. Must always be typ.
//					th.settitle(clip.t);
//					th.setdescription(clip.d);
//					Project.get(Project.cid).addthreat(th.id);
//					newth.push(th.id);
//				}
//			}
//			for (const th of newth) Threat.get(th).addtablerow('#'+typ+'threats');
//			transactionCompleted("Checklist vuln paste");
//		};
//	};

	for (const t of ['tWLS','tWRD','tEQT']) {
		$('#'+t+'addthreat').on('click', addhandler(t));
//		$('#'+t+'copythreat').on('click', copyhandler(t));
//		$('#'+t+'pastethreat').on('click', pastehandler(t));
	}
	if (DEBUG && !Rules.consistent()) {
		bugreport('the rules are not internally consistent','initTabDiagrams');
	}
}

function showSelectMenu(e) {
	e.preventDefault();
	$('#selectmenu').menu('collapseAll');
	if (Node.nodesinselection().length==0) {
		$('#mi_sc').addClass('ui-state-disabled');
		$('#mi_sd').addClass('ui-state-disabled');
	} else {
		$('#mi_sc').removeClass('ui-state-disabled');
		$('#mi_sd').removeClass('ui-state-disabled');
	}
	$('#selectmenu').show();
	$('#selectmenu').position({
		my: "left top",
		at: "left+" + e.pageX + "px top+" + e.pageY + "px",
		of: "body",
		collision: "fit"
	});
	return false;
}
	
/* nodesDelete: create a transaction to delete multiple nodes
 * nodes: array of Node IDs
 * descr: description of the transaction
 * chain: the chain-attribute of the transaction
 */
function nodesDelete(nodes,descr,chain) {
	let pid = Node.get(nodes[0]).project;
	let do_data={nodes: [], clusters: []}, undo_data={nodes: [], clusters: []};
	for (const n of nodes) {
		let rn = Node.get(n);
		if (rn.type=='tNOT' || rn.type=='tACT') {
			undo_data.nodes.push({
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
			do_data.nodes.push({id: rn.id});
			continue;
		}

		let cm = Component.get(rn.component);
		undo_data.nodes.push({
			id: rn.id,
			type: rn.type,
			service: rn.service,
			title: rn.title,
			suffix: rn.suffix,
			x: rn.position.x,
			y: rn.position.y,
			component: rn.component,
			assmnt: cm.assessmentdata(),
			accordionopened: cm.accordionopened,
			single: (cm.single ? cm.nodes[0] : false),
			width: rn.position.width,
			height: rn.position.height,
			label: rn.color,
			connect: rn.connect.slice()
		});
		do_data.nodes.push({id: rn.id});
	}
	undo_data.clusters = NodeCluster.structuredata(pid);
	new Transaction('nodeCreateDelete', undo_data, do_data, descr, chain);
}

function initChecklistsDialog(type) {
	// When displaying multiple checklist windows, each will get the same location and size.
	// Since that is confusing, we prevent obscuration by using a type-specific offset.
	var offsets = {'tWLS': 100, 'tWRD': 130, 'tEQT': 160};
	$('#checklist_'+type).dialog({
		title: _("Common vulnerabilities for all nodes of type '%%'", Rules.nodetypes[type]),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		closeOnEscape: false,
		minWidth: 790,
		minHeight: 180,
		position: {my: 'left+'+(offsets[type]+50)+' top+'+offsets[type], at: 'left top', of: '#workspace', collision: 'fit'},
		autoOpen: false,
		create: function() {
			// Add vulnerability
			$(`<div id="${type}addthreat" class="titlebarbutton"></div>`)
			.appendTo($(this).dialog('widget').children('.ui-dialog-titlebar'));
			$(`#${type}addthreat`).button({label: _("+ Add vulnerability")});
		},
		close: function() {
		}
	});
}

function populateLabelMenu() {
	var p = Project.get(Project.cid);
	$('#mi_ccred span').text( '"' + H(p.labels[0]) + '"' );
	$('#mi_ccorange span').text( '"' + H(p.labels[1]) + '"' );
	$('#mi_ccyellow span').text( '"' + H(p.labels[2]) + '"' );
	$('#mi_ccgreen span').text( '"' + H(p.labels[3]) + '"' );
	$('#mi_ccblue span').text( '"' + H(p.labels[4]) + '"' );
	$('#mi_ccpink span').text( '"' + H(p.labels[5]) + '"' );
	$('#mi_ccpurple span').text( '"' + H(p.labels[6]) + '"' );
	$('#mi_ccgrey span').text( '"' + H(p.labels[7]) + '"' );

	$('#mi_scred span').text( '"' + H(p.labels[0]) + '"' );
	$('#mi_scorange span').text( '"' + H(p.labels[1]) + '"' );
	$('#mi_scyellow span').text( '"' + H(p.labels[2]) + '"' );
	$('#mi_scgreen span').text( '"' + H(p.labels[3]) + '"' );
	$('#mi_scblue span').text( '"' + H(p.labels[4]) + '"' );
	$('#mi_scpink span').text( '"' + H(p.labels[5]) + '"' );
	$('#mi_scpurple span').text( '"' + H(p.labels[6]) + '"' );
	$('#mi_scgrey span').text( '"' + H(p.labels[7]) + '"' );
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
			newlabels[0] = String($('#field_red').val()).trim().substr(0,50);
			newlabels[1] = String($('#field_orange').val()).trim().substr(0,50);
			newlabels[2] = String($('#field_yellow').val()).trim().substr(0,50);
			newlabels[3] = String($('#field_green').val()).trim().substr(0,50);
			newlabels[4] = String($('#field_blue').val()).trim().substr(0,50);
			newlabels[5] = String($('#field_pink').val()).trim().substr(0,50);
			newlabels[6] = String($('#field_purple').val()).trim().substr(0,50);
			newlabels[7] = String($('#field_grey').val()).trim().substr(0,50);
				for (var i=0; i<=7; i++) {
					if (newlabels[i]=="") {
						newlabels[i] = Project.defaultlabels[i];
					}
				}
			new Transaction('labelEdit',
				[{id: p.id, labels: p.labels}],
				[{id: p.id, labels: newlabels}],
				_("Edit labels")
			);
			$(this).remove();
		}
	});
	dialog.dialog({
		title: _("Edit labels"),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		modal: true,
		width: 285,
		height: 320,
		buttons: dbuttons
	});
}

function workspacedrophandler(event, ui) {		// eslint-disable-line no-unused-vars
	let typ = ui.draggable[0].id;
	// The id of the template must be a valid type
	if (!Rules.nodetypes[typ]) {
		bugreport('object with unknown type','workspacedrophandler');
	}

	$('.tC').hide();

	let newid = createUUID();
	let newtitle = Node.autotitle(typ);
	let r = $('#tab_diagrams').offset();
	let newx = event.originalEvent.pageX-50-r.left+$('#tab_diagrams'+Service.cid).scrollLeft();
	let newy = event.originalEvent.pageY-10-r.top +$('#tab_diagrams'+Service.cid).scrollTop();

	if (typ=='tNOT' || typ=='tACT') {
		new Transaction('nodeCreateDelete',
			{nodes: [{id: newid}], clusters: []},
			{nodes: [{
				id: newid,
				type: typ,
				service: Service.cid,
				title: newtitle,
				x: newx,
				y: newy,
				width: (typ=='tNOT'?100:null),
				height: (typ=='tNOT'?50:null)
				}], clusters: []},
			_("New node")
		);
	} else {
		let project = Project.get(Project.cid);
		new Transaction('nodeCreateDelete',
			{nodes: [{id: newid}], clusters: []},
			{ nodes: [{
				id: newid,
				type: typ,
				service: Service.cid,
				title: newtitle,
				x: newx,
				y: newy,
				component: createUUID(),
				assmnt: project.defaultassessmentdata(typ)
				}], clusters: []},
			_("New node")
		);
	}
}

function refreshComponentThreatAssessmentsDialog(force) {
	if (!$('#componentthreats').dialog('isOpen') && force!==true)  return;

	// Dialog is open, now repaint its contents
	var c = Component.get(Component.ThreatsComponent);
	var snippet = '<div id="dialogthreatlist">\
		<div class="threat">\
		<div class="th_mal th_col thr_header">_LM_</div>\
		<div class="th_name th_col thr_header">_LN_</div>\
		<div class="th_freq th_col thr_header">_LF_</div>\
		<div class="th_impact th_col thr_header">_LI_</div>\
		<div class="th_total th_col thr_header">_LT_</div>\
		<div class="th_remark th_col thr_header">_LR_</div>\
		</div>\
		<div id="threats_CI_" class="threats"></div>\
		</div>';
	snippet = snippet.replace(/_LM_/g, _H("Cause"));
	snippet = snippet.replace(/_LN_/g, _H("Name"));
	snippet = snippet.replace(/_LF_/g, _H("Freq"));
	snippet = snippet.replace(/_LI_/g, _H("Impact"));
	snippet = snippet.replace(/_LT_/g, _H("Total"));
	snippet = snippet.replace(/_LR_/g, _H("Remark"));
	snippet = snippet.replace(/_BA_/g, _H("+ Add vulnerability"));
	snippet = snippet.replace(/_BC_/g, _H("Copy"));
	snippet = snippet.replace(/_BP_/g, _H("Paste"));
	snippet = snippet.replace(/_CI_/g, c.id);
	$('#componentthreats').html(snippet);
	c.setmarkeroid(null);

	for (const th of c.assmnt) {
		if (th==null) continue;
		Assessment.get(th).addtablerow('#threats'+c.id,'dia');
	}
	$('.malset label').removeClass('ui-corner-left ui-corner-right');

	$('#threats'+c.id).sortable({
		containment: 'parent',
		helper: 'clone',
		cursor: 'ns-resize',
		deactivate: function(/*event,ui*/) {
			var newlist = [];
			for (const ch of this.children) newlist.push(nid2id(ch.id));
			if (newlist.length != c.assmnt.length) {
				bugreport("internal error in sorting","refreshComponentThreatAssessmentsDialog");
			}
			if (c.assmnt.every( (v,i) => (newlist[i]==v) )) return; // Return if no change
			new Transaction('compAssmntsReorder',
				[{id: c.id, assmnt: c.assmnt}],
				[{id: c.id, assmnt: newlist}],
				_("Reorder vulnerabilities of "+H(c.title)));
		}
	});
}

function addvulnhandler(cid) {
	let c = Component.get(cid);
	let vid = createUUID();
	let aid = createUUID();
	let clid = createUUID();
	let claid = createUUID();
	let ntitle = Vulnerability.autotitle(c.project);
	new Transaction('vulnCreateDelete',[{
			create: false,
			id: vid
		}],[{
			create: true,
			id: vid,
			project: c.project,
			type: (c.type=='tUNK' ? 'tEQT' : c.type),
			title: ntitle,
			description: "",
			common: false,
			cluster: clid,
			cla: claid,
			index: 0
		}],_("New vulnerability"),true);
	new Transaction('assmCreateDelete',
		[{
			create: false,
			assmnt: [{id: aid}],
			clid: clid
		}],
		[{
			create: true,
			vuln: vid,
			assmnt: [{id: aid, component: c.id}],
			clid: clid
		}],
		 _("New vulnerability")
	);
}
	
function displayComponentThreatAssessmentsDialog(cid,where) {
	var c = Component.get(cid);
	Component.ThreatsComponent = cid;

	if ($('#componentthreats').dialog('isOpen')) {
		$('#componentthreats').dialog('close');
	}
	refreshComponentThreatAssessmentsDialog(true);
	$('#componentthreats').dialog({
		title: _("Vulnerability assessment for '%%'", c.title) + (c.nodes.length>1 ? _(" (%% nodes)", c.nodes.length) : ""),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		position: {my: 'left top', at: 'right', of: where, collision: 'fit'}
	});
	$('#componentthreats').dialog('open');
	// First delete button gains focus, and is highlighted. Looks ugly.
	$('#dialogthreatlist input').trigger('blur');
}

function displayChecklistsDialog(type) {
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
function arrayJoinAsString(a,str) {		// eslint-disable-line no-unused-vars
	if (a.length==0)  return _("(none)");
	if (a.length==1)  return a[0];
	var last = a.pop();
	return a.join(", ")	+ " " + str + " " + last;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *|	  Single Faults         |* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * *+-------------------------+* * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function initTabSingleFs() {
	$('#tab_singlefs').tabs({
		activate: bottomTabsShowHandlerSFaults,
		create: bottomTabsShowHandlerSFaults,
		classes: {
			"ui-tabs": "ui-corner-bottom ui-corner-tl",
			"ui-tabs-nav": "ui-corner-bottom",
			"ui-tabs-tab": "ui-corner-bottom"
		}
	});
	$('#tab_singlefs').on('click', 'span.tabcloseicon', bottomTabsCloseHandler);
	$('#bottomtabssinglefs').on('mouseenter', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-close').addClass('ui-icon-circle-close');
	});
	$('#bottomtabssinglefs').on('mouseleave', 'li', function(){
		$(this).find('.tabcloseicon').removeClass('ui-icon-circle-close').addClass('ui-icon-close');
	});

}

/* paintSingleFailures(s): paint the contents of a single SF tab
 * s: the Service to be painted.
 */
function paintSingleFailures(s) {
	var snippet, appendstring = "";
	$('#singlefs_workspace'+s.id).empty();

	var it = new ComponentIterator({service: s.id});
	if (it.isEmpty()) {
		$('#singlefs_workspace'+s.id).append(
			'<p class="firstp sfaccordion">'
			+ _("This space will show all vulnerability evaluations for the components in this service. ")
			+ _("Since this diagram for this service is empty, there is nothing to see here yet. ")
			+ _("Add some nodes to the diagrams first.")
		);
		$('#sfexpandall').button('disable');
		$('#sfcollapseall').button('disable');
		$('input[name=sfsort]').checkboxradio('disable');
		return;
	}
	$('#sfexpandall').button('enable');
	$('#sfcollapseall').button('enable');
	$('input[name=sfsort]').checkboxradio('enable');

	// Adding elements to the DOM is slow, so it is best to do it all at
	// once, rather than piece by piece.
	// First collect the bulk of the DOM elements to be appended. Then loop
	// over the components again, adding the vulnerabilities to them, and adding
	// behaviour stuff.
	$('#singlefs_workspace'+s.id).append(`<div id="sfacclist${s.id}" class="sfacclist"></div>`);

	let currorder = $('input[name=sfsort]:checked').val();
	s.sfsortorder = currorder;
	switch (currorder) {
	case 'alph':
		it.sortByTitle();
		break;
	case 'type':
		it.sortByType();
		break;
	case 'thrt':
		it.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","paintSingleFailures");
	}

	for (const cm of it) {
		//if (cm.type=='tACT') continue;
		snippet = '\n\
		  <div id="sfaccordion_SV___ID_" class="sfaccordion">\n\
			<h3><a href="#">_LSF_ "_TI_" (_TY__AP_) _LB_<span id="sfamark_SV___ID_"></span></a></h3>\n\
			<div>\n\
			 <div class="topbuttons donotprint"><div id="sfaadd_SV___ID_" class="addthreatbutton titlebarbutton">_BA_</div>\n\
			 <div id="sfacopy_SV___ID_" class="copybutton titlebaricon" title="_BC_"><img src="../img/ccopy.png" alt="_BC_"></div>\n\
			 <div id="sfapaste_SV___ID_" class="pastebutton titlebaricon" title="_BP_"><img src="../img/cpaste.png" alt="_BP_"></div></div>\n\
			 <div id="sfa_SV___ID_">\n\
			  <div class="threat">\n\
			   <div class="th_mal th_col thr_header">_LC_</div>\n\
			   <div class="th_name th_col thr_header">_LN_</div>\n\
			   <div class="th_freq th_col thr_header">_LF_</div>\n\
			   <div class="th_impact th_col thr_header">_LI_</div>\n\
			   <div class="th_total th_col thr_header">_LT_</div>\n\
			   <div class="th_remark th_col thr_header">_LR_</div>\n\
			  </div>\n\
			 </div>\n\
		';
		snippet = snippet.replace(/_LSF_/g, _("Single failures for"));
		snippet = snippet.replace(/_LC_/g, _("Cause"));
		snippet = snippet.replace(/_LN_/g, _("Name"));
		snippet = snippet.replace(/_LF_/g, _("Freq"));
		snippet = snippet.replace(/_LI_/g, _("Impact"));
		snippet = snippet.replace(/_LT_/g, _("Total"));
		snippet = snippet.replace(/_LR_/g, _("Remark"));

		var p = Project.get(cm.project);
		var labels = [];
		var str;
		for (const n of cm.nodes) {
			let rn = Node.get(n);
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
			for (const l of labels) str += '<div class="smallblock B'+l+'" title="' + H(p.strToLabel(l)) + '"></div>';
			str += '</div>';
			snippet = snippet.replace(/_LB_/, str);
		}

		snippet += "<div class='sfa_sortable'>\n";
		for (const thid of cm.assmnt) snippet += Assessment.get(thid).addtablerow_textonly("sfa"+s.id+'_'+cm.id);
		snippet += "</div>\n";
		snippet += '\n\
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
	for (const cm of it) {
		cm.setmarkeroid("#sfamark"+s.id+'_'+cm.id);
		for (const thid of cm.assmnt) Assessment.get(thid).addtablerow_behavioronly("sfa"+s.id+'_'+cm.id);
		var copyhandler = function(s,cm) {
			return function() {
				Assessment.Clipboard = [];
				for (const thid of cm.assmnt) {
					var te = Assessment.get(thid);
					Assessment.Clipboard.push({t: te.title, y: te.type, d: te.description, p: te.freq, i: te.impact, r: te.remark});
				}
			};
		};
		var pastehandler = function(s,cm) {
			return function() {
				cm.mergeclipboard();
			};
		};
		$('#sfaadd'+s.id+'_'+cm.id).button().on('click',  function() {return addvulnhandler(cm.id);} );
		$('#sfacopy'+s.id+'_'+cm.id).button().on('click',  copyhandler(s,cm) );
		$('#sfapaste'+s.id+'_'+cm.id).button().on('click',  pastehandler(s,cm) );
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
				for (const ch of this.children) newlist.push( nid2id(ch.id) );
				if (cm==null || newlist.length != cm.assmnt.length) {
					bugreport("internal error in sorting","paintSingleFailures");
				}
				if (cm.assmnt.every( (v,i) => (newlist[i]==v) )) return;  // Return if no change
				new Transaction('compAssmntsReorder',
					[{id: cm.id, assmnt: cm.assmnt}],
					[{id: cm.id, assmnt: newlist}],
					_("Reorder vulnerabilities of "+H(cm.title)));
			}
		});
	}
	$('.malset label').removeClass('ui-corner-left ui-corner-right');
}

/* This function is called when the head of the accordion for Component is clicked, but before
 * the accordion is opened or closed.
 */
function opencloseSFAccordion(cm,sid,event,ui) {
	cm.setaccordionopened(ui.oldPanel.length==0);
}

function expandAllSingleF(sid) {
	var it = new ComponentIterator({service: sid});
	for (const cm of it) {
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
	for (const cm of it) {
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

// The cluster for which details are currently displayed on the right-hand side.
var CurrentCluster;

function initTabCCFs() {
	CurrentCluster = null;

	// Localise user interface
	$('#mi_ccfc span').text( _("Create new cluster") );
	$('#mi_ccfm span').text( _("Move to") );
	$('#ccfmenu li.lcT span').text(_("Common failures"));
	$('#ccfmenu').menu().hide();

	// Event handlers for mouse actions
	$('#ccfs_body').on('click', '.ccfaccordionbody', function(event) {
		var nc = nid2id(this.id);
		if (nc!=CurrentCluster) {
			repaintClusterDetails(NodeCluster.get(nc));
		}
		event.stopPropagation();
	});

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

/* repaintCCFDetailsIfVisible(nc): repaint cluster details, if currently visible on-screen.
 * nc: optional; id of NodeCluster that must be visible; default is to repaint any visible NodeCluster.
 */
function repaintCCFDetailsIfVisible(nc) {		// eslint-disable-line no-unused-vars
	if (CurrentCluster==null) return;
//	if ($('#workspace').tabs('option','active') != TabWorkCCF) return;
	if (nc!=null && nc!=CurrentCluster) return;
	let keepscrollpos = $('#ccfs_details').scrollTop();
	repaintClusterDetails(NodeCluster.get(CurrentCluster));
	$('#ccfs_details').scrollTop(keepscrollpos);
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
 * If str ends in XXXabcdYYY, where XXX and YYY are UUIDs, then return XXX.
 * Else return null.
 */
function internalID(str) {
	str = str.replace(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/, '');
	var m = str.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
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
				idlist.forEach(function(v,i) {
					var nd = internalID(v);
					if (fromnid==nd) fromi = i;
					if (tonid==nd) toi = i;
				});
				// Swap so that fromi <= toi
				if (fromi>toi) {
					let i=fromi; fromi=toi; toi=i;
				}
				// Select all those nodes
				for (let i=fromi; i<=toi; i++) {
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
		$('#mi_ccfc span').text( _("Remove cluster") );
		$('#mi_ccfc div').append('<span class="ui-icon ui-icon-trash"></span>');
		$('#mi_ccfc').removeClass('ui-state-disabled');
		LastSelectedNode = null;
	} else {
		// Popup menu called on node
		populateClusterSubmenu(cluster,[]);
		$('#mi_ccfc span').text( _("Create new cluster") );
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
	for (const clid of allclusters) {
		var cl = NodeCluster.get(clid);
		snippet += '<li id="ccf_msm_CI_" class="_DIS_"><div><span class="lc">_CN_</span></div></li>';
		snippet = snippet.replace(/_CI_/, clid);
		snippet = snippet.replace(/_DIS_/, (exceptions.indexOf(clid)==-1 ? '' : 'ui-state-disabled'));
		if (cl.isroot()) {
			snippet = snippet.replace(/_CN_/, H(cl.title) + ' ' + _("(root)"));
		} else {
			snippet = snippet.replace(/_CN_/, H(cl.title));
		}
	}
	$('#mi_ccfmsm').html(snippet);
	$('#ccfmenu').menu("refresh");
}

function createClusterHandler(/*event*/) {
	let cluster = NodeCluster.get(MenuCluster);

	$('#ccfmenu').hide();
	if (LastSelectedNode) {
		createClusterFromNodes(cluster,getSelectedNodes());
	} else {
		// Called on a cluster; absorbe that cluster into its parent.
		removeCluster(cluster);
	}
}

function moveToClusterHandler(/*event*/) {
	// Cluster indicated by the submenu item
	var to_cluster = NodeCluster.get(nid2id(this.id));

	$('#ccfmenu').hide();
	if (LastSelectedNode) {
		// Called on a node: move selection to cluster
		moveNodesToCluster(getSelectedNodes(),to_cluster);
	} else {
		var from_cluster = NodeCluster.get(MenuCluster);
		moveCluster(from_cluster, to_cluster);
	}
}

/* createClusterFromNodes: create a new nodecluster, initiated by drag&drop or by the menu.
 * cluster: parent cluster of the new cluster
 * fromnodes: array of Node ids. Must be member-nodes of the root of the cluster
 * newtitle: title of the new cluster, or null for a default title.
 */
function createClusterFromNodes(cluster,fromnodes,newtitle) {
	let root = NodeCluster.get(cluster.root());
	let ncid = createUUID();
	new Transaction('clusterStructure',
		[{root: root.id, structure: root.structure(), destroy: ncid}],
		[{create: ncid, type: cluster.type, parent: cluster.id, title: newtitle,
			project: cluster.project, nodes: fromnodes,
			assmnt: createUUID()
		}],
		_("create new cluster"));
}

/* moveNodesToCluster: make an existing cluster the container for some nodes
 * fromnodes: array of Node ids. Must be member-nodes of the root of the cluster
 * to_cluster: cluster to move the nodes to
 */
function moveNodesToCluster(nodes,to_cluster) {
	let root = NodeCluster.get(to_cluster.root());
	new Transaction('clusterStructure',
		[{root: root.id, structure: root.structure()}],
		[{move: nodes, to: to_cluster.id}],
		_("move nodes to cluster"));
}

/* removeCluster: disband a cluster (from the menu, or by dragging it onto its parent)
 */
function removeCluster(cluster) {
	let root = NodeCluster.get(cluster.root());
	new Transaction('clusterStructure',
		[{root: root.id, structure: root.structure()}],
		[{remove: cluster.id}],
		_("remove cluster %%", cluster.title));
}

/* moveCluster: change the parent of an existing cluster.
 * from_cluster: the cluster to be moved
 * to_cluster: its new parent
 */
function moveCluster(from_cluster,to_cluster) {
	let root = NodeCluster.get(from_cluster.root());
	new Transaction('clusterStructure',
		[{root: root.id, structure: root.structure()}],
		[{move_from: from_cluster.id, move_to: to_cluster.id}],
		_("move cluster %%", from_cluster.title));
}

/* Obtain an array of nodes currently selected (highlighted)
 */
function getSelectedNodes() {
	let arr = [];
	$('.li_selected').each(function(){
		arr.push(internalID(this.id));
	});
	return arr;
}

//var CCFMinOpt = '-';

function PaintAllClusters() {
	var snippet = '\
		<h1 class="printonly">_LCCF_</h1>\
		<h2 class="printonly projectname">_PN_</h2>\
		<p id="noccf" class="firstp">_N1_\
		_N2_\
		_N3_</p>\
		<div id="outerimpacthint" style="display:none"><div id="hintpoint"></div><img src="../img/hint.png" alt="?"><div id="impacthint"></div></div>\
		<div id="ccfacclist">\
		</div>\
	';
	snippet = snippet.replace(/_LCCF_/g, _H("Common Cause Failures"));
	snippet = snippet.replace(/_N1_/g, _H("This space will show all vulnerabilities domains for the components in this project."));
	snippet = snippet.replace(/_N2_/g, _H("Since there are no vulnerabilities that occur in two or mode nodes, there is nothing to see here yet."));
	snippet = snippet.replace(/_N3_/g, _H("Add some nodes to the diagrams first."));
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	$('#ccfs_body').html(snippet);

	// create list of all vulnerabilities
	// for each vulnerability, list the nested list / vulnerability-domain-tree
	// allow manipulation of nested list
	var it = new NodeClusterIterator({project:Project.cid, isroot:true});
	if (it.isEmpty()) {
		ccfsVisible(false);
		return;
	}
	ccfsVisible(true);
	sortClustersToCurrentOrder(it);
	for (const nc of it) {
		addClusterElements(nc);
		repaintCluster(nc.id);
	}
	$('#ccfs_body').append('<br><br>');
	$('.malset label').removeClass('ui-corner-left ui-corner-right');

	// Show the details of the first open accordion
	for (const nc of it) {
		if (nc.accordionopened && CurrentCluster==null) {
			// Delay painting until the accordions are done
			window.setTimeout(function() {
				repaintClusterDetails(nc);
			}, 1000);
			break;
		}
	}
}

function ccfsVisible(vis) {
	if (vis) {
		$('#noccf').hide();
		$('#someccf').show();
		$('#ccfs_details').show();
		$('#ccfexpandall').button('enable');
		$('#ccfcollapseall').button('enable');
		$('#ccfsortsection input[name=ccfsort]').checkboxradio('enable');
	} else {
		$('#noccf').show();
		$('#someccf').hide();
		$('#ccfs_details').hide();
		$('#ccfexpandall').button('disable');
		$('#ccfcollapseall').button('disable');
		$('#ccfsortsection input[name=ccfsort]').checkboxradio('disable');
	}
}

function sortClustersToCurrentOrder(it) {
	let currorder = $('input[name=ccfsort]:checked').val();
	switch (currorder) {
	case 'alph':
		it.sortByTitle();
		break;
	case 'type':
		it.sortByType();
		break;
	case 'thrt':
		it.sortByLevel();
		break;
	default:
		bugreport("Unknown node sort option","PaintAllClusters");
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
				$('.ccfhighlight').removeClass('ccfhighlight');
				CurrentCluster = null;
				for (const cl of it) {
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

	for (const cl of it) {
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
	repaintClusterDetails(it.first());
}

function collapseAllCCF() {
	$('#ccfs_details').empty();
	$('.ccfaccordion').removeClass('ccfhighlight');
	CurrentCluster = null;
	var it = new NodeClusterIterator({project: Project.cid});
	for (const cl of it) {
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
		<div class="th_mal th_col thr_header">_LC_</div>\
		<div class="th_name th_col thr_header">_LN_</div>\
		<div class="th_freq th_col thr_header">_LF_</div>\
		<div class="th_impact th_col thr_header">_LI_</div>\
		<div class="th_total th_col thr_header">_LT_</div>\
		<div class="th_remark th_col thr_header">_LR_</div>\
		</div>\
		<div id="ccftable_ID_" class="threats">\
		</div></div>\n';
	snippet = snippet.replace(/_LC_/g, _H("Cause"));
	snippet = snippet.replace(/_LN_/g, _H("Name"));
	snippet = snippet.replace(/_LF_/g, _H("Freq"));
	snippet = snippet.replace(/_LI_/g, _H("Impact"));
	snippet = snippet.replace(/_LT_/g, _H("Total"));
	snippet = snippet.replace(/_LR_/g, _H("Remark"));
	snippet = snippet.replace(/_ID_/g, nc.id);
	$('#ccfaccordionbody'+nc.id).html( snippet );
	computeSpacesMakeup(nc,'#ccftable'+nc.id,'ccf'+nc.id);
	nc.calculatemagnitude();

	if (nc.childclusters.length + nc.childnodes.length < 2) {
		// Just an empty/invisible placeholder for a node cluster that is too small
		$('#ccfaccordion'+nc.id).css('display', 'none');
		// Check whether there are any cluster remaining visible
		var it = new NodeClusterIterator({project:Project.cid, isroot:true, isstub: false});
		if (!it.isEmpty()) return;
		// None were visible
		ccfsVisible(false);
		return;
	}

	ccfsVisible(true);
	$('#ccfaccordion'+nc.id).css('display', 'block');
	repaintClusterDetails(nc,false);
}

function repaintClusterDetails(nc,force) {
	if (force==null)  force=true;
	if (CurrentCluster && CurrentCluster!=nc.id && !force)  return;

	CurrentCluster = nc.id;
	$('#ccfs_details').empty().scrollTop(0);
	$('#ccfs_details').append( listFromCluster(nc) );
	$('#ccfs_details').append('<br><br>');
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
			$('.tlistitem,.ui-accordion-header').addClass('hidepointer');
			$('body').css('cursor','none');
		},
		stop: function(/*event,ui*/) {
			$('.li_selected').removeClass('ui-draggable-dragging li_selected');
			$('.tlistitem,.ui-accordion-header').removeClass('hidepointer');
			$('body').css('cursor','');
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
		bg_over: 'var(--highlt)',
		text_size: 40,
		callback: function(domid, enteredText) {
			var nc = NodeCluster.get( nid2id(domid) );
			new Transaction('clusterTitle',
				[{id: nc.id, title: nc.title}],
				[{id: nc.id, title: enteredText}],
				_("Rename cluster")
			);
			return H(nc.title);
		}
	});
}

function listFromCluster(nc,indent) {
	if (indent==null) indent=0;
	var str;
	// Cluster heading
	if (nc.isroot()) {
		str = `
			<ul id="tlist${nc.id}" class="tlist" style="padding-left: 0px;">
			 <li id="linode${nc.id}" class="clusternode tlistroot ui-state-default ui-state-selected">
			   ${H(nc.title)} (${Rules.nodetypes[nc.type]})
			 </li>
		`;
	} else {
		str = `
			<ul id="tlist${nc.id}" class="tlist">
			 <li id="linode${nc.id}" style="top: ${4+17*indent}px; z-index: ${100-indent}" class="clusternode tlistitem ui-state-default ui-state-selected">
			   <span id="cltrgl${nc.id}" class="ui-icon ui-icon-triangle-1-${nc.accordionopened?'s':'e'} clustericon"></span>
			   <span id="litext${nc.id}" class="litext">${H(nc.title)}</span>
			   <span id="ccfamark${nc.id}"></span></a>
			 </li>
		`;
	}

	// Insert all child clusters, recursively
	for (const clid of nc.childclusters) {
		var cc = NodeCluster.get(clid);
		str += '<li';
		if (!nc.isroot() && !nc.accordionopened) {
			str += ' style="display: none;"';
		}
		str += '>\n';
		str += listFromCluster(cc,indent+1);
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
		for (const nid of fromarr) {
			var rn = Node.get(nid);
			if (rn==null) {
				bugreport("Child node does not exist","listFromCluster:sortednodeswithcolor");
			}
			if (rn.color==col) {
				arr.push(nid);
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
	for (const nodeid of node) {
		var rn = Node.get(nodeid);
		var cm = Component.get(rn.component);
		var sv = "";

		// Single node classes can (will) be present in multiple services.
		if (cm.single) {
			for (const nid of cm.nodes) {
				if (sv!='') sv += '; ';
				sv += Service.get(Node.get(nid).service).title;
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

		var p = Project.get(Project.cid);
		// Single node classes can have multiple labels
		var labels = [];
		if (cm.single) {
			for (const nid of cm.nodes) {
				let n = Node.get(nid);
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
			for (const l of labels) str+='<div class="smallblock B'+l+'" title="' + H(p.strToLabel(l)) + '"></div>';
			str += '</div>';
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
	for (const clid of nc.childclusters) computeRows(NodeCluster.get(clid));
}
/* eslint-enable no-bitwise */

function appendAllThreats(nc,domid,prefix) {
	if (DEBUG && nc==null) {
		bugreport("nc is null","appendAllThreats");
	}
	Spaces_row++;
	var th = Assessment.get(nc.assmnt);
	// Only paint threat assessment if at least two child nodes (clusters don't count)
//	if (nc.childnodes.length>1) {
		var spaces = "";
		spaces += '<span class="linechar">';
		for (var i=0; i<nc.depth(); i++) {
			spaces += '<img src="../img/_KIND_.png" class="lineimg" alt="">';
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
	for (const clid of nc.childclusters) appendAllThreats(NodeCluster.get(clid),domid,prefix);
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
	var drag_cluster, drop_cluster;

	drag = nid2id(dragid);
	drag_n = internalID(dragid);

	drop = nid2id(dropid);
	drop_n = internalID(dropid);

	if (drag!=null) drag_cluster = NodeCluster.get(drag);
	if (drop!=null) drop_cluster = NodeCluster.get(drop);

	if (drag_n!=null) {
		// A node is being dragged
		if (drop_n!=null && drag==drop) {
			// Dropped on a node of the same cluster
			let dragNode = Node.get(drag_n);
			let dropNode = Node.get(drop_n);
			let newtitle = null;
			if (dragNode.color==dropNode.color && dragNode.color!='none') {
				// Both have the same label. Name the new node cluster after this label.
				var p = Project.get(Project.cid);
				newtitle = p.strToLabel(dragNode.color);
			}
			let nodes = getSelectedNodes();
			nodes.push(drop_n);
			createClusterFromNodes(drag_cluster,nodes,newtitle);
		} else if (drop_n!=null && drag!=drop) {
			bugreport("Node dropped on node of a different cluster","nodeClusterReorder");
		} else if (drop_n==null && drag==drop) {
			bugreport("Node dropped on its containing cluster","nodeClusterReorder");
		} else if (drop_n==null && drag!=drop) {
			// Dropped into a different cluster
			moveNodesToCluster(getSelectedNodes(),drop_cluster);
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
		} else {
			// Cluster dropped on a different cluster
			moveCluster(drag_cluster,drop_cluster);
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
	if (!$(elem).hasClass('tlistitem')) return false; // Could be dragging a dialog box without an id
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

const TabAnaVulnOverview = 0;
const TabAnaAssOverview = 1;
const TabAnaNodeCounts = 2;
const TabAnaVulReports = 3;
const TabAnaLonglist = 4;

function initTabAnalysis() {
	$("a[href^='#at1']").text(_("Vulnerability overview"));
	$("a[href^='#at2']").text(_("Assessments overview"));
	$("a[href^='#at3']").text(_("Node counts"));
	$("a[href^='#at4']").text(_("Vulnerability reports"));
	$("a[href^='#at5']").text(_("Risk longlist"));

	$('#tab_analysis').tabs({
		classes: {
			"ui-tabs": "ui-corner-bottom ui-corner-tl",
			"ui-tabs-nav": "ui-corner-bottom",
			"ui-tabs-tab": "ui-corner-bottom",
			"ui-tabs-panel": "ui-corner-tl"
		},
		activate: repaintCurrentAnalysis
	});

	$('#minV').selectmenu({
		appendTo: '#anallopts',
		select: function(/*event,ui*/) {
			MinValue = $('#minV').val();
			$('#longlist').html(listSelectedRisks());
		}
	}).val(MinValue);
}

function repaintCurrentAnalysis() {
	$('#tb_home .toolbarsection').hide();
	switch ($('#tab_analysis').tabs('option','active')) {
	case TabAnaVulnOverview:
		$('#anavulnopts').show();
		paintVulnerabilityOverview();
		break;
	case TabAnaAssOverview:
		paintAssessmentOverview();
		break;
	case TabAnaNodeCounts:
		paintNodeTypeStats();
		break;
	case TabAnaVulReports:
		paintChecklistReports();
		break;
	case TabAnaLonglist:
		$('#anallopts').show();
		paintLonglist();
		break;
	default:
		bugreport('unknown tab encountered','vertTabSelected');
	}
}

function repaintAnalysisIfVisible(anatab) {		// eslint-disable-line no-unused-vars
	if ($('#workspace').tabs('option','active') != TabWorkAna) return;
	if (anatab!=null && anatab!=$('#tab_analysis').tabs('option','active')) return;
	repaintCurrentAnalysis();
}

var FailureThreatSortOpt = {node: 'thrt', threat: 'type'};

function paintVulnerabilityOverview() {
	ComponentExclusions.clear();
	ClusterExclusions.clear();

	$('#at1').empty();
	var snippet = '\
		<h1 class="printonly">_LD_</h2>\
		<h2 class="printonly">_LTT_</h1>\
		<h2 class="printonly projectname">_PN_</h1>\
	';
	snippet = snippet.replace(/_LTT_/g, _H("Reports and Analysis Tools") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));
	snippet = snippet.replace(/_LD_/g, _H("Vulnerability overview"));

	snippet += '<div id="ana_nodethreattable" class="ana_nodeccfblock"></div>\n\
		<div id="ana_ccftable" class="ana_nodeccfblock"></div>\n\
	';
	$('#at1').html(snippet);

	$('#ana_nodesort_'+FailureThreatSortOpt.node).prop('checked',true);
	$('#ana_failsort_'+FailureThreatSortOpt.threat).prop('checked',true);

	paintSFTable();
	paintCCFTable();
}

// Two Sets that record the single failures and CCFs that have been
// marked as disabled/excluded. These failures will not contribute to the total
// vulnerability score for that item. This allows simple "what if" analysis.
// ComponentExclusions values: component ID + '_' + threatassessment ID
// ClusterExclusions values: cluster ID'
// These two values are also recorded on the <TD> table cells, as the attributes
// 'component', 'threat', and 'cluster'. These attributes are inspected in
// the click-event handler on $('.nodecell') and $('.clustercell').
//
var ComponentExclusions = new Set();
var ClusterExclusions = new Set();

// Returns an array contaiing keys for ComponentExclusions
function computeComponentQuickWins() {
	var suggestions = [];
	var cit = new ComponentIterator({project: Project.cid});

	// Cycle over all of the nodes (components, really)
	for (const cm of cit) {
		// Don't bother with incomplete or low-risk components
		if (cm.magnitude=='-' || cm.magnitude=='L' || cm.magnitude=='U') continue;
		// Cycle over all vulnerabilities, and count how many are equal to the overall magnitude.
		// There must be at least one such vuln!
		var cnt = 0;
		for (const thid of cm.assmnt) {
			var ta = Assessment.get(thid);
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

	for (const cl of ncit) {
		// Don't bother with incomplete or low-risk clusters
		if (cl.magnitude=='-' || cl.magnitude=='L' || cl.magnitude=='U') continue;

		var candidates = cl.allclusters();
		for (const clid of candidates) {
			var aarr = new Set();
			aarr.add(clid);
			if (ClusterMagnitudeWithExclusions(cl,aarr) != cl.magnitude){
				suggestions.push(clid);
			}
		}
	}

	return suggestions;
}

function paintSFTable() {
	var cit = new ComponentIterator({project: Project.cid});
	switch (FailureThreatSortOpt.node) {
	case 'alph':
		cit.sortByTitle();
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

	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	switch (FailureThreatSortOpt.threat) {
	case 'alph':
		tit.sortByTitle();
		break;
	case 'type':
		tit.sortByType();
		break;
	default:
		bugreport("Unknown threat sort option","paintSFTable");
	}

	$('#ana_nodethreattable').empty();
	var numvulns = tit.count();
	var Nodesum = [];
	// If the table would be empty, then don't paint row and column headers
	// but show a message instead
	if (numvulns==0) {
		$('#ana_nodethreattable').html("<p style=\"margin-left:3em; width:50em;\">"
			+ _H("This space will show an overview of all diagram nodes and their vulnerabilities. ")
			+ _H("Since all service diagrams are empty, there is nothing to see here yet. ")
			+ _H("Add some nodes to the diagrams first.")
		);
		$('#anavnsortsection input[name=ana_nodesort]').checkboxradio('option','disabled',true);
		$('#anavnsortsection input[name=ana_failsort]').checkboxradio('option','disabled',true);
		$('#quickwinslink').button('option','disabled',true);
		return;
	}
	$('#anavnsortsection input[name=ana_nodesort]').checkboxradio('option','disabled',false);
	$('#anavnsortsection input[name=ana_failsort]').checkboxradio('option','disabled',false);
	$('#quickwinslink').button('option','disabled',false);
	
	// Initialise to '-'
	cit.forEach(cm => Nodesum[cm.id] = '-');

	// Do the header
	var snippet = '\n\
		<h3>_SF_</h3>\n\
		<table style="width:_TW_em">\n\
		<colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
		<colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
		<colgroup><col span="1" style="width:_WR_em"></colgroup>\n\
		<thead>\n\
		 <tr>\n\
		  <td></td>\n\
	';
	// 20em = width of first column
	// 1.7em = width of vulnerability columns
	// numvulns = number of vulnerability columns
	snippet = snippet.replace(/_SF_/, _H("Single failures"));
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_WR_/, 6);
	snippet = snippet.replace(/_TW_/, 20+1.7*(numvulns+1)+6);
	snippet = snippet.replace(/_NT_/, numvulns+1);
	for (const nc of tit) {
		snippet += '<td class="headercell">'+H(nc.title)+'</td>\n';
	}
	snippet += '<td class="headercell"><b>_OV_</b></td><td></td>\n\
		 </tr>\n\
		</thead>\n\
		<tbody>\n\
	';
	snippet = snippet.replace(/_OV_/, _("Overall"));
	// Do each of the table rows
	for (const cm of cit) {
		snippet += '<tr><td class="nodetitlecell">';
		snippet += H(cm.title);
		snippet += '&nbsp;</td>';
		for (const nc of tit) {
			// Find the threat assessment for this node
			var ta = {};
			for (const thid of cm.assmnt) {
				ta = Assessment.get(thid);
				if (ta.title==nc.title && ta.type==nc.type) break;
			}
			if (ta.title==nc.title && ta.type==nc.type) {
				snippet += `<td class="nodecell ${ComponentExclusions.has(cm.id+'_'+ta.id)?"excluded":""} M${Assessment.valueindex[ta.total]}" data-component="${cm.id}" data-threat="${ta.id}" title="${H(cm.title)} / ${H(ta.title)} (${Rules.nodetypes[ta.type]})">${ta.total}</td>`;
				if (!ComponentExclusions.has(cm.id+'_'+ta.id)) {
					Nodesum[cm.id] = Assessment.sum(Nodesum[cm.id], ta.total);
				}
			} else {
				snippet += '<td class="blankcell">&thinsp;</td>';
			}
		}
		let reduced = '';
		if (cm.magnitude!=Nodesum[cm.id]) {
			reduced = '<span class="reduced">' + _("reduced") + '</span>';
		}
		snippet += `<td class="M${Assessment.valueindex[Nodesum[cm.id]]}" title="${H(cm.title)} /  ${_H("overall vulnerability level")}">${Nodesum[cm.id]}</td><td>${reduced}</td></tr>\n`;
	}
	// Do the ending/closing
	snippet += '\n\
		</tbody>\n\
		</table><p></p>\n\
	';
	$('#ana_nodethreattable').html(snippet);

	$('#ana_nodethreattable .nodecell').on('click',  function(evt){
		var cmid = $(evt.currentTarget).data('component');
		var tid = $(evt.currentTarget).data('threat');
		if (ComponentExclusions.has(cmid+'_'+tid)) {
			ComponentExclusions.delete(cmid+'_'+tid);
			$('#clearexclusions').button('option','disabled',ComponentExclusions.size==0 && ClusterExclusions.size==0);
		} else {
			ComponentExclusions.add(cmid+'_'+tid);
			$('#clearexclusions').button('option','disabled',false);
		}
		paintSFTable();
	});
}

function paintCCFTable() {
	var ncit = new NodeClusterIterator({project: Project.cid, isroot: true, isstub: false});
	switch (FailureThreatSortOpt.node) {
	case 'alph':
		ncit.sortByTitle();
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

	var tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	switch (FailureThreatSortOpt.threat) {
		case 'alph':
			tit.sortByTitle();
			break;
		case 'type':
			tit.sortByType();
			break;
		default:
			bugreport("Unknown threat sort option","paintCCFTable");
	}

	$('#ana_ccftable').empty();
	var numvulns = 0;
	for (const cl of tit) numvulns++;		// eslint-disable-line no-unused-vars
	// Do not paint an empty table
	if (ncit.isEmpty() || numvulns==0)  return;

	// Do the header
	var snippet = '\n\
	<h3>_CCF_</h3>\n\
	<table style="width:_TW_em">\n\
	<colgroup><col span="1" style="width:_WF_em"></colgroup>\n\
	<colgroup><col span="_NT_" style="width:_WC_em"></colgroup>\n\
	<colgroup><col span="1" style="width:_WR_em"></colgroup>\n\
	<thead>\n\
	<tr><td></td>\n\
	';
	snippet = snippet.replace(/_CCF_/, _("Common cause failures"));
	// 20em = width of first column
	// 1.7em = width of vulnerability columns
	// numvulns = number of vulnerability columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_WR_/, 6);
	snippet = snippet.replace(/_TW_/, 20+1.7*(numvulns+1)+6);
	snippet = snippet.replace(/_NT_/, numvulns+1);
	for (const nc of tit) {
		snippet += '<td class="headercell">'+H(nc.title)+'</td>\n';
	}
	snippet += '<td class="headercell"><b>_OV_</b></td><td></td>\n\
		 </tr>\n\
		</thead>\n\
		<tbody>\n\
	';
	snippet = snippet.replace(/_OV_/, _("Overall"));

	// Do each of the table rows
	for (const cl of ncit) {
		var ta = Assessment.get(cl.assmnt);

		var col=0;
		for (const cl2 of tit) {
			if (cl2.id==cl.id) break;
			col++;
		}

		snippet += addCCFTableRow(col,numvulns,ta,cl,0);

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
		var cid = $(evt.currentTarget).data('cluster');
		if (ClusterExclusions.has(cid)) {
			ClusterExclusions.delete(cid);
			$('#clearexclusions').button('option','disabled',ComponentExclusions.size==0 && ClusterExclusions.size==0);
		} else {
			ClusterExclusions.add(cid);
			$('#clearexclusions').button('option','disabled',false);
		}
		paintCCFTable();
	});
}

function addCCFTableRow(col,numvulns,ta,cl,indent) {
	var suffix = "";
	if (indent>0) {
		suffix = " :" + new Array(indent+1).join("&nbsp;&nbsp;");
	}
	var snippet = '<tr><td class="nodetitlecell">'+H(cl.title)+suffix+'&nbsp;</td>\n';
	for (var i=0; i<numvulns; i++) {
		if (i==col &&cl.childnodes.length>1) {
			snippet += '<td class="clustercell _EX_ M_CL_" data-cluster="_CI_" title="_TI_">_TO_</td>';
			snippet = snippet.replace(/_CL_/g, Assessment.valueindex[ta.total]);
			snippet = snippet.replace(/_TO_/g, ta.total);
			snippet = snippet.replace(/_TI_/g, _("CCF for ")+cl.title+" ("+Rules.nodetypes[cl.type]+")");
			snippet = snippet.replace(/_CI_/g, cl.id);
			snippet = snippet.replace(/_EX_/g, ClusterExclusions.has(cl.id)?"excluded":"" );
		} else {
			snippet += '<td class="'+(indent>0?'continuationcell':'blankcell')+'">&thinsp;</td>';
		}
	}
	if (cl.childclusters.length==0 && indent>0) {
		snippet += '<td class="continuationcell">&thinsp;</td><td></td></tr>\n';
	} else {
		snippet += '<td class="clustercell M_CL_" title="_TI_">_TO_</td><td>_ZZ_</td></tr>\n';
		var clustertotal = ClusterMagnitudeWithExclusions(cl,ClusterExclusions);
		snippet = snippet.replace(/_CL_/g, Assessment.valueindex[clustertotal]);
		snippet = snippet.replace(/_TO_/g, clustertotal);
		snippet = snippet.replace(/_TI_/g, "Total for "+cl.title+" ("+Rules.nodetypes[cl.type]+")");
		if (cl.magnitude==clustertotal) {
			snippet = snippet.replace(/_ZZ_/g, '');
		} else {
			snippet = snippet.replace(/_ZZ_/g, '<span class="reduced">' + _("reduced") + '</span>');
		}
	}
	for (const clid of cl.childclusters) {
		var ccl = NodeCluster.get(clid);
		ta = Assessment.get(ccl.assmnt);
		snippet += addCCFTableRow(col,numvulns,ta,ccl,indent+1);
	}

	return snippet;
}

function ClusterMagnitudeWithExclusions(cl,list) {
	if (cl.assmnt==null)  return '-';
	var ta = Assessment.get(cl.assmnt);
	var mag = list.has(cl.id) ? "U" : ta.total;
	for (const clid of cl.childclusters) {
		var cc = NodeCluster.get(clid);
		mag = Assessment.sum(mag,ClusterMagnitudeWithExclusions(cc,list));
	}
	return mag;
}

function paintAssessmentOverview() {
	var freq_snippet = paintAssessmentOverviewType(1);
	var impact_snippet;
	var total_snippet;
	var snippet = '\
		<h1 class="printonly">_LD_</h2>\
		<h2 class="printonly">_LTT_</h1>\
		<h2 class="printonly projectname">_PN_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _H("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LD_/g, _H("Assessments overview") );
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

	impact_snippet = paintAssessmentOverviewType(2);
	total_snippet = paintAssessmentOverviewType(0);

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
		heightStyle: 'content',
		classes: {
			'ui-tabs-nav': 'ui-corner-top'
		}
	});
}

/* paintAssessmentOverviewType(t): create HTML code for vulnerabilities tables
 *
 * t==0: vulnerability level
 * t==1: frequency
 * t==2: impact
 *
 * Returns an HTML snippet for the table, or an empty string when there are no vulnerabilities to show.
 */
function paintAssessmentOverviewType(tabletype) {
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
		switchvar = (tabletype==0 ? ta.total : (tabletype==1 ? ta.freqDisp : ta.impact) );
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
			bugreport("Unknown threat-value","paintAssessmentOverview");
		}
	}

	// Precompute all numbers
	// Iterate over all components
	var cit = new ComponentIterator({project: Project.cid});
	cit.forEach(cm => cm.assmnt.forEach(thid => addUp(Assessment.get(thid))));

	// Tterate over all cluster assessments
	var tit = new NodeClusterIterator({project: Project.cid, isempty: false});
	tit.forEach(nc => addUp(Assessment.get(nc.assmnt)));

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

	snippet = snippet.replace(/_LF_/g, _("Frequencies"));
	snippet = snippet.replace(/_LI_/g, _("Impacts"));
	snippet = snippet.replace(/_LO_/g, _("Overall levels"));
	snippet = snippet.replace(/_SV_/g, _("Assessments for"));
	snippet = snippet.replace(/_LVU_/g, Assessment.descr[Assessment.valueindex['U']] );
	snippet = snippet.replace(/_LVL_/g, Assessment.descr[Assessment.valueindex['L']] );
	snippet = snippet.replace(/_LVM_/g, Assessment.descr[Assessment.valueindex['M']] );
	snippet = snippet.replace(/_LVH_/g, Assessment.descr[Assessment.valueindex['H']] );
	snippet = snippet.replace(/_LVV_/g, Assessment.descr[Assessment.valueindex['V']] );
	snippet = snippet.replace(/_LVX_/g, Assessment.descr[Assessment.valueindex['X']] );
	snippet = snippet.replace(/_LVA_/g, Assessment.descr[Assessment.valueindex['A']] );
	snippet = snippet.replace(/_LVN_/g, Assessment.descr[Assessment.valueindex['-']] );
	snippet = snippet.replace(/_LT_/g, _("Total") );
	snippet = snippet.replace(/_TT_/g, (tabletype==0 ? _("levels") : (tabletype==1 ? _("frequencies") : _("impacts")) ));
	// Do each of the table rows
	tit = new NodeClusterIterator({project: Project.cid, isroot: true, isempty: false});
	tit.sortByType();
//	var col = 0;
	for (const cl of tit) {
		var ta = Assessment.get(cl.assmnt);
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
	const MAXCOLH = 40;
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
	var sit = new ServiceIterator({project: Project.cid});
	sit.sortByTitle();

	$('#at3').empty();

	var snippet = '\
		<h1 class="printonly">_LD_</h2>\
		<h2 class="printonly">_LTT_</h1>\
		<h2 class="printonly projectname">_PN_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LD_/g, _("Node counts") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	for (var typ of Rules.types) tStats[typ] = 0;
	for (const s of sit) {
		var sStats = {};
		var sTot = 0;
		var nit = new NodeIterator({service: s.id});

		for (typ of Rules.types) sStats[typ] = 0;
		snippet += '<div id="servicestats_SI_" class="servicestats">\n\
		<b>_SN_</b><br>\n\
		<table class="statstable">\n\
		<thead><th class="statstype">_LT_</th><th class="statsnum">_LN_</th></thead>\n\
		<tbody>\n\
		';
		snippet = snippet.replace(/_LT_/g, _("Type") );
		snippet = snippet.replace(/_LN_/g, _("Num") );
		snippet = snippet.replace(/_SI_/g, s.id);
		snippet = snippet.replace(/_SN_/g, H(s.title));
		for (const rn of nit) {
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
		';
		snippet = snippet.replace(/_LT_/g, _("Total") );
	}
	// Project total
	snippet += '<div id="servicestatsTotal" class="servicestats">\n\
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
	';
	snippet = snippet.replace(/_LT_/g, _("Total") );
	$('#at3').append(snippet);
}

function paintChecklistReports() {
	$('#at4').empty();


	var snippet = '\
		<h1 class="printonly">_LD_</h2>\
		<h2 class="printonly">_LTT_</h1>\
		<h2 class="printonly projectname">_PN_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _H("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LD_/g, _H("Checklist reports") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	snippet += '<div class="checklistreport"><h3>' + _H("Removed vulnerabilities") + '</h3>\n';
	snippet += showremovedvulns();
	snippet += '</div>';
	snippet += '<div class="checklistreport"><h3>' + _H("Custom vulnerabilities") + '</h3>\n';
	snippet += showcustomvulns();
	snippet += '</div>';

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
	cit.sortByTitle();
	for (const cm of cit) {
		var tit = new VulnerabilityIterator({project: Project.cid, type: cm.type});
		for (const th of tit) {
			// Check whether this threat was used
			for (i=0; i<cm.assmnt.length; i++) {
				var ta = Assessment.get(cm.assmnt[i]);
				// we have a match
				if (th.type==ta.type && th.title==ta.title) break;
			}
			if (i<cm.assmnt.length) continue;
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
	// 1.7em = width of vulnerability columns
	// numvulns = number of vulnerability columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*VulnIDs.length);
	snippet = snippet.replace(/_NT_/, VulnIDs.length);
	for (j=0; j<VulnIDs.length; j++) {
		snippet += '<td class="headercell">'+H(Vulnerability.get(VulnIDs[j]).title)+'</td>\n';
	}
	snippet += '\
	  </tr>\n\
	  </thead>\n\
	  <tbody>\n\
	';

	// Do each of the table rows
	for (const cid of CompIDs) {
		cm = Component.get(cid);
		snippet += '<tr><td class="nodetitlecell">'+H(cm.title)+'</td>';
		for (const v of VulnIDs) {
			if (CompVulns[cid] && CompVulns[cid].indexOf(v)==-1) {
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
	<p>\n\
	';

	if (num==0) {
		snippet += _H("No checklist vulnerabilities have been discarded on components of this project.");
	} else {
		snippet += '<br>'+
			_H("%% checklist %% (for %% unique %%) discarded on %% %% of this project.",
			num,
			plural(_("vulnerability"), _("vulnerabilities"), num),
			VulnIDs.length,
			plural(_("vulnerability"), _("vulnerabilities"), VulnIDs.length),
			CompIDs.length,
			plural(_("component"), _("components"), CompIDs.length)
		);
	}
	snippet += '</p><br><br>\n';

	return snippet;
}

function showcustomvulns() {
	var snippet = '';
	var num=0;
	var VulnTitles = [];// list of all threat titles that were removed at least once
	var CompIDs = [];	// list of all component IDs that had at least one threat removed
	var CompVulns = [];	// CompVulns[x] = list of threat titles removed for component with ID 'x'.

	// All Vulnerabilities
	var tit = new VulnerabilityIterator({project: Project.cid, common: true});

	// Iterate over all vulnerabilities to all components
	// First find all components with at least one vulnerability removed, and find all
	// vulnerabilities that were removed at least once.
	var cit = new ComponentIterator({project: Project.cid});
	cit.sortByTitle();
	for (const cm of cit) {
		for (const thid of cm.assmnt) {
			var ta = Assessment.get(thid);
			// Check whether this threat occurs in its checklist
			let found = false;
			for (const th of tit) {
				// we have a match
				if (th.type==ta.type && th.title==ta.title) {
					found = true;
					break;
				}
			}
			if (found) continue;
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
	// 1.7em = width of vulnerability columns
	// numvulns = number of vulnerability columns
	snippet = snippet.replace(/_WF_/, 20);
	snippet = snippet.replace(/_WC_/, 1.7);
	snippet = snippet.replace(/_TW_/, 20+1.7*VulnTitles.length);
	snippet = snippet.replace(/_NT_/, VulnTitles.length);
	for (const vuln of VulnTitles) {
		snippet += '<td class="headercell">'+H(vuln)+'</td>\n';
	}
	snippet += '\
	  </tr>\n\
	  </thead>\n\
	  <tbody>\n\
	';

	// Do each of the table rows
	for (const id of CompIDs) {
		let cm = Component.get(id);
		snippet += '<tr><td class="nodetitlecell">'+H(cm.title)+'</td>';
		for (const vul of VulnTitles) {
			if (CompVulns[cm.id] && CompVulns[cm.id].indexOf(vul)==-1) {
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
	<p>\n\
	';

	if (num==0) {
		snippet += _H("No custom vulnerabilities have been added to any of the components in this project.");
	} else {
		snippet += '<br>'+
			_H("%% custom %% (for %% unique %%) added to %% %% of this project.",
				num,
				plural(_("vulnerability"), _("vulnerabilities"), num),
				VulnTitles.length,
				plural(_("vulnerability"), _("vulnerabilities"), VulnTitles.length),
				CompIDs.length,
				plural(_("component"), _("components"), CompIDs.length)
			);
	}
	snippet += '</p><br><br>\n';

	return snippet;
}

// Initial cut-off for longlist
var MinValue = 'H';

function paintLonglist() {
	$('#at5').empty();

	var snippet = '\
		<h1 class="printonly">_LD_</h2>\
		<h2 class="printonly">_LTT_</h1>\
		<h2 class="printonly projectname">_PN_</h2>\
	';
	snippet = snippet.replace(/_LTT_/g, _H("Reports and Analysis Tools") );
	snippet = snippet.replace(/_LD_/g, _H("Risk longlist") );
	snippet = snippet.replace(/_PN_/g, H(Project.get(Project.cid).title));

	snippet += '<div id="longlist"></div>';
	$('#at5').html(snippet);

	var selectoptions = "";
	for (var i=Assessment.valueindex['U']; i<=Assessment.valueindex['V']; i++) {
		selectoptions += '<option value="_V_">_D_</option>\n';
		selectoptions = selectoptions.replace(/_V_/g, Assessment.values[i]);
		selectoptions = selectoptions.replace(/_D_/g, H(Assessment.descr[i]));
	}
	$('#minV').html(selectoptions);
	$('#minV').val(MinValue).selectmenu('refresh');

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
	cit.sortByTitle();

	for (const cm of cit) {
		for (const nc of tit) {
			// Find the threat assessment for this node
			var ta = null;
			for (const thid of cm.assmnt) {
				ta = Assessment.get(thid);
				if (ta.title==nc.title && ta.type==nc.type) break;
			}
			if (ta && ta.title==nc.title && ta.type==nc.type
			&& (
				(Assessment.valueindex[ta.total]>=Assessment.valueindex[MinValue] && Assessment.valueindex[ta.total]<Assessment.valueindex['X'])
				||
				(Assessment.valueindex[ta.total]==Assessment.valueindex['X'] && $('#incX').prop('checked'))
				||
				(Assessment.valueindex[ta.total]==Assessment.valueindex['A'] && $('#incA').prop('checked'))
				)
			) {
				matches.push({
					ta: ta.title,
					cm: cm.title,
					ccf: false,
					qw: (exclCm.indexOf(cm.id+'_'+ta.id)>=0),
					v: Assessment.valueindex[ta.total]
				});
			}
		}
	}
	tit = new NodeClusterIterator({project: Project.cid, isempty: false});
	for (const nc of tit) {
		if (!nc.assmnt) continue;

		ta = Assessment.get(nc.assmnt);
		if (
			(Assessment.valueindex[ta.total]>=Assessment.valueindex[MinValue] && Assessment.valueindex[ta.total]<Assessment.valueindex['X'])
			||
			(Assessment.valueindex[ta.total]==Assessment.valueindex['X'] && $('#incX').attr('checked')=='checked')
			||
			(Assessment.valueindex[ta.total]==Assessment.valueindex['A'] && $('#incA').attr('checked')=='checked')
		) {
			var r = NodeCluster.get(nc.root());
			matches.push({
				ta: r.title,
				cm: (nc.isroot() ? _("All nodes") : nc.title),
				ccf: true,
				qw: (exclCl.indexOf(nc.id)>=0),
				v: Assessment.valueindex[ta.total]
			});
		}
	}
	matches.sort( function(a,b) {
		// A(mbiguous) is the highest
		if (a.v==Assessment.valueindex['A']) {
			if (b.v==Assessment.valueindex['A'])  return 0;
			else return 1;
		}
		if (b.v==Assessment.valueindex['A']) {
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
	for (const m of matches) {
		if (m.v!=lastV || m.qw!=lastQW) {
			if (snippet!='') snippet+='<br>\n';
			snippet += '<b>' + H(Assessment.descr[m.v]) +
				(m.qw ? ' ' + _H("(quick wins)") : '')+
				'</b><br>\n';
			lastV = m.v;
			lastQW = m.qw;
		}
		if (count[m.v]) count[m.v]++;
		else count[m.v]=1;
		snippet +=
			H(m.cm) +
			' <span style="color: grey;">' +
			(m.ccf ? _H("and common cause risk") : _H("and risk")) +
			'</span> ' +
			H(m.ta) +
			'<br>\n';
	}
	// Add a line with subtotals and totals to the front of the snippet.
	var head = '';
	for (let i=Assessment.valueindex['A']; i<=Assessment.valueindex['X']; i++) {
		if (!count[i]) continue;
		if (head=='') {
			head += '(';
		} else {
			head += ', ';
		}
		head += count[i] + ' ' + H(Assessment.descr[i]);
	}
	if (head!='') {
		head += ')';
	}

	var total = 0;
	for (const c of count) total += (c ? c : 0);
	head = _H("Number of risks on longlist:") + ' ' + total + ' '+ head;
	head += '<br>\n';

	return head + '<br>' + snippet;
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
