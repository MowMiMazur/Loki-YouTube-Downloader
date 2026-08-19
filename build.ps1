<#
    Loki — build script.
    Prompts for a version, stamps it everywhere, installs missing deps,
    builds a single Loki.exe with PyInstaller, moves it to exec/, and
    cleans up all PyInstaller artifacts.

    Run:  powershell -ExecutionPolicy Bypass -File build.ps1
          powershell -ExecutionPolicy Bypass -File build.ps1 -Version 1.0.3
          powershell -ExecutionPolicy Bypass -File build.ps1 -StableEngine

    -Version       skips the prompt (x.y.z).
    -StableEngine  bundles the latest stable yt-dlp instead of the nightly.
                   Default is the nightly: the 2026.07.04 stable defaults to the
                   android_vr player client, which YouTube gated on 2026-08-02,
                   so every DASH stream fails with HTTP 403. Drop this once a
                   stable release includes the 2026-08-18 client changes.
#>

param(
    [string]$Version,
    [switch]$StableEngine
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Write-Step($msg) { Write-Host "`n== $msg ==" -ForegroundColor Cyan }

Write-Host "Loki build" -ForegroundColor Green

# --- current version from loki/__init__.py ---
$initPath = "loki\__init__.py"
$initFull = Join-Path $PSScriptRoot $initPath
$initText = [IO.File]::ReadAllText($initFull, [Text.UTF8Encoding]::new($false))
$current  = "0.0.0"
if ($initText -match 'APP_VERSION\s*=\s*"([^"]+)"') { $current = $Matches[1] }

# --- version: parameter, or prompt (x.y.z) ---
if ($Version) {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') { Write-Error "Invalid -Version. Use x.y.z (e.g. 1.0.0)." }
} else {
    do {
        $answer = Read-Host "Enter version (x.y.z) [default: $current]"
        if ([string]::IsNullOrWhiteSpace($answer)) { $Version = $current } else { $Version = $answer.Trim() }
        $valid = $Version -match '^\d+\.\d+\.\d+$'
        if (-not $valid) { Write-Host "Invalid format. Use x.y.z (e.g. 1.0.0)." -ForegroundColor Yellow }
    } until ($valid)
}

Write-Host "Building v$Version" -ForegroundColor Green

# --- python check ---
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found on PATH."
}

# --- stamp version into loki/__init__.py ---
Write-Step "Stamping version"
$newInit = [regex]::Replace($initText, 'APP_VERSION\s*=\s*"[^"]+"', "APP_VERSION = `"$Version`"")
[IO.File]::WriteAllText($initFull, $newInit, [Text.UTF8Encoding]::new($false))

# --- dependencies ---
Write-Step "Installing dependencies"
python -m pip install --disable-pip-version-check -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Error "pip install (requirements) failed." }

# The download engine decides whether YouTube serves anything at all, so it is
# pinned to the newest build available rather than to whatever requirements.txt
# resolved (see -StableEngine in the header).
if ($StableEngine) {
    Write-Host "Engine: latest stable yt-dlp" -ForegroundColor Yellow
    python -m pip install --disable-pip-version-check --upgrade yt-dlp
} else {
    Write-Host "Engine: yt-dlp nightly" -ForegroundColor Yellow
    python -m pip install --disable-pip-version-check --pre --upgrade yt-dlp
}
if ($LASTEXITCODE -ne 0) { Write-Error "pip install (yt-dlp) failed." }
$engine = python -c "import yt_dlp; print(yt_dlp.version.__version__)"
Write-Host "Bundling yt-dlp $engine" -ForegroundColor Green
python -m pip install --disable-pip-version-check pyinstaller
if ($LASTEXITCODE -ne 0) { Write-Error "pip install (pyinstaller) failed." }

# --- Windows version resource ---
Write-Step "Writing version resource"
$p  = $Version.Split('.')
$vv = "$($p[0]), $($p[1]), $($p[2]), 0"
$versionInfo = @"
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=($vv),
    prodvers=($vv),
    mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable('040904B0', [
        StringStruct('CompanyName', 'MAZNET Mateusz Mazur'),
        StringStruct('FileDescription', 'Loki - YouTube Downloader'),
        StringStruct('FileVersion', '$Version'),
        StringStruct('InternalName', 'Loki'),
        StringStruct('LegalCopyright', '(c) 2026 Mateusz Mazur'),
        StringStruct('OriginalFilename', 'Loki.exe'),
        StringStruct('ProductName', 'Loki'),
        StringStruct('ProductVersion', '$Version')
      ])
    ]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
"@
[IO.File]::WriteAllText((Join-Path $PSScriptRoot "version_info.txt"), $versionInfo, [Text.UTF8Encoding]::new($false))

# --- build ---
Write-Step "Running PyInstaller"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build, dist
python -m PyInstaller --noconfirm --clean Loki.spec
if ($LASTEXITCODE -ne 0) { Write-Error "PyInstaller build failed." }

$exe = "dist\Loki.exe"
if (-not (Test-Path $exe)) { Write-Error "Build output not found: $exe" }

# --- move exe to exec/ ---
Write-Step "Moving executable"
$execDir = Join-Path $PSScriptRoot "exec"
New-Item -ItemType Directory -Force -Path $execDir | Out-Null
$target = Join-Path $execDir "Loki-v$Version.exe"
# Move-Item -Force still refuses an existing target here, so clear it first
# (rebuilding the same version number must not fail). A running instance holds
# a lock on its own .exe — say so plainly instead of failing on Remove-Item.
if (Test-Path $target) {
    $running = Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $target }
    if ($running) {
        Write-Error "Loki v$Version is running (PID $($running.Id -join ', ')). Close it and run the build again; the new build is waiting in dist\Loki.exe."
    }
    Remove-Item -Path $target -Force
}
Move-Item -Path $exe -Destination $target -Force

# --- cleanup PyInstaller junk ---
Write-Step "Cleaning up"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build, dist, "version_info.txt"
Get-ChildItem -Path $PSScriptRoot -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nDone -> $target" -ForegroundColor Green
