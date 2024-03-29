
const electron = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const https = require('https');

const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;
const dialog = electron.dialog;
const ipc = electron.ipcMain;

const lang = require('./e-translation.js');
// This is a convenient shortcut, identical to the function in the other Raster javascript files.
const _ = lang.translate;

// If the OS does not provide a file, then we will start with a blank, untitled document
var FileToBeOpened = null;

var MenuTemplate;
var appMenu;

/* Labels and Vulnlevels are set in the main process, and sent to the Renderer using
 *   win.webContents.send('options', kind, value)
 * PDF options are set in the Renderer, and sent to the main process using
 *   ipc.on('option-modified', handler)
 * Updates are checked in CheckForUpdate()
 */
const DefaultRasterOptions = {
	// true = show, false = hide
	labels: true,
	// 0 = none, 1 = small, 2 = large
	vulnlevel: 2,
	// true = show, false = hide
	minimap: true,
	// 0 = portrait, 1 = landscape
	pdforientation: 1,
	// 3 = A3, 4 = A4
	pdfsize: 4,
	// scale factor in percentage (80 means a factor 0.8)
	pdfscale: 80,
	// datetime of last successful check for updates
	updatechecktime: 0,
	// Hardware acceleration: there is no UI for this (must edit preference file by hand!)
	disablehardwareacceleration: true,
	// Default iconsets installed
	iconsets: ['Default','Classic']
};

const prefsDir = app.getPath('userData');
const prefsFile = prefsDir + "/prefs.json";

// Keep a global reference of the window objects. Otherwise windows will
// be closed automatically when the JavaScript object is garbage collected.
var Win = {};

/***************************************************************************************************/
/***************************************************************************************************/

function createWindow(filename) {
	// Find a position that does not overlap an existing window.
	// Otherwise the File|New operation, for example, will be confusing to the user.
	var pos = {x: 100, y:100};
	var allwins = BrowserWindow.getAllWindows();
	var i=0;
	// In all reasonable circumstances this loop will end in finite time :-)
	while (i<allwins.length) {
		var p = allwins[i].getPosition();
		if (p[0]==pos.x || p[1]==pos.y) {
			pos.x+=20;
			pos.y+=15;
			i=0;
			continue; // redo from start
		}
		i++;
	}

	// Create the browser window.
	var win = new BrowserWindow({
		webPreferences: {
			/* Node integration is disabled by default since 5.0.0. Context isolation is enabled since 12.0.0.
			 * We *know* that we only load local scripts, so Node integration should not pose a danger.
			 */
			nodeIntegration: true,
			contextIsolation: false
		},
		x: pos.x,
		y: pos.y,
		width: 1400, // Need more width for split-view CCFs
		height: 650,
		show: false
	});
	Win[win.id] = win;

	win.documentIsModified = false;
	win.pathname = null;

	// and load the base HTML of the app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'app/app.html'),
		protocol: 'file:',
		slashes: true
	  })
	);

	win.once('ready-to-show', function()  {
		win.webContents.send('window-id',win.id);
		win.webContents.send('prefs-dir',prefsDir);
		if (filename) {
			ReadFileAndLoad(win,filename);
		} else {
			RecordFilename(win,null);
		}
		win.webContents.send('options', 'labels', app.rasteroptions.labels);
		win.webContents.send('options', 'vulnlevel', app.rasteroptions.vulnlevel);
		win.webContents.send('options', 'iconsets', JSON.stringify(app.rasteroptions.iconsets));
		EnableMenuItems(true);
		win.show();
		CheckForUpdates(win);
	});

	win.on('close', function(e)  {
		if (!checkSaveModifiedDocument(win)) {
			e.preventDefault();
		} else {
			// Allow garbage collection to remove the window
			delete Win[win.id];
		}
	});
}

function ReadFileAndLoad(win,filename) {
	try {
		var str = fs.readFileSync(filename, 'utf8');
		win.webContents.send('document-start-open', str);
		RecordFilename(win,filename);
		app.addRecentDocument(filename);
	} catch (e) {
		dialog.showErrorBox(_("Cannot read the file"), _("System notification:") +"\n"+e);
	}
}

function RecordFilename(win,filename) {
	var docname;
	win.pathname = filename;
	if (filename) {
		win.setRepresentedFilename(filename);
		if (process.platform=="win32") {
			// Windows uses backslash in path names
			docname = filename.match(/[^\\]+$/)[0];
			win.setTitle(docname + ' - Raster');
		} else {
			docname = filename.match(/[^/]+$/)[0];
			win.setTitle(docname);
		}
	} else {
		win.setTitle(_("No name - Raster"));
	}
	win.documentIsModified = false;
	win.setDocumentEdited(false);
	win.webContents.send('document-save-success',docname);
	//ForceWindowRepaint();
}

/* Returns false if current document was modified and should be saved. */
function checkSaveModifiedDocument(win) {
	if (!win.documentIsModified)  return true;

	var buttonval = dialog.showMessageBoxSync(win, {
		type: 'warning',
		buttons: [_("Cancel"), _("Discard changes"), _("Save changes")],
		cancelID: 0,
		defaultId: 2,
		title: _("Discard all changes?"),
		message: _("There are unsaved changes. If you continue those will be lost.")
	});
	if (buttonval==2) {
		win.webContents.send('document-finalsave');
	}
	return (buttonval==1);
}

function doSaveAs(win,str) {
	var filename = dialog.showSaveDialogSync(win, {
		title: _("Save project"),
		filters: [{
			name: _("Raster project"),
			extensions: ['raster']
		}]
	});
	if (filename) {
		try {
			fs.writeFileSync(filename, str);
			RecordFilename(win,filename);
		} catch (e) {
			dialog.showErrorBox(_("Project was not saved"), _("System notification:") +"\n"+e);
		}
	}
}

function doSave(win,str) {
	if (win.pathname) {
		try {
			fs.writeFileSync(win.pathname, str);
			RecordFilename(win,win.pathname);
		} catch (e) {
			dialog.showErrorBox(_("Project was not saved"), _("System notification:") +"\n"+e);
		}
	} else {
		doSaveAs(win,str);
	}
}

function doOpen(win) {
	var filenames = dialog.showOpenDialogSync(win, {
		title: _("Open project"),
		filters: [{
				name: _("Raster project"),
				extensions: ['raster']
			},
			{
				name: _("All files"),
				extensions: ['*']
			}],
		properties: ['openFile']
	});
	if (!filenames || filenames.length == 0) return;
	// On MacOS win might be null when no windows are open.
	if (win && win.pathname==null && !win.documentIsModified) {
		// Discard the empty window that is automatically created on startup.
		ReadFileAndLoad(win,filenames[0]);
	} else {
		createWindow(filenames[0]);
	}
}

function doNew() {
	createWindow(null);
}

function tryClose(win) {
	if (checkSaveModifiedDocument(win)) {
		// Allow garbage collection to remove the window
		delete Win[win.id];
		win.close();
	}
}

function doSaveAsPDF(win) {
	var filename = dialog.showSaveDialogSync(win, {
		title: _("Save as PDF"),
		filters: [{
				name: _("PDF files"),
				extensions: ['pdf']
			}],
		properties: ['openFile']
	});
	if (!filename) return;

	win.webContents.printToPDF({
		pageSize: (app.rasteroptions.pdfsize==3 ? 'A3' : 'A4'),
		landscape: (app.rasteroptions.pdforientation==1),
		scaleFactor: app.rasteroptions.pdfscale,
		marginsType: 2, // minimum margins
		printBackground: true
	})
	.then(data => {
		try {
			fs.writeFileSync(filename, data);
		} catch (error) {
			dialog.showErrorBox(_("File was not saved"), _("System notification:") +"\n"+error);
		}
	})
	.catch(error => {
		dialog.showErrorBox(_("File was not saved"), _("System notification:") +"\n"+error);
	});
}

function doPrint(win) {
	win.webContents.print({
		printBackground: true
	}, (success, errorType) => {
		if (!success && errorType!='cancelled') dialog.showErrorBox(_("An error occurred while printing"), _("System notification:") +"\n"+errorType);
	});
}

/***************************************************************************************************/
/***************************************************************************************************/

//function debug(msg) {
//	dialog.showErrorBox("Debug information", msg);
//}

function EnableViewRadio(menu,val)  {
	var menuitems = Menu.getApplicationMenu().items;
	let viewm = menuitems[(process.platform=='darwin' ? 3 : 2)].submenu.items;
	let subm = viewm[menu].submenu.items;
	let i;

	switch (menu) {
	case 0:		// Labels
		subm[val?0:1].checked = true;
		break;
	case 1:		// Vulnerability levels
		if (val==1) i=0;
		if (val==2) i=1;
		if (val==0) i=2;
		subm[i].checked = true;
		break;
	case 2:		// Mini-map
		subm[val?0:1].checked = true;
		break;
	}
}

function EnableMenuItems(val)  {
	if (process.platform !== 'darwin')  return;
	// MacOS. Grey out the several menu items when no windows are open
	var menuitems = Menu.getApplicationMenu().items; // Deprecated
	var fileMenu = menuitems[1].submenu.items;
	fileMenu[2].enabled = val;
	fileMenu[3].enabled = val;
	fileMenu[4].enabled = val;
	fileMenu[5].enabled = val;
	fileMenu[6].enabled = val;
	var viewMenu = menuitems[3].submenu.items;
	viewMenu[4].enabled = val;
	viewMenu[5].enabled = val;
	viewMenu[7].enabled = val;
	viewMenu[8].enabled = val;
	var helpMenu = menuitems[5].submenu.items;
	helpMenu[0].enabled = val;
}

function AllWindowsSetLabels(val) {
	app.rasteroptions.labels = val;
	var allwins = BrowserWindow.getAllWindows();
	for (const win of allwins) {
		win.webContents.send('options', 'labels', val);
	}
	SavePreferences();
}

function AllWindowsSetVulnlevel(val) {
	app.rasteroptions.vulnlevel = val;
	var allwins = BrowserWindow.getAllWindows();
	for (const win of allwins) {
		win.webContents.send('options', 'vulnlevel', val);
	}
	SavePreferences();
}

function AllWindowsSetMinimap(val) {
	app.rasteroptions.minimap = val;
	var allwins = BrowserWindow.getAllWindows();
	for (const win of allwins) {
		win.webContents.send('options', 'minimap', val);
	}
	SavePreferences();
}

function SavePreferences(/*win*/) {
	try {
		fs.writeFileSync(prefsFile, JSON.stringify(app.rasteroptions,null,'\t'));
	} catch (e) {
		// ignore silently
	}
}

// Once per day, check whether a newer version is available, and alert the user if so.
// Silently ignore errors if the check fails (e.g. due to no internet connection).
function CheckForUpdates(win) {
	var appversion = app.getVersion();
	if (appversion.toLowerCase().indexOf('beta')!=-1) {
		// Do not check for updates to beta versions.
		return;
	}

	// Test time since last check; interval in msec (24 hours)
	if (app.rasteroptions.updatechecktime + 24*60*60*1000 > Date.now()) {
		//console.log('Skipping check for update.');
		return;
	}

	https.get('https://risicotools.nl/docs/toollatestversion.txt').on('response', function (response) {
		var body = '';
		response.on('data', function (chunk) {
			body += chunk;
		});
		response.on('end', function () {
			console.log('Toolversion retrieved; HTTP result code = ' + response.statusCode);
			if (response.statusCode == '200') {
				// Use only the first line
				body = body.replace(/$.*/m, '');
				if (body != appversion) {
					dialog.showMessageBoxSync({
						title: _("Update available"),
						message: _("An update of this tool is available."),
						detail: _("Version %% is available; you have version %%.", body, appversion)
							+ "\n"
							+ _("Visit the risicotools.nl website to download the latest version.")
					});
				}
				// Record the datetime of thisupdate check
				app.rasteroptions.updatechecktime = Date.now();
				SavePreferences(win);
			} else {
				// Ignore silently
				//debug('Got error: ' + response.statusCode);
				/*jsl:pass*/
			}
		});
	}).on('error', function() {
		// Ignore silently
		//debug('Got error: ' + e.message);
	});
}

/***************************************************************************************************/
/***************************************************************************************************/

ipc.on('option-modified', function(event,id,opt,val) {
	var win = BrowserWindow.fromId(id);
	if (!win)  return;

	switch (opt) {
	case 'labels':
		app.rasteroptions.labels = val;
		EnableViewRadio(0,val);
		break;
	case 'vulnlevel':
		app.rasteroptions.vulnlevel = val;
		EnableViewRadio(1,val);
		break;
	case 'minimap':
		app.rasteroptions.minimap = val;
		EnableViewRadio(2,val);
		break;
	case 'pdforientation':
		app.rasteroptions.pdforientation = val;
		break;
	case 'pdfsize':
		app.rasteroptions.pdfsize = val;
		break;
	case 'pdfscale':
		app.rasteroptions.pdfscale = val;
		break;
	default:
		break;
	}
	SavePreferences(win);
});

ipc.on('document-new', function(/*event,id*/) {
	doNew();
});

ipc.on('document-import', function(/*event,id*/) {
	doOpen(null);
});

ipc.on('document-modified', function(event,id) {
	if (!id) return;
	let win = BrowserWindow.fromId(id);
	if (!win) return;

	win.documentIsModified = true;
	win.setDocumentEdited(true);
});

ipc.on('document-save', function(event,id,str) {
	var win = BrowserWindow.fromId(id);
	if (!win)  return;

	doSave(win,str);
});

ipc.on('document-save-then-close', function(event,id,str) {
	var win = BrowserWindow.fromId(id);
	if (!win)  return;

	doSave(win,str);
	win.close();
});

ipc.on('document-saveas', function(event,id,str) {
	var win = BrowserWindow.fromId(id);
	if (!win)  return;
	
	doSaveAs(win,str);
});

ipc.on('do-saveaspdf', function(event,id) {
	var win = BrowserWindow.fromId(id);
	if (!win)  return;
	
	doSaveAsPDF(win);
});

// This method will be called when Electron has finished initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
	// Create the application menu
	appMenu = Menu.buildFromTemplate(MenuTemplate);
	Menu.setApplicationMenu(appMenu);

	// On Windows, the project is given on the commandline, so it can be opened now.
	createWindow(FileToBeOpened);
	FileToBeOpened = null;

	// On MacOS, the project is given through an open-file event.
	app.on('open-file', function(event,file)  {
		if (fs.existsSync(file)) {
			createWindow(file);
		}
	});
});

// Quit when all windows are closed.
app.on('window-all-closed', function()  {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	} else {
		EnableMenuItems(false);
	}
});

// On the Mac, the file to be opened is provided through the open-file event
// Save the filename, because the app is not yet ready to create a BrowserWindow
app.on('open-file', function(event,file)  {
	if (fs.existsSync(file)) {
		FileToBeOpened = file;
	}
});

// Prevent all navigation
// See https://electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
app.on('web-contents-created', function(event, contents) {
	contents.on('will-navigate', function () {
		event.preventDefault();
	});
});

/***************************************************************************************************/

// Create a directory to store preferences in
try {
	fs.mkdirSync(prefsDir);
} catch (e) {
	// Ignore silently
}

app.rasteroptions = {};
// Copy default options into app.rasteroptions
Object.keys(DefaultRasterOptions).forEach(function(key/*,i,a*/) {
	app.rasteroptions[key] = DefaultRasterOptions[key];
});

// Load preferences
try {
	var str = fs.readFileSync(prefsFile);
	var raw_pref = JSON.parse(str);
	Object.keys(DefaultRasterOptions).forEach(function(key/*,i,a*/) {
		if (raw_pref && raw_pref[key]!=undefined) {
			app.rasteroptions[key] = raw_pref[key];
		}
	});
} catch (e) {
	// ignore silently
}

if (app.rasteroptions.disablehardwareacceleration==true) {
	// Disable hardware acceleration for maximum compatibility.
	app.disableHardwareAcceleration();
}

// On Windows, the file to be opened is in argv[1]
if (process.argv.length>1 && fs.existsSync(process.argv[1])) {
	FileToBeOpened = process.argv[1];
}

// Menu template:
// 0 : File
// 1 : Edit
// 2 : View
// 3 : Window
// 4 : Help
MenuTemplate = [{
	label: _("File"),
	submenu: [{
		label: _("New"),
		accelerator: 'CmdOrCtrl+N',
		click: function () { doNew(); }
	}, {
		label: _("Open..."),
		accelerator: 'CmdOrCtrl+O',
		click: function (item, focusedWindow) { doOpen(focusedWindow); }
	}, {
		label: _("Save"),
		accelerator: 'CmdOrCtrl+S',
		click: function (item, focusedWindow) {
			if (focusedWindow) focusedWindow.webContents.send('document-start-save');
		}
	}, {
		label: _("Save as..."),
		accelerator: 'Shift+CmdOrCtrl+S',
		click: function (item, focusedWindow) {
			if (focusedWindow) focusedWindow.webContents.send('document-start-saveas');
		}
	}, {
		label: _("Close"),
		role: 'close',
		click: function (item, focusedWindow) { tryClose(focusedWindow); }
	}, {
		type: 'separator'
	}, {
		label: _("Save as PDF..."),
		accelerator: 'Shift+CmdOrCtrl+P',
		click: function (item, focusedWindow) {
			if (focusedWindow) focusedWindow.webContents.send('pdf-settings-show',app.rasteroptions);
		}
	}, {
		label: _("Print"),
		accelerator: 'CmdOrCtrl+P',
		click: function (item, focusedWindow) {
			if (focusedWindow) doPrint(focusedWindow);
		}
	}, {
		type: 'separator'
	}, {
		label: _("Quit"),
		role: 'quit'
	}]
}, {
	label: _("Edit"),
	submenu: [{
		label: _("Undo"),
//		role: 'undo',
		accelerator: 'CmdOrCtrl+Z',
		click: function (item, focusedWindow) {	if (focusedWindow) focusedWindow.webContents.send('edit-undo'); }
	}, {
		label: _("Redo"),
//		role: 'redo',
		accelerator: 'Shift+CmdOrCtrl+Z',
		click: function (item, focusedWindow) {	if (focusedWindow) focusedWindow.webContents.send('edit-redo'); }
	}, {
		type: 'separator'
	}, {
		label: _("Cut"),
		role: 'cut'
	}, {
		label: _("Copy"),
		role: 'copy'
	}, {
		label: _("Paste"),
		role: 'paste'
	}, {
		label: _("Select all"),
		role: 'selectall'
	}]
}, {
	label: _("View"),
	submenu: [{
		label: _("Labels"),
		submenu: [
			{
				label: _("Show labels"),
				type: 'radio',
				checked: (app.rasteroptions.labels==true),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetLabels(true);
				}
			}, {
				label: _("Hide labels"),
				type: 'radio',
				checked: (app.rasteroptions.labels==false),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetLabels(false);
				}
			}
		]
	},{
		label: _("Vulnerability levels"),
		submenu: [
			{
				label: _("Small vulnerability levels"),
				type: 'radio',
				checked: (app.rasteroptions.vulnlevel==1),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetVulnlevel(1);
				}
			}, {
				label: _("Large vulnerability levels"),
				type: 'radio',
				checked: (app.rasteroptions.vulnlevel==2),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetVulnlevel(2);
				}
			}, {
				label: _("No vulnerability levels"),
				type: 'radio',
				checked: (app.rasteroptions.vulnlevel==0),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetVulnlevel(0);
				}
			}
		]
	}, {
		label: _("Mini-map"),
		submenu: [
			{
				label: _("Show mini-map"),
				type: 'radio',
				checked: (app.rasteroptions.labels==true),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetMinimap(true);
				}
			}, {
				label: _("Hide mini-map"),
				type: 'radio',
				checked: (app.rasteroptions.labels==false),
				click: function (/*item, focusedWindow*/) {
					AllWindowsSetMinimap(false);
				}
			}
		]
	},{
		type: 'separator'
	}, {
		label: _("Find nodes..."),
		accelerator: 'CmdOrCtrl+F',
		click: function (item, focusedWindow) {	if (focusedWindow) focusedWindow.webContents.send('find-show'); }
	}, {
		label: _("Edit labels..."),
		accelerator: 'CmdOrCtrl+L',
		click: function (item, focusedWindow) {	if (focusedWindow) focusedWindow.webContents.send('labeledit-show'); }
	}, {
		label: _("Project details..."),
		accelerator: 'Shift+CmdOrCtrl+D',
		click: function (item, focusedWindow) {	if (focusedWindow) focusedWindow.webContents.send('props-show'); }
	}, {
		type: 'separator'
	}, {
		label: _("Zoom"),
		submenu: [{
			label: _("Zoom in"),
			role: 'zoomin'
		}, {
			label: _("Zoom out"),
			role: 'zoomout'
		}, {
			label: _("Reset"),
			role: 'resetzoom'
		}]
	}, {
		label: _("Full screen"),
		role: 'togglefullscreen'
	}, {
		type: 'separator'
	}, {
		label: _("Developer tools"),
		accelerator: (function () {
			if (process.platform === 'darwin') {
				return 'Alt+Command+I';
			} else {
				return 'Ctrl+Shift+I';
			}
		})(),
		click: function (item, focusedWindow) {
			if (focusedWindow) focusedWindow.toggleDevTools();
		}
	}]
}, {
	label: _("Window"),
	role: 'window',
	submenu: [{
		label: _("Minimize"),
		accelerator: 'CmdOrCtrl+M',
		role: 'minimize'
	}]
}, {
	label: _("Help"),
	role: 'help',
	submenu: [{
		label: _("Quick guide..."),
		accelerator: 'F1',
		click: function (item, focusedWindow) {	if (focusedWindow) focusedWindow.webContents.send('help-show'); }
	}, {
		label: _("About..."),
		click: function (item, focusedWindow) {
			if (!focusedWindow) return;
			dialog.showMessageBoxSync(focusedWindow, {
				type: 'none',
				buttons: [_("OK")],
				title: _("About this program"),
				message: _("Version") + ' ' + app.getVersion()
			});
		}
	}]
}];

// Fix the default menu above for MacOS and Windows
if (process.platform === 'darwin') {
	const name = app.getName();

	// Insert an application menu at the front
	MenuTemplate.unshift({
		label: name,
		submenu: [{
			label: 'About ' + name,
			role: 'about'
		}, {
			type: 'separator'
		}, {
			label: 'Services',
			role: 'services',
			submenu: []
		}, {
			type: 'separator'
		}, {
			label: 'Hide ' + name,
			accelerator: 'Command+H',
			role: 'hide'
		}, {
			label: 'Hide Others',
			accelerator: 'Command+Alt+H',
			role: 'hideothers'
		}, {
			label: 'Show All',
			role: 'unhide'
		}, {
			type: 'separator'
		}, {
			label: 'Quit',
			accelerator: 'Command+Q',
			click: function () {
				app.quit();
			}
		}]
	});

	// No About... option in the Help menu
	MenuTemplate[5].submenu.splice(1,1);
} else {
	// No Window menu on Windows
	MenuTemplate.splice(3,1);
}

