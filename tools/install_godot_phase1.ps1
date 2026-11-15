param([switch]$SkipPreview)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\godot'))
$target = 'C:\Users\훈도\Documents\dark-moon-nights'
$engine = 'C:\Users\훈도\Desktop\흑월의 기사 리부트\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe'
if ([IO.Path]::GetFullPath($target) -ne 'C:\Users\훈도\Documents\dark-moon-nights') { throw 'Target mismatch.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'project.godot'))) { throw 'Target Godot project is missing.' }
$projectHash = (Get-FileHash -LiteralPath (Join-Path $target 'project.godot') -Algorithm SHA256).Hash
$validation = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $source 'port_assets\catalogs\validation.json') | ConvertFrom-Json
if ($validation.baked_rgba_matches -le 639 -or $validation.missing_assets -ne 0) { throw 'Full verified extraction is required.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $target ('migration_backups\phase1-' + $stamp)
foreach ($entry in @('port_assets','port_tools')) {
    $destination = Join-Path $target $entry
    if (Test-Path -LiteralPath $destination) {
        New-Item -ItemType Directory -Path $backup -Force | Out-Null
        Copy-Item -LiteralPath $destination -Destination (Join-Path $backup $entry) -Recurse -Force
    }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    foreach ($child in Get-ChildItem -LiteralPath (Join-Path $source $entry) -Force) {
        if ($entry -eq 'port_assets' -and $child.Name -eq 'audio') {
            $audioTarget = Join-Path $destination 'audio'
            New-Item -ItemType Directory -Path $audioTarget -Force | Out-Null
            foreach ($audio in Get-ChildItem -LiteralPath $child.FullName -Force) {
                if ($audio.Name -ne 'pcm') { Copy-Item -LiteralPath $audio.FullName -Destination $audioTarget -Recurse -Force }
            }
        } else { Copy-Item -LiteralPath $child.FullName -Destination $destination -Recurse -Force }
    }
}
$docs = Join-Path $target 'port_docs'
New-Item -ItemType Directory -Path $docs -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $source 'docs\PHASE1_REPORT.md') -Destination $docs -Force
Copy-Item -LiteralPath (Join-Path $source 'tools\extract\README.md') -Destination (Join-Path $docs 'EXTRACTION_README.md') -Force
$evidence = Join-Path $target 'evidence'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
Set-Content -LiteralPath (Join-Path $evidence '.gdignore') -Value '' -Encoding UTF8
& $engine --headless --path $target --editor --import --log-file (Join-Path $evidence 'phase1-import.log') *> (Join-Path $evidence 'phase1-import-output.log')
if ($LASTEXITCODE -ne 0) { throw 'Target asset import failed.' }
& $engine --headless --path $target --script port_tools/verify_assets.gd --log-file (Join-Path $evidence 'phase1-verify.log')
if ($LASTEXITCODE -ne 0) { throw 'Target verification failed.' }
& $engine --headless --path $target --script tests/smoke.gd --log-file (Join-Path $evidence 'phase1-existing-game.log') -- --smoke
if ($LASTEXITCODE -ne 0) { throw 'Existing game smoke verification failed.' }
if ((Get-FileHash -LiteralPath (Join-Path $target 'project.godot') -Algorithm SHA256).Hash -ne $projectHash) { throw 'Unexpected project setting change.' }
& $engine --path $target --script port_tools/capture_review.gd --log-file (Join-Path $evidence 'phase1-capture.log')
if ($LASTEXITCODE -ne 0) { throw 'Target capture failed.' }
Write-Output "Phase 1 assets installed: $target"
if (-not $SkipPreview) {
    Start-Process -FilePath $engine -ArgumentList @('--path',('"'+$target+'"'),'res://port_tools/asset_review.tscn') -WindowStyle Hidden
}
