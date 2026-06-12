<#
.SYNOPSIS
    Proves the exam machine can build + test an Avalonia xUnit project with the
    network fully off, using only the offline feed built by make-offline-feed.ps1.

.DESCRIPTION
    Runs these steps and prints PASS/FAIL (with colour) for each:

      1. .NET SDK present and is a 9.x SDK.
      2. The offline feed exists and contains the pinned root packages.
      3. Required packages are in the local NuGet cache (so make-offline-feed can
         rebuild the feed if needed).
      4. REAL offline dry run: create a temp Avalonia + headless-xUnit project in
         $env:TEMP, pin the exam versions, restore ONLY from the offline feed into a
         throwaway packages folder (so nothing leaks from the global cache), then
         `dotnet test`. One test asserts 1+1==2 so a green run proves the toolchain.

    The dry run uses --packages <temp> and --source <offline-feed> so it genuinely
    exercises the offline path: if the feed were incomplete, restore would fail.

    Exit code 0 = all PASS, 1 = at least one FAIL.

.NOTES
    PowerShell 7. Run scripts\make-offline-feed.ps1 first.
#>
[CmdletBinding()]
param(
    [string]$FeedPath  = (Join-Path $PSScriptRoot 'offline-feed'),
    [string]$CachePath = (Join-Path $env:USERPROFILE '.nuget\packages')
)

$ErrorActionPreference = 'Continue'

$script:Failures = 0
function Pass($m) { Write-Host "[PASS] $m" -ForegroundColor Green }
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; $script:Failures++ }
function Info($m) { Write-Host "       $m" -ForegroundColor DarkGray }
function Head($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# Robustly delete a temp tree. The dotnet build server and the vstest test host
# hold file handles inside the tree for a moment after `dotnet test` returns, so an
# immediate delete fails. Shut the build server down, then retry a few times with a
# short settle. Always best-effort: cleanup must never change the PASS/FAIL verdict.
function Remove-TempTree([string]$path) {
    if (-not (Test-Path $path)) { return }
    & dotnet build-server shutdown 2>&1 | Out-Null
    # The test host releases its handles a beat after the run; sleep-then-delete so
    # the FINAL action is always a delete attempt (not a wasted trailing sleep).
    for ($i = 0; $i -lt 10; $i++) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $path)) { return }
        Start-Sleep -Milliseconds 750
    }
    # One last try after the final settle.
    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
}

# Versions that must match the AOP Starter Kit exactly.
$RootPackages = @{
    'Avalonia'                  = '11.2.1'
    'Avalonia.Desktop'          = '11.2.1'
    'CommunityToolkit.Mvvm'     = '8.2.1'
    'xunit'                     = '2.9.3'
    'xunit.runner.visualstudio' = '3.1.4'
    'Microsoft.NET.Test.Sdk'    = '17.14.1'
    'Avalonia.Headless.XUnit'   = '11.2.1'
    'coverlet.collector'        = '6.0.4'
}

# ---------------------------------------------------------------------------
# Step 1: .NET SDK
# ---------------------------------------------------------------------------
Head "Step 1: .NET SDK"
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    Fail "dotnet not found on PATH. Install the .NET 9 SDK."
} else {
    $sdkVer = (& dotnet --version) 2>$null
    if ($sdkVer -match '^9\.') {
        Pass ".NET SDK present: $sdkVer"
    } else {
        Fail ".NET SDK is $sdkVer but the exam needs a 9.x SDK."
    }
    Info "SDKs installed:"
    (& dotnet --list-sdks) | ForEach-Object { Info $_ }
}

# ---------------------------------------------------------------------------
# Step 2: Offline feed present and complete
# ---------------------------------------------------------------------------
Head "Step 2: Offline feed"
if (-not (Test-Path $FeedPath)) {
    Fail "Offline feed not found at $FeedPath. Run make-offline-feed.ps1 first."
} else {
    $feedPkgs = Get-ChildItem $FeedPath -Filter '*.nupkg' -File -ErrorAction SilentlyContinue
    Pass "Offline feed exists with $($feedPkgs.Count) .nupkg files."
    foreach ($p in $RootPackages.GetEnumerator()) {
        $name = "{0}.{1}.nupkg" -f $p.Key.ToLowerInvariant(), $p.Value
        if ($feedPkgs.Name -contains $name) {
            Info "ok  $name"
        } else {
            Fail "Offline feed is missing $name"
        }
    }
}

# ---------------------------------------------------------------------------
# Step 3: Required packages in the local cache (so the feed can be rebuilt)
# ---------------------------------------------------------------------------
Head "Step 3: NuGet cache has the pinned roots"
if (-not (Test-Path $CachePath)) {
    Fail "NuGet cache not found at $CachePath."
} else {
    foreach ($p in $RootPackages.GetEnumerator()) {
        $dir = Join-Path $CachePath ("{0}\{1}" -f $p.Key.ToLowerInvariant(), $p.Value)
        if (Test-Path $dir) { Info "ok  $($p.Key) $($p.Value)" }
        else { Fail "Cache missing $($p.Key) $($p.Value)" }
    }
    if ($script:Failures -eq 0) { Pass "All pinned root packages are in the cache." }
}

# ---------------------------------------------------------------------------
# Step 4: REAL offline dry run (restore + test from the feed only)
# ---------------------------------------------------------------------------
Head "Step 4: Offline restore + test dry run"
# Sweep any stale dirs a previous run left behind (the test host can hold handles for
# a second after exit, so an occasional dir survives the in-run cleanup). This keeps
# %TEMP% from accumulating across runs without slowing the normal path.
Get-ChildItem $env:TEMP -Directory -Filter 'aop-verify-*' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
$dry = Join-Path $env:TEMP ("aop-verify-" + [Guid]::NewGuid().ToString('N'))
$pkgTmp = Join-Path $dry '_packages'   # throwaway global-packages folder
New-Item -ItemType Directory -Force -Path $dry, $pkgTmp | Out-Null

try {
    # Minimal Avalonia app (gives us a ProjectReference target + real Avalonia restore).
    $appDir = Join-Path $dry 'App'
    New-Item -ItemType Directory -Force -Path $appDir | Out-Null
    @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Avalonia" Version="11.2.1" />
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.1" />
  </ItemGroup>
</Project>
"@ | Set-Content (Join-Path $appDir 'App.csproj') -Encoding UTF8
    @"
using CommunityToolkit.Mvvm.ComponentModel;
namespace App;
public partial class CounterViewModel : ObservableObject
{
    [ObservableProperty] private int _count;
    public void Increment() => Count++;
}
"@ | Set-Content (Join-Path $appDir 'CounterViewModel.cs') -Encoding UTF8

    # Headless xUnit test project referencing the app (mirrors Problem 3 setup).
    $testDir = Join-Path $dry 'Tests'
    New-Item -ItemType Directory -Force -Path $testDir | Out-Null
    @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="coverlet.collector" Version="6.0.4" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
    <PackageReference Include="Avalonia.Headless.XUnit" Version="11.2.1" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\App\App.csproj" />
  </ItemGroup>
  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>
</Project>
"@ | Set-Content (Join-Path $testDir 'Tests.csproj') -Encoding UTF8
    @"
using App;
namespace Tests;
public class CounterTests
{
    [Fact]
    public void Increment_RaisesCount()
    {
        var vm = new CounterViewModel();
        Assert.Equal(0, vm.Count);
        vm.Increment();
        Assert.Equal(1, vm.Count);
    }
}
"@ | Set-Content (Join-Path $testDir 'CounterTests.cs') -Encoding UTF8

    # nuget.config that points ONLY at the offline feed.
    $feedFull = (Resolve-Path $FeedPath).Path
    @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="aop-offline" value="$feedFull" />
  </packageSources>
</configuration>
"@ | Set-Content (Join-Path $dry 'nuget.config') -Encoding UTF8

    $cfg = Join-Path $dry 'nuget.config'

    # --- Restore (app) ---
    Info "Restoring App from offline feed only..."
    & dotnet restore (Join-Path $appDir 'App.csproj') --configfile $cfg --packages $pkgTmp 2>&1 |
        ForEach-Object { Info $_ }
    $restoreApp = ($LASTEXITCODE -eq 0)

    # --- Restore (tests) ---
    Info "Restoring Tests from offline feed only..."
    & dotnet restore (Join-Path $testDir 'Tests.csproj') --configfile $cfg --packages $pkgTmp 2>&1 |
        ForEach-Object { Info $_ }
    $restoreTest = ($LASTEXITCODE -eq 0)

    if ($restoreApp -and $restoreTest) {
        Pass "Offline restore succeeded (no network, feed-only)."
    } else {
        Fail "Offline restore failed. The feed is incomplete."
    }

    # --- Test (build + run) using the same offline packages folder ---
    # dotnet test does NOT accept --configfile/--packages (those are restore-only),
    # so we restore first (done above) then run with --no-restore. NUGET_PACKAGES
    # keeps the build pinned to the throwaway offline packages folder, proving the
    # whole chain works without touching the global cache or the network.
    Info "Building + running the headless xUnit test (offline, --no-restore)..."
    $oldNugetPkgs = $env:NUGET_PACKAGES
    $env:NUGET_PACKAGES = $pkgTmp
    try {
        $testOut = & dotnet test (Join-Path $testDir 'Tests.csproj') --no-restore --nologo 2>&1
    } finally {
        $env:NUGET_PACKAGES = $oldNugetPkgs
    }
    $testOut | ForEach-Object { Info $_ }
    if ($LASTEXITCODE -eq 0) {
        Pass "dotnet test PASSED offline (build + xUnit run green)."
    } else {
        Fail "dotnet test FAILED. See output above."
    }
}
finally {
    Remove-TempTree $dry
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Head "Summary"
if ($script:Failures -eq 0) {
    Write-Host "ALL CHECKS PASSED - the exam machine can build + test fully offline." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$($script:Failures) CHECK(S) FAILED - fix before the exam." -ForegroundColor Red
    exit 1
}
