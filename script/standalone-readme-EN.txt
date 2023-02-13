If you downloaded this Disk Image from the internet you must manually unlock
the Raster app before it can run. Otherwise your Mac will claim that Raster is
damaged, and will even suggest that you move it to the Bin.

To unlock, follow these three steps:

1. Drag the Raster.app from the Disk Image onto your Desktop.
2. Open the Terminal app. You will find it in Applications, in the Utilities folder.
3. In the Terminal window type (or copy & paste) the following text:

	xattr -d com.apple.quarantine ~/Desktop/Raster.app

Now you will be able to run Raster, and you can move the app to the Applications
folder if you wish.
