
const electron = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;
const dialog = electron.dialog;
const ipc = electron.ipcMain;
const shell = electron.ipcMain;

const lang = require('./e-translation.js');
// This is a convenient shortcut, identical to the function in the other Raster javascript files.
const _ = lang.translate;

// If the OS does not provide a file, then we will start with a blank, untitled document
var FileToBeOpened = null;

var MenuTemplate;

const DefaultRasterOptions = {
	// true = show, false = hide
	labels: true,
	// 0 = none, 1 = small, 2 = large
	vulnlevel: 2
};

// Keep a global reference of the window objects. Otherwise windows will
// be closed automatically when the JavaScript object is garbage collected.
var Win = {};

/***************************************************************************************************/
/***************************************************************************************************/

function debug(msg) {
	dialog.showErrorBox("Debug information", msg);
}

function createWindow(filename) {
	const menu = Menu.buildFromTemplate(MenuTemplate);
	Menu.setApplicationMenu(menu);

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
		x: pos.x,
		y: pos.y,
		width: 1082,
		height: 600,
		show: false
	});
	Win[win.id] = win;

	win.documentIsModified = false;
	win.pathname = null;
	win.rasteroptions = {
		labels: DefaultRasterOptions.labels,
		vulnlevel: DefaultRasterOptions.vulnlevel
	};

	// and load the base HTML of the app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'app/app.html'),
		protocol: 'file:',
		slashes: true
	  })
	);

	win.once('ready-to-show', function()  {
		win.webContents.send('window-id',win.id);
		if (filename) {
			ReadFileAndLoad(win,filename);
		} else {
			RecordFilename(win,null);
		}
		win.webContents.send('options', 'labels', win.rasteroptions.labels);
		win.webContents.send('options', 'vulnlevel', win.rasteroptions.vulnlevel);
		win.show();
	});

	win.on('focus', function(e)  {
		// Reset the View menu radio options
		var viewMenu = menu.items[3].submenu.items;
		// 0 = Show, 1 = Hide
		var labels_idx = (win.rasteroptions.labels ? 0 : 1);
		// 3 = small, 4 = large, 5 = none
		var vulnlevel_idx = (win.rasteroptions.vulnlevel==0 ? 5 : (win.rasteroptions.vulnlevel==1 ? 3 : 4));
		if (viewMenu[ labels_idx ]) viewMenu[ labels_idx ].checked = true;
		if (viewMenu[ vulnlevel_idx ]) viewMenu[ vulnlevel_idx ].checked = true;
		Menu.setApplicationMenu(menu);
	});

	win.on('close', function(e)  {
		if (!checkSaveModifiedDocument(win))
			e.preventDefault();
		else
			// Dereference the window object, usually you would store windows
			// in an array if your app supports multi windows, this is the time
			// when you should delete the corresponding element.
			delete Win[win.id];
	});

	// Emitted when the window is closed.
//	win.on('closed', function()  {
//	});
}

function ReadFileAndLoad(win,filename) {
	try {
		var str = fs.readFileSync(filename, 'utf8');
		RecordFilename(win,filename);
		win.webContents.send('document-start-open', str);
		app.addRecentDocument(filename);
	} catch (e) {
		dialog.showErrorBox(_("Cannot read the file"), _("System notification:") +"\n"+e);
	}
}

function RecordFilename(win,filename) {
	win.pathname = filename;
	if (filename) {
		win.setRepresentedFilename(filename);
		if (process.platform=="win32") {
			// Windows uses backslash in path names
			win.setTitle( filename.match(/[^\\]+$/)[0] + ' - Raster');
		} else {
			win.setTitle( filename.match(/[^\/]+$/)[0] );
		}
	} else {
		win.setTitle(_("No name - Raster"));
	}
	win.documentIsModified = false;
	win.setDocumentEdited(false);
}

/* Returns false if current document was modified and should be saved. */
function checkSaveModifiedDocument(win) {
	if (!win.documentIsModified)
		return true;

	var buttonval = dialog.showMessageBox(win, {
		type: 'warning',
		buttons: [_("Cancel"), _("Discard changes")],
		cancelID: 0,
		defaultId: 0,
		title: _("Discard all changes?"),
		message: _("There are unsaved changes. If you continue those will be lost."),
		detail: _("Cancel to save changes.")
	});
	return (buttonval != 0);
}

function doSaveAs(win,str) {
	dialog.showSaveDialog(win, {
			title: _("Save project"),
			filters: [{
				name: _("Raster project"),
				extensions: ['raster']
			}]
		},
		function(filename) {
			if (filename) {
				var docname = filename.match(/[^\/]+$/)[0];
				try {
					fs.writeFileSync(filename, str);
					RecordFilename(win,filename);
					win.webContents.send('document-save-success');
				} catch (e) {
					dialog.showErrorBox(_("Project was not saved"), _("System notification:") +"\n"+e);
				}
			}
		});
}

function doSave(win,str) {
	if (win.pathname) {
		try {
			fs.writeFileSync(win.pathname, str);
			RecordFilename(win,win.pathname);
			win.webContents.send('document-save-success');
		} catch (e) {
			dialog.showErrorBox(_("Project was not saved"), _("System notification:") +"\n"+e);
		}
	} else {
		doSaveAs(win,str);
	}
}

function doOpen(win) {
	var filenames = dialog.showOpenDialog(win, {
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

function doNew(win) {
	createWindow(null);
}

function doPrint(win) {
	var filename = dialog.showSaveDialog(win, {
		title: _("Opslaan als PDF"),
		filters: [{
				name: _("PDF files"),
				extensions: ['pdf']
			}],
		properties: ['openFile']
	});
	if (!filename) return;

	win.webContents.printToPDF({
		pageSize: 'A3',
		landscape: true,
		printBackground: true
	}, function(error, data) {
		if (error) {
			dialog.showErrorBox(_("File was not saved"), _("System notification:") +"\n"+error);
			return;
		}
		try {
			fs.writeFileSync(filename, data);
		}
		catch (e) {
			dialog.showErrorBox(_("File was not saved"), _("System notification:") +"\n"+error);
		}
	});
}

/***************************************************************************************************/
/***************************************************************************************************/

ipc.on('document-modified', function(event,id) {
	var win = BrowserWindow.fromId(id);
	if (!win)
		return;
	win.documentIsModified = true;
	win.setDocumentEdited(true);
});

ipc.on('document-save', function(event,id,str) {
	var win = BrowserWindow.fromId(id);
	if (!win)
		return;
	doSave(win,str);
});

ipc.on('document-saveas', function(event,id,str) {
	var win = BrowserWindow.fromId(id);
	if (!win)
		return;
	doSaveAs(win,str);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
	createWindow(FileToBeOpened);
	FileToBeOpened = null;
	app.on('open-file', function(event,file)  {
		if (fs.existsSync(file))
			createWindow(file);
	});
});

// Quit when all windows are closed.
app.on('window-all-closed', function()  {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	} else {
		// MacOS. Grey out the several menu items when no windows are open
		var menuitems = Menu.getApplicationMenu().items;
		var fileMenu = menuitems[1].submenu.items;
		fileMenu[2].enabled = false;
		fileMenu[3].enabled = false;
		fileMenu[4].enabled = false;
		fileMenu[5].enabled = false;
		fileMenu[6].enabled = false;
		var viewMenu = menuitems[3].submenu.items;
		viewMenu[0].enabled = false;
		viewMenu[1].enabled = false;
		viewMenu[3].enabled = false;
		viewMenu[4].enabled = false;
		viewMenu[5].enabled = false;
		viewMenu[7].enabled = false;
		viewMenu[8].enabled = false;
		viewMenu[9].submenu.items[0].enabled = false;
		viewMenu[9].submenu.items[1].enabled = false;
		viewMenu[9].submenu.items[2].enabled = false;
		viewMenu[10].enabled = false;
		viewMenu[12].enabled = false;
		var helpMenu = menuitems[5].submenu.items;
		helpMenu[0].enabled = false;
	}
});

// On the Mac, the file to be opened is provided through the open-file event
// Save the filename, because the app is not yet ready to create a BrowserWindow
app.on('open-file', function(event,file)  {
	if (fs.existsSync(file))
		FileToBeOpened = file;
});

/***************************************************************************************************/

// Disable hardware accelerationfor maximum compatibility. Could be an option.
app.disableHardwareAcceleration();

// On Windows, the file to be opened is in argv[1]
if (process.argv.length>1 && fs.existsSync(process.argv[1]))
	FileToBeOpened = process.argv[1];

MenuTemplate = [{
	label: _("File"),
	submenu: [{
		label: _("New"),
		accelerator: 'CmdOrCtrl+N',
		click: function (item, focusedWindow) { doNew(focusedWindow); }
	}, {
		label: _("Open..."),
		accelerator: 'CmdOrCtrl+O',
		click: function (item, focusedWindow) { doOpen(focusedWindow); }
	}, {
		label: _("Save"),
		accelerator: 'CmdOrCtrl+S',
		click: function (item, focusedWindow) {
			focusedWindow.webContents.send('document-start-save');
		}
	}, {
		label: _("Save as..."),
		accelerator: 'Shift+CmdOrCtrl+Z',
		click: function (item, focusedWindow) {
			focusedWindow.webContents.send('document-start-saveas');
		}
	}, {
		type: 'separator'
	}, {
		label: _("PDF settings"),
		click: function (item, focusedWindow) {
			focusedWindow.webContents.send('pdf-settings-show');
		}
	}, {
		label: _("Save as PDF"),
		accelerator: 'CmdOrCtrl+P',
		click: function (item, focusedWindow) {
			doPrint(focusedWindow);
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
		role: 'undo'
	}, {
		label: _("Redo"),
		role: 'redo'
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
		label: _("Show labels"),
		type: 'radio',
		checked: (DefaultRasterOptions.labels==true),
		click: function (item, focusedWindow) {
			focusedWindow.rasteroptions.labels = true;
			focusedWindow.webContents.send('options', 'labels', true);
		}
	}, {
		label: _("Hide labels"),
		type: 'radio',
		checked: (DefaultRasterOptions.labels==false),
		click: function (item, focusedWindow) {
			focusedWindow.rasteroptions.labels = false;
			focusedWindow.webContents.send('options', 'labels', false);
		}
	}, {
		type: 'separator'
	}, {
		label: _("Small vulnerability levels"),
		type: 'radio',
		checked: (DefaultRasterOptions.vulnlevel==1),
		click: function (item, focusedWindow) {
			focusedWindow.rasteroptions.vulnlevel = 1;
			focusedWindow.webContents.send('options', 'vulnlevel', 1);
		}
	}, {
		label: _("Large vulnerability levels"),
		type: 'radio',
		checked: (DefaultRasterOptions.vulnlevel==2),
		click: function (item, focusedWindow) {
			focusedWindow.rasteroptions.vulnlevel = 2;
			focusedWindow.webContents.send('options', 'vulnlevel', 2);
		}
	}, {
		label: _("No vulnerability levels"),
		type: 'radio',
		checked: (DefaultRasterOptions.vulnlevel==0),
		click: function (item, focusedWindow) {
			focusedWindow.rasteroptions.vulnlevel = 0;
			focusedWindow.webContents.send('options', 'vulnlevel', 0);
		}
	}, {
		type: 'separator'
	}, {
		label: _("Find nodes..."),
		accelerator: 'CmdOrCtrl+F',
		click: function (item, focusedWindow) {	focusedWindow.webContents.send('find-show'); }
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
			if (focusedWindow) {
				focusedWindow.toggleDevTools();
			}
		}
	}]
}, {
	label: _("Window"),
	role: 'window',
	submenu: [{
		label: _("Minimize"),
		accelerator: 'CmdOrCtrl+M',
		role: 'minimize'
	}, {
		label: _("Close"),
		accelerator: 'CmdOrCtrl+W',
		role: 'close'
	}]
}, {
	label: _("Help"),
	role: 'help',
	submenu: [{
		label: _("Quick guide..."),
		click: function (item, focusedWindow) {	focusedWindow.webContents.send('help-show'); }
	}]
}];

// Fix the default menu above for MacOS
if (process.platform === 'darwin') {
	const name = app.getName();
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

	// Window menu.
	// Remove the Close option (it should be under the File menu)
	var mi = MenuTemplate[4].submenu.pop();
	MenuTemplate[1].submenu.pop();
	MenuTemplate[1].submenu.push(mi);
	// Add one option
	MenuTemplate[4].submenu.push({
		type: 'separator'
	}, {
		label: 'Bring All to Front',
		role: 'front'
	});

}

