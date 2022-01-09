# Configuration - Raster app

There are a few advanced settings that can be modified by editing the `prefs.json` configuration file. This file is stored in the user's application data directory:

* On Windows: `%APPDIR%` (most often `C:\Users\«username»\AppData\Roaming\Raster`).
* On MacOS: `Library/Application Support/Raster` in the user's home directory.

## prefs.json

The file `prefs.json` is used by the Raster application to save user preferences between sessions. This is a plain JSON file, and the two relevant properties are:

* `disablehardwareacceleration`: Set this to `false` to *enable* hardware acceleration. It is disabled by default for maximum compatibility.
* `iconsets`: This is an array of strings that specifies the names of the available iconsets. The the first name will be used for new projects.To disable the "default" iconset and only allow iconset "myicons", use the following line:

	`"iconsets": ["myicons"]`

## iconsets

Each project will use one iconset for its diagrams. Two iconsets are provided: "default" and "new icons". You can create and add addition iconsets; see the file `Iconsets.md` for details.
Additional iconset must be stored in the user's application data directory, inside the `iconset` directory. The `iconset` directory does not exist by default; create it before adding custom iconsets.

---

Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md

