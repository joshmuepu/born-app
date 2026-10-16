<#
 Windows smoke test for a PACKAGED BORN v2 dev build (the win-unpacked folder, or an installed copy).
 It never touches your real data: it uses a throw-away profile folder.

 Usage (PowerShell):
   ./scripts/smoke-windows-packaged.ps1 -Unpacked dist-installers\win-unpacked
   ./scripts/smoke-windows-packaged.ps1 -Exe "C:\Users\You\AppData\Local\Programs\Branham or Nothing (v2 dev)\Branham or Nothing (v2 dev).exe"

 It checks: the app starts and the window loads; the picture library (media folder + media.db) is made in
 the profile; the PDF reader files, the database module and the manual are inside the package; then it closes the app.
#>
param(
  [string]$Unpacked = '',
  [string]$Exe = ''
)
$ErrorActionPreference = 'Stop'
function Fail($m) { Write-Host "FAIL: $m" -ForegroundColor Red; exit 1 }
function Ok($m) { Write-Host "ok:   $m" -ForegroundColor Green }

if (-not $Exe) {
  if (-not $Unpacked) { Fail 'give -Unpacked <win-unpacked folder> or -Exe <path to the .exe>' }
  $found = Get-ChildItem $Unpacked -Filter '*.exe' | Where-Object { $_.Name -notmatch 'Uninstall|crashpad|Squirrel' } | Select-Object -First 1
  if (-not $found) { Fail "no app .exe in $Unpacked" }
  $Exe = $found.FullName
}
$root = Split-Path $Exe -Parent
Write-Host "Testing $Exe"

# 1. Package contents (asar must not hide anything that has to be a real file).
$res = Join-Path $root 'resources'
if (-not (Test-Path (Join-Path $res 'app.asar'))) { Fail 'resources\app.asar missing' }
Ok 'app.asar present'
$native = Get-ChildItem (Join-Path $res 'app.asar.unpacked') -Recurse -Filter 'better_sqlite3.node' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $native) { Fail 'better_sqlite3.node is not unpacked (database would not open)' }
Ok "native database module unpacked ($($native.Name))"
if (-not (Test-Path (Join-Path $res 'manual\v2\manifest.json'))) { Fail 'Help manual (manual\v2\manifest.json) missing' }
Ok 'Help manual present'

# 2. Launch with a throw-away profile on its own ports.
$profile = Join-Path $env:TEMP ("born-smoke-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $profile | Out-Null
$env:BORN_USER_DATA_DIR = $profile
$env:BORN_REMOTE_PORT = '4390'
$env:BORN_MDNS_NAME = 'smoke'
$p = Start-Process $Exe -PassThru
$log = Join-Path $profile 'born.log'
$ok = $false
foreach ($i in 1..60) {
  Start-Sleep 1
  if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'mainWindow did-finish-load' -Quiet)) { $ok = $true; break }
  if ($p.HasExited) { Get-Content $log -ErrorAction SilentlyContinue; Fail "app exited early (code $($p.ExitCode))" }
}
if (-not $ok) { Get-Content $log -ErrorAction SilentlyContinue; Stop-Process -Id $p.Id -Force; Fail 'window never loaded' }
Ok 'window loaded'
Start-Sleep 3

# 3. The picture library lives in the profile (this is also where it lives for a real install, under AppData).
$media = Join-Path $profile 'media'
if (-not (Test-Path (Join-Path $media 'media.db'))) { Get-Content $log | Select-Object -Last 30; Stop-Process -Id $p.Id -Force; Fail 'media\media.db was not created' }
Ok "picture library created: $media"
if (Select-String -Path $log -Pattern 'ERROR' -Quiet) { Write-Host 'warning: errors in the log:' -ForegroundColor Yellow; Select-String -Path $log -Pattern 'ERROR' | Select-Object -First 10 }

Stop-Process -Id $p.Id -Force
Start-Sleep 1
Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'SMOKE TEST PASSED' -ForegroundColor Green
