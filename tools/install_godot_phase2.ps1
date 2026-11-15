param([switch]$SkipPreview)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\godot'))
$target = 'C:\Users\훈도\Documents\dark-moon-nights'
$engine = 'C:\Users\훈도\Desktop\흑월의 기사 리부트\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe'
if ([IO.Path]::GetFullPath($target) -ne 'C:\Users\훈도\Documents\dark-moon-nights') { throw 'Target mismatch.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'project.godot'))) { throw 'Destination project is missing.' }
foreach ($name in @('phase2-parity.json','phase2-street.json','phase2-integration.json')) {
    $result = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $source ('evidence\' + $name)) | ConvertFrom-Json
    if ($name -eq 'phase2-integration.json') {
        if ($result.checks -lt 24 -or $result.failures.Count -ne 0) { throw 'Native integration must pass before installation.' }
    } elseif ($result.mismatches -ne 0) { throw 'Source parity must pass before installation.' }
}
$index = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $target 'port_assets\resources\index.json') | ConvertFrom-Json
if ($index.Count -ne 833) { throw 'Verified Phase 1 assets must be installed first.' }
$backupRoot = Join-Path $target 'migration_backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Set-Content -LiteralPath (Join-Path $backupRoot '.gdignore') -Value '' -Encoding UTF8
$backup = Join-Path $backupRoot ('phase2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($name in @('project.godot','README_GODOT.md','phase2','port_tools','addons')) {
    $existing = Join-Path $target $name
    if (Test-Path -LiteralPath $existing) { Copy-Item -LiteralPath $existing -Destination $backup -Recurse -Force }
}
Set-Content -LiteralPath (Join-Path $backup 'README.txt') -Encoding UTF8 -Value 'Phase 2 backup. Restore project.godot from this directory to return F5 to its previous main scene. Existing prototype scenes/scripts were not modified.'
foreach ($name in @('phase2','port_tools')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination $target -Recurse -Force
}
$addons = Join-Path $target 'addons'
New-Item -ItemType Directory -Path $addons -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $source 'addons\gut') -Destination $addons -Recurse -Force
Copy-Item -LiteralPath (Join-Path $source 'project.godot') -Destination (Join-Path $target 'project.godot') -Force
Copy-Item -LiteralPath (Join-Path $source 'README_GODOT.md') -Destination (Join-Path $target 'README_GODOT.md') -Force
$docs = Join-Path $target 'port_docs'
New-Item -ItemType Directory -Path $docs -Force | Out-Null
foreach ($name in @('PHASE2_REPORT.md','PHASE2_COMPARISON.html')) {
    Copy-Item -LiteralPath (Join-Path $source ('docs\' + $name)) -Destination $docs -Force
}
$evidence = Join-Path $target 'evidence'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
Set-Content -LiteralPath (Join-Path $evidence '.gdignore') -Value '' -Encoding UTF8
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $source 'evidence') -File) {
    if ($file.Name -like 'phase2_*.png' -or $file.Name -in @('phase2-parity.json','phase2-street.json','phase2-integration.json')) {
        Copy-Item -LiteralPath $file.FullName -Destination $evidence -Force
    }
}
& $engine --headless --path $target --editor --import --quit --log-file (Join-Path $evidence 'phase2-import.log') *> (Join-Path $evidence 'phase2-import-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination import failed. The previous project settings are backed up.' }
& $engine --headless --path $target --script addons/gut/gut_cmdln.gd -gdir=res://phase2/tests -gexit -glog=1 --log-file (Join-Path $evidence 'phase2-gut.log') *> (Join-Path $evidence 'phase2-gut-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination GUT verification failed.' }
& $engine --path $target --script phase2/tools/capture_slice.gd --log-file (Join-Path $evidence 'phase2-capture.log') *> (Join-Path $evidence 'phase2-capture-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination rendered integration failed.' }
& $engine --headless --path $target --quit-after 120 --log-file (Join-Path $evidence 'phase2-main.log') *> (Join-Path $evidence 'phase2-main-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination F5 main scene failed to start.' }
Write-Output "Phase 2 installed and verified: $target"
Write-Output "Previous settings and changed directories: $backup"
if (-not $SkipPreview) {
    $preview = Start-Process -FilePath $engine -ArgumentList @('--path',('"' + $target + '"'),'--log-file',('"' + (Join-Path $evidence 'phase2-preview.log') + '"')) -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 700
    if ($preview.HasExited) { throw 'Preview exited immediately; check phase2-preview.log.' }
    Write-Output "Preview process started: $($preview.Id)"
}
