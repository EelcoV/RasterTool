echo on
X:
cd \

if not exist cache\versions-EN.bat goto ENdone
call cache\versions-EN.bat
call script\_lang.bat
:ENdone

if not exist cache\versions-NL.bat goto NLdone
call cache\versions-NL.bat
call script\_lang.bat
:NLdone
