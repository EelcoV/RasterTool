
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
const _ = lang.translate;

var Options = {
	// 0 = none, 1 = small, 2 = large
	vulnlevel: 2,
	// true = show, false = hide
	labels: true
};

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var win, helpwin;

// If the OS does not provide a file, then we will start with a blank, untitled document
var FileToBeOpened;

var template = [{
	label: _("File"),
	submenu: [{
		label: _("New"),
		accelerator: 'CmdOrCtrl+N',
		click: function (item, focusedWindow) { doNew(); }
	}, {
		label: _("Open..."),
		accelerator: 'CmdOrCtrl+O',
		click: function (item, focusedWindow) { doOpen(); }
	}, {
		label: _("Save"),
		accelerator: 'CmdOrCtrl+S',
		click: function (item, focusedWindow) {
			win.webContents.send('document-start-save');
		}
	}, {
		label: _("Save as..."),
		accelerator: 'Shift+CmdOrCtrl+Z',
		click: function (item, focusedWindow) {
			win.webContents.send('document-start-saveas');
		}
	}, {
		label: _("Save as PDF"),
		accelerator: 'CmdOrCtrl+P',
		click: doPrint
	}, {
		type: 'separator'
	}, {
		label: _("Details..."),
		click: function (item, focusedWindow) {
			win.webContents.send('show-details');
		}
	}, {
		type: 'separator'
	}, {
		label: _("Quit"),
		accelerator: 'CmdOrCtrl+W',
		role: 'close'
	}]
}, {
	label: _("Edit"),
	submenu: [{
		label: _("Undo"),
		accelerator: 'CmdOrCtrl+Z',
		role: 'undo'
	}, {
		label: _("Redo"),
		accelerator: 'Shift+CmdOrCtrl+Z',
		role: 'redo'
	}, {
		type: 'separator'
	}, {
		label: _("Cut"),
		accelerator: 'CmdOrCtrl+X',
		role: 'cut'
	}, {
		label: _("Copy"),
		accelerator: 'CmdOrCtrl+C',
		role: 'copy'
	}, {
		label: _("Paste"),
		accelerator: 'CmdOrCtrl+V',
		role: 'paste'
	}, {
		label: _("Select all"),
		accelerator: 'CmdOrCtrl+A',
		role: 'selectall'
	}]
}, {
	label: _("View"),
	submenu: [{
		label: _("Labels"),
		submenu: [{
			label: _("Show"),
			type: 'radio',
			click: function (item, focusedWindow) {
				Options.levels = true;
				win.webContents.send('options', 'labels', true);
			}
		}, {
			label: _("Hide"),
			type: 'radio',
			click: function (item, focusedWindow) {
				Options.levels = false;
				win.webContents.send('options', 'labels', false);
			}
		}]
	}, {
		label: _("Vulnerability levels"),
		submenu: [{
			label: _("Small"),
			type: 'radio',
			click: function (item, focusedWindow) {
				Options.levels = false;
				win.webContents.send('options', 'vulnlevel', 1);
			}
		}, {
			label: _("Large"),
			type: 'radio',
			click: function (item, focusedWindow) {
				Options.levels = false;
				win.webContents.send('options', 'vulnlevel', 2);
			}
		}, {
			label: _("None"),
			type: 'radio',
			click: function (item, focusedWindow) {
				Options.levels = false;
				win.webContents.send('options', 'vulnlevel', 0);
			}
		}]
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
		accelerator: (function () {
			if (process.platform === 'darwin') {
				return 'Ctrl+Command+F';
			} else {
				return 'F11';
			}
		})(),
		click: function (item, focusedWindow) {
			if (focusedWindow) {
				focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
			}
		}
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
		label: _("Show help"),
		click: function (item, focusedWindow) {	win.webContents.send('help-show'); }
	}]
}];



/***************************************************************************************************/
/***************************************************************************************************/



function debug(msg) {
	dialog.showErrorBox("Debug information", msg);
}

function createWindow() {
	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

	// Create the browser window.
	win = new BrowserWindow({
		width: 1082,
		height: 600,
		show: false
	});

	win.documentIsModified = false;

	// and load the base HTML of the app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'app/app.html'),
		protocol: 'file:',
		slashes: true
	  })
	);

	win.once('ready-to-show', function()  {
		if (FileToBeOpened) {
			// Do not start with a blank document
			ReadFileAndLoad(FileToBeOpened);
		} else {
			win.setTitle(_("Raster - No name"));
			win.documentIsModified = false;
			win.setDocumentEdited(false);
		}
		win.show();
	});

	win.on('close', function(e)  {
		if (!checkSaveModifiedDocument())
			e.preventDefault();
	});

	// Emitted when the window is closed.
	win.on('closed', function()  {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null;
	});

	ipc.on('document-modified', function()  {
		win.documentIsModified = true;
		win.setDocumentEdited(true);
	});

	ipc.on('document-save', function(event,str)  { doSave(str); });

	ipc.on('document-saveas', function(event,str)  { doSaveAs(str); });
}

/* Returns false if current document was modified and should be saved. */
function checkSaveModifiedDocument() {
	if (!win.documentIsModified)
		return true;

	var buttonval = dialog.showMessageBox(win, {
		type: 'warning',
		buttons: [_("Discard changes"), _("Cancel")],
		index: 1,
		title: _("Discard all changes?"),
		message: _("There are unsaved changes. If you continue those will be lost."),
		detail: _("Cancel to save changes.")
	});
	return (buttonval != 1);
}

function doSaveAs(str) {
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
					win.setRepresentedFilename(filename);
					win.loadedFile = filename;
					win.setTitle(docname);
					win.documentIsModified = false;
					win.setDocumentEdited(false);
					win.webContents.send('document-save-success');
				} catch (e) {
					dialog.showErrorBox(_("Project was not saved"), _("System notification:") +"\n"+e);
				}
			}
		});
}

function doSave(str) {
	if (win.loadedFile) {
		var docname = win.loadedFile.match(/[^\/]+$/)[0];
		try {
			fs.writeFileSync(win.loadedFile, str);
			win.documentIsModified = false;
			win.setDocumentEdited(false);
			win.webContents.send('document-save-success');
		} catch (e) {
			dialog.showErrorBox(_("Project was not saved"), _("System notification:") +"\n"+e);
		}
	} else {
		doSaveAs(str);
	}
}

function doOpen() {
	if (!checkSaveModifiedDocument()) {
		return;
	}
	win.focus();
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
	ReadFileAndLoad(filenames[0]);
}

function ReadFileAndLoad(filename) {
	try {
		var str = fs.readFileSync(filename, 'utf8');
		win.setRepresentedFilename(filename);
		win.loadedFile = filename;
		win.setTitle(filename.match(/[^\/]+$/)[0]);
		win.documentIsModified = false;
		win.setDocumentEdited(false);
		win.webContents.send('document-start-open', str);
	} catch (e) {
		dialog.showErrorBox(_("Cannot read the file"), _("System notification:") +"\n"+e);
	}
}

function doNew() {
	if (!checkSaveModifiedDocument()) {
		return;
	}
	win.FileToBeOpened = null;
	win.webContents.once('did-finish-load', function()  {
		win.setTitle(_("Raster - No name"));
		win.documentIsModified = false;
		win.setDocumentEdited(false);
	});
	win.reload();
}

function doPrint() {
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

function SetUpMenus() {
	if (process.platform === 'darwin') {
		const name = app.getName();
		template.unshift({
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
		var mi = template[4].submenu.shift();
		template[4].submenu.shift();
		template[4].submenu.unshift(mi);
		// Add one option
		template[4].submenu.push({
			type: 'separator'
		}, {
			label: 'Bring All to Front',
			role: 'front'
		});

	}
}

function ToggleRemarks(item,focusedWindow) {
	win.webContents.send('view-remarks',item.checked);
}

function activateSingleInstance() {
	if (win) {
		if (win.isMinimized()) win.restore();
		win.focus();
	}
}


/***************************************************************************************************/
/***************************************************************************************************/

// Disable hardware accelerationfor maximumcompatibility. Could be an option.
app.disableHardwareAcceleration();

SetUpMenus();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function()  {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
//	if (process.platform !== 'darwin') {
		app.quit();
//	}
});

//app.on('browser-window-created', function () {
//})

/* On Windows, the file to be opened is in argv[1]
 * On the Mac, it is provided through the open-file event
 */
app.on('open-file', function(event,file)  {
	if (fs.existsSync(file))
		FileToBeOpened = file;
});
if (process.argv.length>1 && fs.existsSync(process.argv[1]))
	FileToBeOpened = process.argv[1];


if (app.makeSingleInstance(activateSingleInstance)) {
	app.quit();
}




