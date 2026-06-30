# Plex Poster Helper - one-command Docker launcher (Windows / PowerShell).
#
#   ./docker/run.ps1            build (if needed) + start the web UI on :3939
#   ./docker/run.ps1 -Build     force a rebuild first
#   ./docker/run.ps1 -Stop      stop & remove the container (config volume kept)
#   ./docker/run.ps1 -Port 8095 use a different host port
#
# The web UI includes a built-in scheduler, so this single container is all you need.
param(
  [switch]$Build,
  [switch]$Stop,
  [int]$Port = 3939
)

$ErrorActionPreference = 'Stop'
$name   = 'plex-poster-helper-2'
$image  = 'plex-poster-helper-2'
$volume = 'ppsh-config'
$root   = Split-Path $PSScriptRoot -Parent

# Timezone the scheduler runs in: an explicit TZ env wins, otherwise convert the
# host's Windows id to the IANA name (America/New_York) that containers expect.
$tz = if ($env:TZ) { $env:TZ } else { 'UTC' }
if (-not $env:TZ) {
  try {
    $iana = $null
    if ([TimeZoneInfo]::TryConvertWindowsIdToIanaId((Get-TimeZone).Id, [ref]$iana)) { $tz = $iana }
  } catch { }
}

if ($Stop) {
  docker rm -f $name 2>$null | Out-Null
  Write-Host "Stopped. Config volume '$volume' is preserved." -ForegroundColor Yellow
  return
}

docker volume create $volume | Out-Null

$exists = docker images -q $image
if ($Build -or -not $exists) {
  Write-Host "Building $image (first build takes a few minutes)…" -ForegroundColor Cyan
  docker build -f "$PSScriptRoot/Dockerfile" -t $image $root
  if ($LASTEXITCODE -ne 0) { throw "docker build failed for $image" }
}

docker rm -f $name 2>$null | Out-Null
docker run -d --name $name `
  -p "${Port}:3939" `
  -e "TZ=$tz" -e PORT=3939 `
  -v "${volume}:/config" `
  --restart unless-stopped `
  $image | Out-Null

Write-Host "✓ Web UI running: http://localhost:$Port" -ForegroundColor Green
Write-Host ''
Write-Host "  Logs: docker logs -f $name"
Write-Host '  Stop: ./docker/run.ps1 -Stop'
