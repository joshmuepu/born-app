# Packaged-app smoke for Windows (scripts only; run in Windows PowerShell 5.1 or pwsh on the CI runner or any Windows machine).
# Starts the unpacked app on an isolated profile / remote port / mDNS name, then checks: the window loads, the libraries are seeded and
# answer through the phone-remote API, the installer is a real PE, and the exe carries the v1 icon (not Electron's default).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\qa\smoke-windows.ps1 [-Unpacked dist-installers\win-unpacked] [-Port 14316] [-OutDir smoke-out]
param(
  [string]$Unpacked = 'dist-installers\win-unpacked',
  [string]$Port = '14316',
  [string]$OutDir = 'smoke-out'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
$fail = New-Object System.Collections.ArrayList
$summary = New-Object System.Collections.ArrayList
function Check([string]$label, [bool]$ok, [string]$detail) {
  $line = "{0}  {1}  {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' })), $label, $detail
  Write-Host $line; [void]$summary.Add($line)
  if (-not $ok) { [void]$fail.Add($label) }
}

# ── start the packaged app, isolated ───────────────────────────────────────────
$exe = Get-ChildItem $Unpacked -Filter '*.exe' | Where-Object { $_.Name -notmatch 'crashpad|Squirrel|Uninstall' } | Select-Object -First 1
if (-not $exe) { throw "no unpacked exe in $Unpacked" }
Check 'packaged exe found' $true $exe.FullName
$prof = Join-Path ([IO.Path]::GetTempPath()) 'born-smoke-profile'
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
$env:BORN_USER_DATA_DIR = $prof; $env:BORN_REMOTE_PORT = $Port; $env:BORN_MDNS_NAME = 'born-remote-v1ci'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$p = Start-Process $exe.FullName -PassThru
$log = Join-Path $prof 'born.log'

try {
  $loaded = $false
  foreach ($i in 1..90) {
    Start-Sleep 1
    if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'mainWindow did-finish-load' -Quiet)) { $loaded = $true; break }
    if ($p.HasExited) { break }
  }
  Check 'main window loads' $loaded ("exited=" + $p.HasExited)

  # the libraries are copied into the data folder on first run — give that time
  $seeded = $false
  foreach ($i in 1..180) {
    $s = Join-Path $prof 'sermons.db'; $l = Join-Path $prof 'library.db'
    if ((Test-Path $s) -and (Test-Path $l) -and ((Get-Item $s).Length -gt 5MB) -and ((Get-Item $l).Length -gt 5MB)) { $seeded = $true; break }
    Start-Sleep 1
  }
  $sz = ''
  foreach ($f in 'sermons.db', 'library.db') { $q = Join-Path $prof $f; if (Test-Path $q) { $sz += "$f=" + [math]::Round((Get-Item $q).Length / 1MB) + 'MB ' } }
  Check 'libraries seeded into the data folder' $seeded $sz

  # ── the phone-remote answers, and the libraries answer through it ───────────
  $base = "http://127.0.0.1:$Port"
  try { $r = Invoke-WebRequest "$base/ping" -UseBasicParsing -TimeoutSec 15; Check 'remote /ping answers' ($r.StatusCode -eq 200) ("status " + $r.StatusCode) } catch { Check 'remote /ping answers' $false $_.Exception.Message }
  try { $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15; Check 'remote page is served with frame protection' (($r.Headers['X-Frame-Options'] -eq 'DENY')) ("X-Frame-Options=" + $r.Headers['X-Frame-Options']) } catch { Check 'remote page served' $false $_.Exception.Message }
  try { $r = Invoke-RestMethod "$base/api/search/sermons?q=faith" -TimeoutSec 60; $n = $r.Count; Check 'sermon search returns results' ($n -gt 100) "$n results" } catch { Check 'sermon search returns results' $false $_.Exception.Message }
  try { $r = Invoke-RestMethod "$base/api/search/songs?q=amazing" -TimeoutSec 60; $n = $r.Count; Check 'song search returns results' ($n -gt 0) "$n results" } catch { Check 'song search returns results' $false $_.Exception.Message }
  try { $b = Invoke-RestMethod "$base/api/search/bible?q=John%203:16" -TimeoutSec 60; Check 'Bible lookup returns a passage' ($b.kind -eq 'passage') ("kind=" + $b.kind) } catch { Check 'Bible lookup returns a passage' $false $_.Exception.Message }
}
finally {
  if (Test-Path $log) { Copy-Item $log (Join-Path $OutDir 'born.log') -Force }
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith((Resolve-Path $Unpacked).Path) } | Stop-Process -Force -ErrorAction SilentlyContinue
}

# ── installer sanity ───────────────────────────────────────────────────────────
$setup = Get-ChildItem 'dist-installers\*.exe' | Select-Object -First 1
if ($setup) {
  $bytes = [System.IO.File]::ReadAllBytes($setup.FullName)[0..1]
  Check 'installer is a real PE, 40 MB or more' (($setup.Length -ge 40MB) -and ($bytes[0] -eq 0x4D) -and ($bytes[1] -eq 0x5A)) ("{0} ({1} MB)" -f $setup.Name, [math]::Round($setup.Length / 1MB, 1))
} else { Check 'installer present' $false 'none in dist-installers' }

# ── the exe carries the v1 icon, not Electron's default (read straight from the exe's resources; see verify-exe-icon.cjs) ──
$iconOut = & node scripts\qa\verify-exe-icon.cjs $exe.FullName 'build\icons\icon.ico' 'node_modules\electron\dist\electron.exe' 2>&1
$iconOut | ForEach-Object { Write-Host $_ }
$iconOut | Set-Content (Join-Path $OutDir 'exe-icon.txt')
Check 'exe icon resources match build\icons\icon.ico (and not the Electron default)' ($LASTEXITCODE -eq 0) (($iconOut | Select-Object -Last 3) -join ' | ')
$ico = Get-FileHash 'build\icons\icon.ico' -Algorithm SHA256
Check 'icon.ico in the build is the v1 icon (sha256 starts 4f3e98c7)' ($ico.Hash.ToLower().StartsWith('4f3e98c7')) $ico.Hash.Substring(0, 8).ToLower()

$summary | Set-Content (Join-Path $OutDir 'smoke-summary.txt')
Write-Host ("`nsmoke-windows: {0} checks, {1} failed" -f $summary.Count, $fail.Count)
if ($fail.Count -gt 0) { exit 1 }
