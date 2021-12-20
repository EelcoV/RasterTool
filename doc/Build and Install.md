# Build

Some tools are required to build the applications. Since development has been done on MacOS, most of these
are Mac-centered. However, it should be possible to build the tools on other Unix-like platforms.

When using Xcode on Mac, the build targets Clean, Build Server, Build Electron, and All are available. 
* Clean: empties the build directory. 
* All: creates all distribution files.
* Build Server: makes only the intranet version.
* Build Electron: make the standalone versions (for each platform, architecture and language).

## Build and install the Intranet version

You need:
1. XCode. Not essential, but useful and free. MacOS only.
2. filepp (http://www-users.york.ac.uk/%7Edm26/filepp/). If not available, the standard C-Preprocessor can be used.
3. The ESLint utility to check JavaScript code. Optional.

There is one build script for the server. From the root of the Raster tools project, run `script/build-server.sh`. This will create a `tar.gz` file under the `build` directory containing all the server files.

You will need a web server that can handle PHP. Place all files in a directory that is accessible by the web server. All files require read-permission. The webserver requires write-permission on the directory `public_group/SharedProjects`. Note: if set the `localonly` option in `group.json` to true, no write permission is required.

For access control to a separate set of server projects, duplicate the directory `public group` under a different name and restrict access to it. A sample `.htaccess` file to this effect is provided for reference. Consult the manual of your web server for specifics.

The public group of the tool is accessible via the URL http://yourwebserver/path/ .
Protected access is accessible via http://yourwebserver/path/YOURGROUPNAME/


## Build and install the Standalone version

In addition to the tools required for the Intranet version, you need the following.
1. MacOS is required to build the standalone version for MacOS. The special utilities xattr, defaults, iconutil, and hdiutil are necessary to manipulate packages, disk images and icons. Those are not available on non-Mac platforms.
2. Wine (CodeWeavers` CrossOver, or https://www.winehq.org/) is required to build the standalone version for WIndows under MacOS. If you build the tools under Windows, and if you have the basic Unix shell and utilities available, you should be able to build the standalone versions without Wine.
3. Alternatively, you can use (virtualised) Microsoft Windows installation to build the standalone version for Windows. The X:-drive must be mapped to the source directory (e.g. x:\build contains the build data).

To build, run these scripts from the root of the Raster tools project:
* `script/build-electron.sh` to build the MacOS and Windows versions.
If you cannot use Wine, or if you attempt to build on Windows, run the `winbuild.bat` batch file to create the Windows ZIP, exe and full installer.

The build results are found in the `build` directory. For both platforms, the tool is available in English (EN) or Dutch (NL). For MacOS both Intel and ARM versions will be created. For Windows both 32-bit and 64-bit versions will be created.
The MacOS version is distributed using the DMG files. To install, doubleclick the DMG file, and drag the Raster application to your Applications folder.
The Windows version is distributed in three formats.
* The full installer requires Administrator rights. It will install in `C:\Program Files`, create an uninstall option in the Settings / Control Panel, and will associate .raster files with the tool.
* The unpack-version requires no special rights. It will simply unpack the files in a location of choice. The user will have to associate .raster files manually, using the `Open With` option in Explorer.
* The Zip-version is for those who do not trust exe files. It contains the same files as the unpacker.
