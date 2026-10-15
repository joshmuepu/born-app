@echo off
rem Windows: runs the unattended media spikes with the repo's own Electron (no Node install needed).
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=1
"..\..\node_modules\electron\dist\electron.exe" overnight.js %*
echo.
echo Finished. Look in docs\design\media\spikes\results\ for the OVERNIGHT-*.md file.
pause
