param([string]$Tag = 'sf_19')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$target = (rustc --print host-tuple).Trim()
if ($target -ne 'x86_64-pc-windows-msvc') { throw "This downloader supports Windows x64. Provide a Stockfish binary for $target manually." }
$release = Invoke-RestMethod "https://api.github.com/repos/official-stockfish/Stockfish/releases/tags/$Tag"
$asset = $release.assets | Where-Object name -eq 'stockfish-windows-x86-64-universal.zip'
if (!$asset) { throw 'Windows x64 universal asset is missing.' }
$cache = Join-Path $projectRoot '.cache/stockfish'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$archive = Join-Path $cache $asset.name
if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest $asset.browser_download_url -OutFile $archive }
$actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if (!$asset.digest -or "sha256:$actual" -ne $asset.digest) { throw 'Stockfish archive checksum mismatch or missing upstream digest.' }
Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $cache $Tag) -Force
$files = Get-ChildItem -LiteralPath (Join-Path $cache $Tag) -Recurse -File
$exe = $files | Where-Object Name -eq 'stockfish-windows-x86-64-universal.exe' | Select-Object -First 1
if (!$exe) { throw 'Stockfish executable is missing.' }
$binaries = Join-Path $projectRoot 'src-tauri/binaries'
$licenses = Join-Path $projectRoot 'src-tauri/licenses'
New-Item -ItemType Directory -Force -Path $binaries,$licenses | Out-Null
Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $binaries "stockfish-$target.exe")
$license = $files | Where-Object Name -eq 'Copying.txt' | Select-Object -First 1
if (!$license) { throw 'Stockfish license is missing.' }
Copy-Item -LiteralPath $license.FullName -Destination (Join-Path $licenses 'Stockfish-GPL-3.0.txt')
# Preserve the exact corresponding upstream source for redistribution.
$sourceArchive = Join-Path $licenses "Stockfish-$Tag-source.zip"
Invoke-WebRequest "https://github.com/official-stockfish/Stockfish/archive/refs/tags/$Tag.zip" -OutFile $sourceArchive
@{
  version = $Tag; release = $release.html_url; asset = $asset.browser_download_url
  archiveSha256 = $actual; binarySha256 = (Get-FileHash -LiteralPath (Join-Path $binaries "stockfish-$target.exe") -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $licenses 'stockfish.json') -Encoding utf8
Write-Host "Bundled Stockfish $Tag for $target (checksum verified)."
