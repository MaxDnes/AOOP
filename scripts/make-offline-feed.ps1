<#
.SYNOPSIS
    Builds a 100% offline NuGet feed for the AOP exam from packages already in
    the local NuGet cache, plus a nuget.offline.config that points at it.

.DESCRIPTION
    The exam machine has NO internet. To create the Problem 3 test project (and to
    restore any model-solution project) we must restore from a local folder feed.
    This script harvests the exact package closure the exam projects need:

      1. It writes two throwaway projects into $env:TEMP that reference the same
         packages (and versions) the AOP Starter Kit pins:
           - an Avalonia desktop app   (Avalonia 11.2.1 + CommunityToolkit.Mvvm 8.2.1)
           - a headless xUnit test proj (xunit 2.9.3, xunit.runner.visualstudio 3.1.4,
             Microsoft.NET.Test.Sdk 17.14.1, Avalonia.Headless.XUnit 11.2.1,
             coverlet.collector 6.0.4)
      2. It restores them against the local NuGet cache (no network) and reads the
         resolved package set straight out of each project.assets.json. That is the
         authoritative transitive closure for the real exam projects.
      3. It copies every resolved <id>/<version> folder that exists in the cache into
         scripts\offline-feed\, then force-includes the named roots at pinned versions
         as a belt-and-braces safety net.
      4. It writes scripts\nuget.offline.config pointing ONLY at the offline feed.

    Re-running is safe and idempotent; it overwrites the feed.

.NOTES
    PowerShell 7. Tested on the exam-prep machine (.NET SDK 9.0.313).
#>
[CmdletBinding()]
param(
    # Where to build the feed. Defaults to scripts\offline-feed next to this script.
    [string]$FeedPath = (Join-Path $PSScriptRoot 'offline-feed'),
    # NuGet global packages cache to harvest from.
    [string]$CachePath = (Join-Path $env:USERPROFILE '.nuget\packages')
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }

# Best-effort recursive delete of a temp tree. The dotnet build server can hold
# handles inside the tree right after a restore, so shut it down and retry briefly.
function Remove-TempTree([string]$path) {
    if (-not (Test-Path $path)) { return }
    & dotnet build-server shutdown 2>&1 | Out-Null
    for ($i = 0; $i -lt 10; $i++) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $path)) { return }
        Start-Sleep -Milliseconds 750
    }
    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Pinned roots (must match the AOP Starter Kit / exam projects exactly).
# ---------------------------------------------------------------------------
$AppPackages = @{
    'Avalonia'                 = '11.2.1'
    'Avalonia.Desktop'         = '11.2.1'
    'Avalonia.Themes.Fluent'   = '11.2.1'
    'Avalonia.Fonts.Inter'     = '11.2.1'
    'Avalonia.Diagnostics'     = '11.2.1'
    'CommunityToolkit.Mvvm'    = '8.2.1'
}
$TestPackages = @{
    'coverlet.collector'             = '6.0.4'
    'Microsoft.NET.Test.Sdk'         = '17.14.1'
    'xunit'                          = '2.9.3'
    'xunit.runner.visualstudio'      = '3.1.4'
    'Avalonia.Headless.XUnit'        = '11.2.1'
}

if (-not (Test-Path $CachePath)) {
    throw "NuGet cache not found at '$CachePath'. Cannot build an offline feed."
}

Write-Step "Using NuGet cache: $CachePath"
Write-Step "Target offline feed: $FeedPath"

# Fresh feed folder.
if (Test-Path $FeedPath) { Remove-Item $FeedPath -Recurse -Force }
New-Item -ItemType Directory -Force -Path $FeedPath | Out-Null

# ---------------------------------------------------------------------------
# 1. Write two throwaway projects that mirror the exam package set.
# ---------------------------------------------------------------------------
$work = Join-Path $env:TEMP ("aop-feed-resolve-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null

function New-PackageRefs([hashtable]$pkgs) {
    ($pkgs.GetEnumerator() | Sort-Object Name | ForEach-Object {
        "    <PackageReference Include=`"$($_.Key)`" Version=`"$($_.Value)`" />"
    }) -join "`n"
}

$appDir  = Join-Path $work 'App'
$testDir = Join-Path $work 'Tests'
New-Item -ItemType Directory -Force -Path $appDir, $testDir | Out-Null

$appCsproj = @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
$(New-PackageRefs $AppPackages)
  </ItemGroup>
</Project>
"@
Set-Content -Path (Join-Path $appDir 'App.csproj') -Value $appCsproj -Encoding UTF8
Set-Content -Path (Join-Path $appDir 'Program.cs') -Value "internal static class P { static void Main() { } }" -Encoding UTF8

$testCsproj = @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
$(New-PackageRefs $TestPackages)
  </ItemGroup>
</Project>
"@
Set-Content -Path (Join-Path $testDir 'Tests.csproj') -Value $testCsproj -Encoding UTF8

# Keep the restore local & offline: point the global packages folder at the cache.
$nugetProbeConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <config>
    <add key="globalPackagesFolder" value="$CachePath" />
  </config>
  <packageSources>
    <clear />
    <add key="cache" value="$CachePath" />
  </packageSources>
</configuration>
"@
Set-Content -Path (Join-Path $work 'nuget.config') -Value $nugetProbeConfig -Encoding UTF8

# ---------------------------------------------------------------------------
# 2. Restore both projects from the cache (no network) and read the closure.
# ---------------------------------------------------------------------------
$resolved = @{}   # key "id|version" -> @{ Id=..; Version=.. }

function Add-FromAssets([string]$projDir) {
    $assets = Join-Path $projDir 'obj\project.assets.json'
    Write-Step "Restoring $((Split-Path $projDir -Leaf)) from cache (offline)"
    Push-Location $projDir
    try {
        # --source the cache as a folder feed too, so a v3 cache works as a source.
        dotnet restore --configfile (Join-Path $work 'nuget.config') --source $CachePath 2>&1 |
            Where-Object { $_ -match 'error|warn' } | ForEach-Object { Write-Warn2 $_ }
    } finally { Pop-Location }

    if (-not (Test-Path $assets)) {
        throw "Restore produced no project.assets.json for $projDir. Cache may be missing packages."
    }
    $json = Get-Content $assets -Raw | ConvertFrom-Json
    foreach ($lib in $json.libraries.PSObject.Properties) {
        if ($lib.Value.type -ne 'package') { continue }
        # property name is "id/version"
        $parts = $lib.Name -split '/'
        if ($parts.Count -ne 2) { continue }
        $id = $parts[0]; $ver = $parts[1]
        $resolved["$id|$ver"] = @{ Id = $id; Version = $ver }
    }
}

Add-FromAssets $appDir
Add-FromAssets $testDir

# Belt-and-braces: force-add the named roots at pinned versions.
foreach ($p in ($AppPackages + $TestPackages).GetEnumerator()) {
    $resolved["$($p.Key)|$($p.Value)"] = @{ Id = $p.Key; Version = $p.Value }
}

Write-Step "Resolved closure: $($resolved.Count) package versions"

# ---------------------------------------------------------------------------
# 3. Copy each resolved package folder from the cache into the feed.
# ---------------------------------------------------------------------------
$copied = 0
$missing = @()
foreach ($entry in $resolved.Values | Sort-Object { $_.Id }, { $_.Version }) {
    $id = $entry.Id; $ver = $entry.Version
    # NuGet cache folders are lowercased.
    $srcDir = Join-Path $CachePath ("{0}\{1}" -f $id.ToLowerInvariant(), $ver.ToLowerInvariant())
    if (-not (Test-Path $srcDir)) {
        $missing += "$id $ver"
        continue
    }
    $nupkg = Get-ChildItem $srcDir -Filter '*.nupkg' -File |
             Where-Object { $_.Name -notmatch '\.snupkg$' } | Select-Object -First 1
    if (-not $nupkg) {
        $missing += "$id $ver (no .nupkg)"
        continue
    }
    # Flat folder feed: a folder of .nupkg files is a valid NuGet v2 source.
    Copy-Item $nupkg.FullName -Destination (Join-Path $FeedPath $nupkg.Name) -Force
    $copied++
}

Write-Ok "Copied $copied .nupkg files into the feed."
if ($missing.Count -gt 0) {
    Write-Warn2 "Not found in cache (skipped): $($missing -join '; ')"
}

# ---------------------------------------------------------------------------
# 4. Write nuget.offline.config pointing ONLY at the offline feed.
# ---------------------------------------------------------------------------
$configPath = Join-Path $PSScriptRoot 'nuget.offline.config'
$feedFull   = (Resolve-Path $FeedPath).Path
$offlineConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<!--
  Offline NuGet config for the AOP exam. Use it like:
    dotnet restore --configfile "scripts\nuget.offline.config"
  or copy it next to a project as nuget.config. It points ONLY at the local
  offline-feed folder, so restores work with the network fully disabled.
-->
<configuration>
  <packageSources>
    <clear />
    <add key="aop-offline" value="$feedFull" />
  </packageSources>
  <!-- Belt-and-braces: also resolve already-extracted packages from the cache. -->
  <fallbackPackageFolders>
    <clear />
  </fallbackPackageFolders>
</configuration>
"@
Set-Content -Path $configPath -Value $offlineConfig -Encoding UTF8
Write-Ok "Wrote $configPath"

# ---------------------------------------------------------------------------
# Cleanup throwaway projects (shut the build server first so no handles linger).
# ---------------------------------------------------------------------------
Remove-TempTree $work

$pkgCount = (Get-ChildItem $FeedPath -Filter '*.nupkg' -File).Count
Write-Host ""
Write-Step "DONE"
Write-Host "    Offline feed : $feedFull" -ForegroundColor Green
Write-Host "    Packages     : $pkgCount .nupkg files" -ForegroundColor Green
Write-Host "    Config       : $configPath" -ForegroundColor Green
Write-Host ""
Write-Host "Next: run scripts\verify-exam-env.ps1 to prove an offline restore + test works." -ForegroundColor Cyan

# Emit the count as the last object for programmatic callers.
[pscustomobject]@{ Feed = $feedFull; PackageCount = $pkgCount; Config = $configPath }
