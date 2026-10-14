param([Parameter(Mandatory)][string]$Tag, [string]$OutputDirectory = '.cache/release')
$ErrorActionPreference = 'Stop'
if ($Tag -notmatch '^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$') { throw 'Invalid release tag.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -Raw (Join-Path $projectRoot 'src-tauri/tauri.conf.json') | ConvertFrom-Json).version
if ($Tag -ne "v$version") { throw 'Tag must match the application version.' }
$output = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
if (Test-Path -LiteralPath $output) {
    if (@(Get-ChildItem -Force -LiteralPath $output).Count) { throw 'Use an empty output directory to avoid stale release files.' }
}
New-Item -ItemType Directory -Force -Path $output | Out-Null
$releaseRoot = Join-Path $projectRoot 'src-tauri/target/release'
$installers = @(Get-ChildItem -LiteralPath (Join-Path $releaseRoot 'bundle/nsis') -Filter "*_${version}_x64-setup.exe")
if ($installers.Count -ne 1) { throw 'Expected exactly one NSIS installer matching the application version.' }
$prefix = "chessbot-$Tag-windows-x64"
Copy-Item -LiteralPath $installers[0].FullName -Destination (Join-Path $output "$prefix-setup.exe")
$portable = Join-Path $output 'portable'
New-Item -ItemType Directory -Path $portable | Out-Null
foreach ($name in @('chess-stockfish.exe','stockfish.exe','LICENSE','THIRD_PARTY_NOTICES.md')) {
    Copy-Item -LiteralPath (Join-Path $releaseRoot $name) -Destination (Join-Path $portable $name)
}
Copy-Item -LiteralPath (Join-Path $releaseRoot 'licenses') -Destination (Join-Path $portable 'licenses') -Recurse
if (!(Test-Path -LiteralPath (Join-Path $portable 'licenses/Stockfish-sf_19-source.zip'))) { throw 'Matching Stockfish source is missing.' }
Compress-Archive -Path (Join-Path $portable '*') -DestinationPath (Join-Path $output "$prefix-portable.zip")
Copy-Item -LiteralPath (Join-Path $portable 'licenses/Stockfish-sf_19-source.zip') -Destination (Join-Path $output 'Stockfish-sf_19-source.zip')
& git -C $projectRoot rev-parse HEAD | Set-Content -LiteralPath (Join-Path $output 'COMMIT.txt') -Encoding utf8
$checksums = Get-ChildItem -LiteralPath $output -File | Where-Object Name -ne 'SHA256SUMS.txt' | Sort-Object Name | ForEach-Object {
    '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
}
$checksums | Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Encoding ascii
Write-Host "Release files and checksums prepared in $output"
