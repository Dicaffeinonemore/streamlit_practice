param()
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\godot'))
$target = [IO.Path]::GetFullPath('C:\Users\훈도\Documents\dark-moon-nights')
$engine = 'C:\Users\훈도\Desktop\흑월의 기사 리부트\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe'
if ($target -ne 'C:\Users\훈도\Documents\dark-moon-nights') { throw 'Target mismatch.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'phase3\stage_game.tscn'))) { throw 'Phase 3 installation is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $target 'port_assets\resources\title_original_gif.tres'))) { throw 'Original assets are missing.' }
$backupRoot = Join-Path $target 'migration_backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $backupRoot '.gdignore'))) { Set-Content -LiteralPath (Join-Path $backupRoot '.gdignore') -Value '' -Encoding UTF8 }
$backup = Join-Path $backupRoot ('phase4-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$files = @('project.godot','phase2\core\physical_input.gd','phase2\presentation\game_audio.gd','phase2\presentation\game_hud.gd','phase2\presentation\street_view.gd','phase2\vertical_slice.gd','phase3\presentation\stage_hud.gd')
foreach ($name in $files) {
    $destination = Join-Path $target $name
    if (-not (Test-Path -LiteralPath $destination)) { throw "Missing existing file: $name" }
    $backupFile = Join-Path $backup $name
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupFile) -Force | Out-Null
    Copy-Item -LiteralPath $destination -Destination $backupFile
}
if (Test-Path -LiteralPath (Join-Path $target 'phase4')) { Copy-Item -LiteralPath (Join-Path $target 'phase4') -Destination $backup -Recurse }
Set-Content -LiteralPath (Join-Path $backup 'README.txt') -Value 'Backup of files replaced for Phase 4. Restore these paths to return to the prior state. User save data is not included or modified.' -Encoding UTF8
$evidence = Join-Path $target 'evidence'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $target $name) -Force }
Copy-Item -LiteralPath (Join-Path $source 'phase4') -Destination $target -Recurse -Force
Copy-Item -LiteralPath (Join-Path $source 'docs\PHASE4_REPORT.md') -Destination (Join-Path $target 'port_docs\PHASE4_REPORT.md') -Force
foreach ($name in @('phase4_title.png','phase4_hud.png','phase4_boss_hud.png','phase4_enemy_hud.png')) { Copy-Item -LiteralPath (Join-Path $source "evidence\$name") -Destination (Join-Path $evidence $name) -Force }
function Invoke-Check([string]$name, [string[]]$engineArgs) {
    $log = Join-Path $evidence ("phase4-installed-$name.log")
    $output = Join-Path $evidence ("phase4-installed-$name-output.log")
    & $engine --headless --path $target @engineArgs --log-file $log *> $output
    if ($LASTEXITCODE -ne 0) { throw "Phase 4 $name failed; see $output. Backup: $backup" }
    if (Select-String -LiteralPath $output -Pattern 'SCRIPT ERROR|Parse Error|Failed to load script' -Quiet) { throw "Phase 4 $name reported script errors; see $output. Backup: $backup" }
}
Invoke-Check 'import' @('--editor','--import','--quit')
Invoke-Check 'menu' @('--script','phase4/verify_menu.gd')
Invoke-Check 'practice' @('--script','phase4/verify_practice.gd')
Invoke-Check 'challenge' @('--script','phase4/verify_challenge.gd')
Invoke-Check 'startup' @('--script','phase4/verify_startup.gd')
Write-Output "Phase 4 installed and verified: $target"
Write-Output "Backup: $backup"
