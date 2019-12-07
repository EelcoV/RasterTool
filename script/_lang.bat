script\rcedit-x86.exe %basedir%\raster.exe --set-version-string CompanyName "The Raster Method" --set-version-string FileDescription Raster --set-file-version %rasternumversion%
script\rcedit-x86.exe %basedir%\raster.exe --set-version-string InternalName Raster --set-version-string OriginalFilename raster.exe --set-version-string ProductName Raster
script\rcedit-x86.exe %basedir%\raster.exe --set-version-string LegalCopyright "Copyright reserved" --set-product-version "%rasterversion% (%rasterseason%)" --set-icon script/raster.ico

cd build
rename electron-v%electronversion%-win32-ia32-%lang% Raster

del raster-win32-v%rasternumversion%-%lang%.zip
..\cache\7z\7z.exe a -tzip raster-win32-v%rasternumversion%-%lang%.zip Raster

del raster-v%rasternumversion%-%lang%-unpack.exe
copy /y ..\cache\7z\7z.sfx ..\cache\7z\raster.sfx
..\script\rcedit-x86.exe ..\cache\7z\raster.sfx --set-icon ..\script\installraster.ico
..\cache\7z\7z.exe a -sfxraster.sfx raster-v%rasternumversion%-%lang%-unpack.exe Raster

rename Raster electron-v%electronversion%-win32-ia32-%lang%

cd \
cd %basedir%
..\..\cache\nsis\makensis.exe /nocd ..\..\script\Raster.%lang%.nsis

cd \
