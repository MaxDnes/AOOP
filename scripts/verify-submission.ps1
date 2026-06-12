<#
.SYNOPSIS
    Verifies an exam submission folder is flat, complete, and contains exactly the
    required files (no bin/obj, no subfolders, no empties). Optionally zips it.

.DESCRIPTION
    Both 2025 exams demand a single flat folder with an exact file list and explicitly
    forbid /bin/, /obj/, subfolders, and extra files. Losing points to a packaging
    slip would be tragic, so this script enforces the rules for you.

    Built-in profiles (filenames pulled from each exam PDF):

      -Variant f26      (THE DEFAULT FOR THE F26 EXAM: the professor's flat 6-file
                         manifest, confirmed 2026-06-12; use this unless the exam
                         paper prints something different):
          Problem_2_MainWindowViewModel.cs
          Problem_2_MainWindow.axaml
          Problem_3_MainWindowViewModel.cs
          Problem_3_MainWindow.axaml
          Problem_4_Program.cs
          Problem_4_Models.cs

      -Variant reexam   (ReExam / Aug-2025 FamilyMealPlanner; PDF gives an explicit
                         6-file flat manifest):
          Problem_1_Submission.txt
          Problem_2_MainWindowViewModel.cs
          Problem_2_MainWindow.axaml
          Problem_3_MainWindowViewModel.cs
          Problem_4_Program.cs
          Problem_4_Query_Results.json

      -Variant summer   (Summer / June-2025 RectangleUI; the PDF lists the files to
                         hand in PER PROBLEM rather than one flat manifest, so this is
                         the flattened set using the same Problem_N_ convention):
          Problem_1_Submission.txt
          Problem_2_Submission.txt
          Problem_2_MainWindowViewModel.cs
          Problem_2_RectangleData.cs
          Problem_2_MainWindow.axaml
          Problem_3_Tests.cs
          Problem_4_Program.cs
        NOTE: Summer P4 only asks you to PRINT query results (no output JSON), and P3
        asks for an xUnit test project (the gradable artefact is the test class file).
        If the real F26 exam prints a different manifest, use -Variant custom.

      -Variant custom -Required a.cs,b.txt   (you pass the exact required filenames)

    Checks performed:
      * folder exists
      * each required file is present and NON-EMPTY
      * NO extra files (anything not in the required list is flagged)
      * NO subfolders at all (the exam wants a single-level folder), and explicitly
        NO bin/ or obj/ folders
    Prints PASS/FAIL per check and an overall verdict. Exit 0 = OK, 1 = problems.

    -Zip <path>  After a PASS, produce a .zip of the folder contents at <path>
                 (or a default name next to the folder). The zip is refused if the
                 folder fails verification, so you can't ship a broken submission.

.EXAMPLE
    .\verify-submission.ps1 -Folder C:\Submit -Variant f26
.EXAMPLE
    .\verify-submission.ps1 -Folder C:\Submit -Variant reexam
.EXAMPLE
    .\verify-submission.ps1 -Folder C:\Submit -Variant summer -Zip C:\Submit.zip
.EXAMPLE
    .\verify-submission.ps1 -Folder C:\Submit -Variant custom -Required Foo.cs,Bar.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Folder,

    [Parameter(Mandatory)]
    [ValidateSet('f26','summer','reexam','custom')]
    [string]$Variant,

    # Required filenames when -Variant custom. Ignored otherwise.
    [string[]]$Required,

    # If set, write a submission zip here (or a default path) after a PASS.
    [string]$Zip
)

$ErrorActionPreference = 'Stop'

$script:Failures = 0
function Pass($m) { Write-Host "[PASS] $m" -ForegroundColor Green }
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; $script:Failures++ }
function Info($m) { Write-Host "       $m" -ForegroundColor DarkGray }
function Head($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------
$Profiles = @{
    f26 = @(
        'Problem_2_MainWindowViewModel.cs'
        'Problem_2_MainWindow.axaml'
        'Problem_3_MainWindowViewModel.cs'
        'Problem_3_MainWindow.axaml'
        'Problem_4_Program.cs'
        'Problem_4_Models.cs'
    )
    reexam = @(
        'Problem_1_Submission.txt'
        'Problem_2_MainWindowViewModel.cs'
        'Problem_2_MainWindow.axaml'
        'Problem_3_MainWindowViewModel.cs'
        'Problem_4_Program.cs'
        'Problem_4_Query_Results.json'
    )
    summer = @(
        'Problem_1_Submission.txt'
        'Problem_2_Submission.txt'
        'Problem_2_MainWindowViewModel.cs'
        'Problem_2_RectangleData.cs'
        'Problem_2_MainWindow.axaml'
        'Problem_3_Tests.cs'
        'Problem_4_Program.cs'
    )
}

if ($Variant -eq 'custom') {
    if (-not $Required -or $Required.Count -eq 0) {
        throw "-Variant custom requires -Required <comma-separated filenames>."
    }
    # Robust to both real arrays (-Required a,b) and a single comma-joined string
    # (which is how `pwsh -File script.ps1 -Required a,b` binds the argument).
    $requiredFiles = $Required |
        ForEach-Object { $_ -split ',' } |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne '' }
} else {
    $requiredFiles = $Profiles[$Variant]
}

Head "Verifying submission ($Variant)"
Info "Folder: $Folder"
Info "Required files ($($requiredFiles.Count)):"
$requiredFiles | ForEach-Object { Info "  - $_" }

# ---------------------------------------------------------------------------
# 1. Folder exists
# ---------------------------------------------------------------------------
Head "Folder"
if (-not (Test-Path -LiteralPath $Folder -PathType Container)) {
    Fail "Folder does not exist: $Folder"
    Write-Host "`nVERDICT: FAIL" -ForegroundColor Red
    exit 1
}
$Folder = (Resolve-Path -LiteralPath $Folder).Path
Pass "Folder exists."

# Enumerate contents (top level only for files; recurse to detect any subfolders).
$topFiles   = Get-ChildItem -LiteralPath $Folder -File
$subFolders = Get-ChildItem -LiteralPath $Folder -Directory

# ---------------------------------------------------------------------------
# 2. No subfolders (and definitely no bin/obj)
# ---------------------------------------------------------------------------
Head "No subfolders / no bin/obj"
if ($subFolders.Count -eq 0) {
    Pass "Flat folder - no subfolders."
} else {
    foreach ($d in $subFolders) {
        if ($d.Name -in @('bin','obj','.vs')) {
            Fail "Forbidden build folder present: $($d.Name)\  (delete it before submitting)"
        } else {
            Fail "Subfolder present (exam wants a single flat folder): $($d.Name)\"
        }
    }
}

# ---------------------------------------------------------------------------
# 3. Required files present and non-empty
# ---------------------------------------------------------------------------
Head "Required files present + non-empty"
$topNames = $topFiles.Name
foreach ($req in $requiredFiles) {
    $match = $topFiles | Where-Object { $_.Name -eq $req }
    if (-not $match) {
        Fail "Missing required file: $req"
    } elseif ($match.Length -eq 0) {
        Fail "Required file is EMPTY: $req"
    } else {
        Info "ok  $req ($($match.Length) bytes)"
    }
}
if ($script:Failures -eq 0) { Pass "All required files present and non-empty." }

# ---------------------------------------------------------------------------
# 4. No extra files
# ---------------------------------------------------------------------------
Head "No extra files"
$extra = $topNames | Where-Object { $_ -notin $requiredFiles }
if (-not $extra) {
    Pass "No extra files - folder contains exactly the required set."
} else {
    foreach ($e in $extra) { Fail "Extra file not in the required set: $e  (remove before submitting)" }
}

# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------
Head "Verdict"
if ($script:Failures -gt 0) {
    Write-Host "VERDICT: FAIL ($($script:Failures) problem(s)). Do NOT submit yet." -ForegroundColor Red
    if ($Zip) { Write-Host "Refusing to zip a failing submission." -ForegroundColor Red }
    exit 1
}
Write-Host "VERDICT: PASS - submission folder is clean and complete." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Optional zip
# ---------------------------------------------------------------------------
if ($Zip) {
    Head "Zipping"
    if (-not $Zip.ToLower().EndsWith('.zip')) { $Zip = "$Zip.zip" }
    if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
    # Zip the FILES (not the parent folder) so the archive is itself flat.
    Compress-Archive -Path (Join-Path $Folder '*') -DestinationPath $Zip -Force
    $zipFull = (Resolve-Path -LiteralPath $Zip).Path
    Pass "Wrote submission zip: $zipFull"
    Info "Verify the zip lists exactly the required files at its root before uploading."
}

exit 0
