on run (volumeName)
	tell application "Finder"
		tell disk (volumeName as string)
			open
			
			set theXOrigin to 60
			set theYOrigin to 60
			set theWidth to 760
			set theHeight to 430
			
			set theBottomRightX to (theXOrigin + theWidth)
			set theBottomRightY to (theYOrigin + theHeight)
			set rootDir to "/Volumes/" & volumeName
			set dsStore to "\"" & "/Volumes/" & volumeName & "/" & ".DS_STORE\""
			
			tell container window
				set current view to icon view
				set toolbar visible to false
				set statusbar visible to false
				set the bounds to {theXOrigin, theYOrigin, theBottomRightX, theBottomRightY}
				set statusbar visible to false
			end tell
			
			set opts to the icon view options of container window
			tell opts
				set icon size to 80
				set text size to 16
				set arrangement to not arranged
			end tell
			set background picture of opts to file ".background:image.png"
			
			set myLoc to (path to desktop folder)
			if file "Desktop" exists then
				-- assume all is well
			else
				make new alias to myLoc at POSIX file rootDir
				set name of result to " "
			end if
			
			-- Positioning
			set position of item "Raster.app" to {5, 130}
			set position of item " " to {385, 130}
			set position of item "!!" to {510, 310}
			set position of item "Documentation" to {0, 500}
			
			-- Hiding
			set extension hidden of item "Raster.app" to true
			
			close
			open
			-- Force saving of the size
			delay 1
			
			tell container window
				set statusbar visible to false
				set the bounds to {theXOrigin, theYOrigin, theBottomRightX - 10, theBottomRightY - 10}
			end tell
		end tell
		
		delay 1
		
		tell disk (volumeName as string)
			tell container window
				set statusbar visible to false
				set the bounds to {theXOrigin, theYOrigin, theBottomRightX, theBottomRightY}
			end tell
		end tell
		
		--give the finder some time to write the .DS_Store file
		delay 3
		
		set waitTime to 0
		set ejectMe to false
		repeat while ejectMe is false
			delay 1
			set waitTime to waitTime + 1
			
			if (do shell script "[ -f " & dsStore & " ]; echo $?") = "0" then set ejectMe to true
		end repeat
	end tell
end run
