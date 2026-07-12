<#
    Loki — build script.
    Prompts for a version, stamps it everywhere, installs missing deps,
    builds a single Loki.exe with PyInstaller, moves it to exec/, and
    cleans up all PyInstaller artifacts.

    Run:  powershell -ExecutionPolicy Bypass -File build.ps1
#>

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

# --- prompt for version (x.y.z) ---
do {
    $answer = Read-Host "Enter version (x.y.z) [default: $current]"
    if ([string]::IsNullOrWhiteSpace($answer)) { $Version = $current } else { $Version = $answer.Trim() }
    $valid = $Version -match '^\d+\.\d+\.\d+$'
    if (-not $valid) { Write-Host "Invalid format. Use x.y.z (e.g. 1.0.0)." -ForegroundColor Yellow }
} until ($valid)

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
Move-Item -Path $exe -Destination $target -Force

# --- cleanup PyInstaller junk ---
Write-Step "Cleaning up"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build, dist, "version_info.txt"
Get-ChildItem -Path $PSScriptRoot -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nDone -> $target" -ForegroundColor Green
