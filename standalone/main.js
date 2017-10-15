
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

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, helpwin;

// If the OS does not provide a file, then we will start with a blank, untitled document
let FileToBeOpened;

let template = [{
	label: lang.translate("File"),
	submenu: [{
		label: lang.translate("New"),
		accelerator: 'CmdOrCtrl+N',
		click: function (item, focusedWindow) { doNew() }
	}, {
		label: lang.translate("Open..."),
		accelerator: 'CmdOrCtrl+O',
		click: function (item, focusedWindow) { doOpen() }
	}, {
		label: lang.translate("Save"),
		accelerator: 'CmdOrCtrl+S',
		click: function (item, focusedWindow) {
			win.webContents.send('document-start-save')
		}
	}, {
		label: lang.translate("Save as..."),
		accelerator: 'Shift+CmdOrCtrl+Z',
		click: function (item, focusedWindow) {
			win.webContents.send('document-start-saveas')
		}
	}, {
		label: lang.translate("Save as PDF"),
		accelerator: 'CmdOrCtrl+P',
		click: doPrint
	}, {
		type: 'separator'
	}, {
		label: lang.translate("Quit"),
		accelerator: 'CmdOrCtrl+W',
		role: 'close'
	}]
}, {
	label: lang.translate("Edit"),
	submenu: [{
		label: lang.translate("Undo"),
		accelerator: 'CmdOrCtrl+Z',
		role: 'undo'
	}, {
		label: lang.translate("Redo"),
		accelerator: 'Shift+CmdOrCtrl+Z',
		role: 'redo'
	}, {
		type: 'separator'
	}, {
		label: lang.translate("Cut"),
		accelerator: 'CmdOrCtrl+X',
		role: 'cut'
	}, {
		label: lang.translate("Copy"),
		accelerator: 'CmdOrCtrl+C',
		role: 'copy'
	}, {
		label: lang.translate("Paste"),
		accelerator: 'CmdOrCtrl+V',
		role: 'paste'
	}, {
		label: lang.translate("Select all"),
		accelerator: 'CmdOrCtrl+A',
		role: 'selectall'
	}]
}, {
	label: lang.translate("View"),
	submenu: [{
		label: lang.translate("Zoom"),
		submenu: [{
			label: lang.translate("Zoom in"),
			role: 'zoomin'
		}, {
			label: lang.translate("Zoom out"),
			role: 'zoomout'
		}, {
			label: lang.translate("Reset"),
			role: 'resetzoom'
		}]
	}, {
		label: lang.translate("Full screen"),
		accelerator: (function () {
			if (process.platform === 'darwin') {
				return 'Ctrl+Command+F'
			} else {
				return 'F11'
			}
		})(),
		click: function (item, focusedWindow) {
			if (focusedWindow) {
				focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
			}
		}
	}, {
		type: 'separator'
	}, {
		label: lang.translate("Developer tools"),
		accelerator: (function () {
			if (process.platform === 'darwin') {
				return 'Alt+Command+I'
			} else {
				return 'Ctrl+Shift+I'
			}
		})(),
		click: function (item, focusedWindow) {
			if (focusedWindow) {
				focusedWindow.toggleDevTools()
			}
		}
	}]
}, {
	label: lang.translate("Window"),
	role: 'window',
	submenu: [{
		label: lang.translate("Minimize"),
		accelerator: 'CmdOrCtrl+M',
		role: 'minimize'
	}, {
		label: lang.translate("Close"),
		accelerator: 'CmdOrCtrl+W',
		role: 'close'
	}]
}, {
	label: lang.translate("Help"),
	role: 'help',
	submenu: [{
		label: lang.translate("Show help"),
		click: function (item, focusedWindow) {	win.webContents.send('help-show') }
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
	}));

	win.once('ready-to-show', () => {
		if (FileToBeOpened) {
			// Do not start with a blank document
			ReadFileAndLoad(FileToBeOpened);
		} else {
			win.setTitle(lang.translate("Raster - No name"));
			win.documentIsModified = false;
			win.setDocumentEdited(false);
		}
		win.show();
	})

	win.on('close', (e) => {
		if (!checkSaveModifiedDocument())
			e.preventDefault();
	})

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null
	});

	ipc.on('document-modified', () => {
		win.documentIsModified = true;
		win.setDocumentEdited(true);
	})

	ipc.on('document-save', (event, str) => { doSave(str) });

	ipc.on('document-saveas', (event, str) => { doSaveAs(str) });
}

/* Returns false if current document was modified and should be saved. */
function checkSaveModifiedDocument() {
	if (!win.documentIsModified)
		return true;

	let buttonval = dialog.showMessageBox(win, {
		type: "warning",
		buttons: [lang.translate("Discard changes"), lang.translate("Cancel")],
		index: 1,
		title: lang.translate("Discard all changes?"),
		message: lang.translate("There are unsaved changes. If you continue those will be lost."),
		detail: "Cancel to save changes."
	});
	return (buttonval != 1);
}

function doSaveAs(str) {
	dialog.showSaveDialog(win, {
			title: lang.translate("Save project"),
			filters: [{
				name: lang.translate("Raster project"),
				extensions: ['raster']
			}]
		},
		(filename) => {
			if (filename) {
				let docname = filename.match(/[^\/]+$/)[0]
				try {
					fs.writeFileSync(filename, str)
					win.setRepresentedFilename(filename)
					win.loadedFile = filename
					win.setTitle(docname)
					win.documentIsModified = false
					win.setDocumentEdited(false)
					win.webContents.send('document-save-success')
				} catch (e) {
					dialog.showErrorBox(lang.translate("Project was not saved"), lang.translate("System notification:") +"\n"+e)
				}
			}
		});
}

function doSave(str) {
	if (win.loadedFile) {
		let docname = win.loadedFile.match(/[^\/]+$/)[0];
		try {
			fs.writeFileSync(win.loadedFile, str);
			win.documentIsModified = false;
			win.setDocumentEdited(false);
			win.webContents.send('document-save-success')
		} catch (e) {
			dialog.showErrorBox(lang.translate("Project was not saved"), lang.translate("System notification:") +"\n"+e);
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
	let filenames = dialog.showOpenDialog(win, {
		title: lang.translate("Open project"),
		filters: [{
				name: lang.translate("Raster project"),
				extensions: ['raster']
			},
			{
				name: lang.translate("All files"),
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
		dialog.showErrorBox(ang.translate("Cannot read the file"), lang.translate("System notification:") +"\n"+e);
	}
}

function doNew() {
	if (!checkSaveModifiedDocument()) {
		return;
	}
	win.FileToBeOpened = null
	win.webContents.once('did-finish-load', () => {
		win.setTitle(lang.translate("Raster - No name"));
		win.documentIsModified = false;
		win.setDocumentEdited(false);
	});
	win.reload();
}

function doPrint() {
	let filename = dialog.showSaveDialog(win, {
		title: lang.translate("Opslaan als PDF"),
		filters: [{
				name: lang.translate("PDF files"),
				extensions: ['pdf']
			}],
		properties: ['openFile']
	});
	if (!filename) return;

	win.webContents.printToPDF({
		pageSize: 'A3',
		landscape: true,
		printBackground: true
	}, (error, data) => {
		if (error) {
			dialog.showErrorBox(lang.translate("File was not saved"), lang.translate("System notification:") +"\n"+error);
			return;
		}
		try {
			fs.writeFileSync(filename, data);
		}
		catch (e) {
			dialog.showErrorBox(lang.translate("File was not saved"), lang.translate("System notification:") +"\n"+error);
		}
	})
}

function SetUpMenus() {
	if (process.platform === 'darwin') {
		const name = app.getName();
		template.unshift({
			label: name,
			submenu: [{
				label: `About ${name}`,
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
				label: `Hide ${name}`,
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
					app.quit()
				}
			}]
		});

		// Window menu.
		// Remove the Close option (it should be under the File menu)
		let mi = template[4].submenu.shift();
		template[4].submenu.shift();
		template[4].submenu.unshift(mi);
		// Add one option
		template[4].submenu.push({
			type: 'separator'
		}, {
			label: 'Bring All to Front',
			role: 'front'
		})

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
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
//	if (process.platform !== 'darwin') {
		app.quit();
//	}
})

//app.on('browser-window-created', function () {
//})

/* On Windows, the file to be opened is in argv[1]
 * On the Mac, it is provided through the open-file event
 */
app.on('open-file', (event,file) => {
	if (fs.existsSync(file))
		FileToBeOpened = file;
});
if (process.argv.length>1 && fs.existsSync(process.argv[1]))
	FileToBeOpened = process.argv[1];


if (app.makeSingleInstance(activateSingleInstance)) {
	app.quit();
}




