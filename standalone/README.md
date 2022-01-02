# Configuration - Raster app

There are a few advanced settings that can be modified by editing configuration files. These files are stored in the user's application data directory:

* On Windows: `%APPDIR%` (most often `....\Raster`).
* On MacOS: `Library/Application Support/Raster` in the user's home directory.

The following files can be used. 

## prefs.json

The `prefs.json` is used by the Raster application to save user preferences between sessions. This is a plain JSON file, and the only relevant property is `disablehardwareacceleration`. Set this to `false` to *enable* hardware acceleration. It is disabled by default for maximum compatibility.

## group.json

This JSON file is mainly used in the intranet version of the tool. Its only purpose in the standalone version is to indicate the iconsets that are in use. By default the `group.json` does not exist. Create it when adding custom iconsets.

* *iconsets:* (array of strings, default is ["default"]) The names of the available iconsets; the first set will be used for new projects. 

## iconsets

Each project will use one iconset for its diagrams. The default iconset is "default", but can be changed in the project properties window. The default iconset is part of the Raster application. Additional iconset must be stored in the user's application data directory, inside the `iconset` directory. The `iconset` directory does not exist by default; create it before adding custom iconsets.

See the file `Iconsets.md` for a description on how to create new icons for use in diagrams.

---

Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md

