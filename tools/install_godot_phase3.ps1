param([switch]$SkipPreview)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\godot'))
$target = 'C:\Users\훈도\Documents\dark-moon-nights'
$engine = 'C:\Users\훈도\Desktop\흑월의 기사 리부트\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe'
if ([IO.Path]::GetFullPath($target) -ne 'C:\Users\훈도\Documents\dark-moon-nights') { throw 'Target mismatch.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'addons\gut\plugin.cfg'))) { throw 'The verified Phase 2 installation is required.' }
$parity = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $source 'evidence\phase3-parity.json') | ConvertFrom-Json
$integration = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $source 'evidence\phase3-integration.json') | ConvertFrom-Json
if ($parity.mismatches -ne 0 -or $parity.source_steps -lt 12402) { throw 'Complete Phase 3 source verification is required.' }
if ($integration.failures.Count -ne 0 -or $integration.checks -lt 29) { throw 'Complete Phase 3 rendered verification is required.' }
$backupRoot = Join-Path $target 'migration_backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Set-Content -LiteralPath (Join-Path $backupRoot '.gdignore') -Value '' -Encoding UTF8
$backup = Join-Path $backupRoot ('phase3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($name in @('project.godot','README_GODOT.md','phase2','phase3','port_tools')) {
    $existing = Join-Path $target $name
    if (Test-Path -LiteralPath $existing) { Copy-Item -LiteralPath $existing -Destination $backup -Recurse -Force }
}
Set-Content -LiteralPath (Join-Path $backup 'README.txt') -Value 'Phase 3 backup. Restore project.godot and backed-up directories to restore the previous installed state. Existing prototype scenes/scripts were not changed.' -Encoding UTF8
foreach ($name in @('phase2','phase3','port_tools')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination $target -Recurse -Force
}
foreach ($name in @('project.godot','README_GODOT.md')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $target $name) -Force
}
$docs = Join-Path $target 'port_docs'
New-Item -ItemType Directory -Path $docs -Force | Out-Null
foreach ($name in @('PHASE3_REPORT.md','PHASE3_COMPARISON.html')) {
    Copy-Item -LiteralPath (Join-Path $source ('docs\' + $name)) -Destination $docs -Force
}
$evidence = Join-Path $target 'evidence'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
Set-Content -LiteralPath (Join-Path $evidence '.gdignore') -Value '' -Encoding UTF8
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $source 'evidence') -File) {
    if ($file.Name -like 'phase3_*.png' -or $file.Name -in @('phase3-parity.json','phase3-integration.json')) {
        Copy-Item -LiteralPath $file.FullName -Destination $evidence -Force
    }
}
& $engine --headless --path $target --editor --import --quit --log-file (Join-Path $evidence 'phase3-import.log') *> (Join-Path $evidence 'phase3-import-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination Phase 3 import failed.' }
& $engine --headless --path $target --script addons/gut/gut_cmdln.gd -gdir=res://phase2/tests -gexit -glog=1 --log-file (Join-Path $evidence 'phase3-regression.log') *> (Join-Path $evidence 'phase3-regression-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination Phase 2 regression failed.' }
& $engine --headless --path $target --script addons/gut/gut_cmdln.gd -gdir=res://phase3/tests -gexit -glog=1 --log-file (Join-Path $evidence 'phase3-gut.log') *> (Join-Path $evidence 'phase3-gut-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination Phase 3 source parity failed.' }
& $engine --path $target --script phase3/tools/capture_stage.gd --log-file (Join-Path $evidence 'phase3-capture.log') *> (Join-Path $evidence 'phase3-capture-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination Phase 3 rendered integration failed.' }
& $engine --headless --path $target --script phase3/tools/verify_startup.gd --verbose --log-file (Join-Path $evidence 'phase3-main.log') *> (Join-Path $evidence 'phase3-main-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination F5 main scene startup failed.' }
& $engine --headless --path $target --script phase3/tools/verify_startup.gd --verbose --log-file (Join-Path $evidence 'phase3-boss-cli.log') -- --section=5 --boss-phase=2 --boss-ult=1 --capture *> (Join-Path $evidence 'phase3-boss-cli-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Destination boss debug startup failed.' }
Write-Output "Phase 3 installed and verified: $target"
Write-Output "Backup: $backup"
if (-not $SkipPreview) {
    $preview = Start-Process -FilePath $engine -ArgumentList @('--path',('"' + $target + '"'),'--log-file',('"' + (Join-Path $evidence 'phase3-preview.log') + '"')) -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 700
    if ($preview.HasExited) { throw 'Preview exited immediately; inspect phase3-preview.log.' }
    Write-Output "Preview process started: $($preview.Id)"
}
