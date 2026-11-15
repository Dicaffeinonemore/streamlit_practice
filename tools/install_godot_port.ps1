param([switch]$SkipEditor)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\artifacts\godot_port'))
$target = 'C:\Users\훈도\Documents\dark-moon-nights'
$engine = 'C:\Users\훈도\Desktop\흑월의 기사 리부트\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe'
if (-not (Test-Path -LiteralPath (Join-Path $source 'scenes\main.tscn'))) { throw 'Staged game is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'project.godot'))) { throw 'Expected target Godot project is missing.' }
if ([IO.Path]::GetFullPath($target) -ne 'C:\Users\훈도\Documents\dark-moon-nights') { throw 'Target path mismatch.' }

# Import and test staged files before modifying the target project.
& $engine --headless --path $source --editor --import --log-file (Join-Path $source 'import.log') *> (Join-Path $source 'import-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Staged import failed.' }
& $engine --headless --path $source --script tests/smoke.gd --log-file (Join-Path $source 'smoke.log') -- --smoke
if ($LASTEXITCODE -ne 0) { throw 'Staged smoke tests failed.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $target ('migration_backups\'+$stamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Set-Content -LiteralPath (Join-Path $target 'migration_backups\.gdignore') -Value '' -Encoding UTF8
$entries = @('project.godot','README_GODOT.md','scenes','scripts','data','assets','tests')
foreach ($entry in $entries) {
    $destination = Join-Path $target $entry
    if (Test-Path -LiteralPath $destination) {
        Copy-Item -LiteralPath $destination -Destination (Join-Path $backup $entry) -Recurse -Force
    }
    if (Test-Path -LiteralPath $destination -PathType Container) {
        foreach ($child in Get-ChildItem -LiteralPath (Join-Path $source $entry) -Force) {
            Copy-Item -LiteralPath $child.FullName -Destination $destination -Recurse -Force
        }
    } else {
        Copy-Item -LiteralPath (Join-Path $source $entry) -Destination $destination -Recurse -Force
    }
}
New-Item -ItemType Directory -Path (Join-Path $target 'evidence') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $target 'evidence\.gdignore') -Value '' -Encoding UTF8
& $engine --headless --path $target --editor --import --log-file (Join-Path $target 'evidence\import.log') *> (Join-Path $target 'evidence\import-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Target import failed; original files are backed up.' }
& $engine --headless --path $target --script tests/smoke.gd --log-file (Join-Path $target 'evidence\smoke.log') -- --smoke
if ($LASTEXITCODE -ne 0) { throw 'Target smoke tests failed.' }
& $engine --path $target --script tests/capture.gd --log-file (Join-Path $target 'evidence\capture.log') -- --smoke
if ($LASTEXITCODE -ne 0) { throw 'Visual capture failed.' }
Write-Output "Installed: $target"
Write-Output "Backup: $backup"
if (-not $SkipEditor) {
    Start-Process -FilePath $engine -ArgumentList @('--editor','--path',('"'+$target+'"')) -WindowStyle Hidden
}
