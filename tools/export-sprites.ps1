[CmdletBinding()]
param(
    [string]$AsepritePath,
    [string]$Source,
    [switch]$CreateTestSource,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceRoot = Join-Path $projectRoot 'assets/aseprite'
$exportRoot = Join-Path $sourceRoot 'exports'

function Find-Aseprite {
    if ($AsepritePath) {
        if (!(Test-Path -LiteralPath $AsepritePath -PathType Leaf)) { throw "Aseprite not found: $AsepritePath" }
        return (Resolve-Path -LiteralPath $AsepritePath).Path
    }
    if ($env:ASEPRITE_PATH) {
        if (!(Test-Path -LiteralPath $env:ASEPRITE_PATH -PathType Leaf)) { throw 'Invalid ASEPRITE_PATH' }
        return (Resolve-Path -LiteralPath $env:ASEPRITE_PATH).Path
    }
    $onPath = Get-Command Aseprite.exe -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    $steamRoots = @("${env:ProgramFiles(x86)}/Steam", "$env:ProgramFiles/Steam")
    foreach ($key in @('HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam')) {
        $entry = Get-ItemProperty $key -ErrorAction SilentlyContinue
        if ($entry.SteamPath) { $steamRoots += $entry.SteamPath }
        if ($entry.InstallPath) { $steamRoots += $entry.InstallPath }
    }
    $libraries = @($steamRoots)
    foreach ($steamRoot in $steamRoots) {
        $vdf = Join-Path $steamRoot 'steamapps/libraryfolders.vdf'
        if (Test-Path -LiteralPath $vdf) {
            foreach ($match in [regex]::Matches([IO.File]::ReadAllText($vdf), '"path"\s+"([^"]+)"')) {
                $libraries += $match.Groups[1].Value.Replace('\\', '\')
            }
        }
    }
    foreach ($library in ($libraries | Select-Object -Unique)) {
        $candidate = Join-Path $library 'steamapps/common/Aseprite/Aseprite.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
    throw 'Aseprite.exe not found. Use -AsepritePath or ASEPRITE_PATH.'
}

$exe = Find-Aseprite
Write-Host "Aseprite: $exe"
& $exe --version | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Aseprite version check failed' }
[IO.Directory]::CreateDirectory($sourceRoot) | Out-Null
if ($CreateTestSource) {
    $testSource = Join-Path $sourceRoot 'tests/black-knight-basic-attack.aseprite'
    [IO.Directory]::CreateDirectory((Split-Path $testSource -Parent)) | Out-Null
    if (Test-Path -LiteralPath $testSource) {
        Write-Host 'Test source already exists; preserving it.'
    } else {
        & $exe --batch --script-param "root=$projectRoot" --script-param "output=$testSource" --script (Join-Path $PSScriptRoot 'create-aseprite-test.lua') | Out-Host
        if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $testSource)) { throw 'Test source creation failed' }
    }
}

if ($Source) {
    $candidate = if ([IO.Path]::IsPathRooted($Source)) { $Source } else { Join-Path $projectRoot $Source }
    $files = @(Get-Item -LiteralPath $candidate)
} else {
    $files = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter '*.aseprite' |
        Where-Object { !$_.FullName.StartsWith($exportRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) })
}
if (!$files.Count) { throw 'No .aseprite sources. Run with -CreateTestSource first.' }
# Preflight the entire batch before writing any exports.
$jobs = foreach ($file in $files) {
    if ($file.Extension -ne '.aseprite' -or !$file.FullName.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Source must be a .aseprite file inside assets/aseprite.'
    }
    $relative = $file.FullName.Substring($sourceRoot.Length + 1)
    $stem = Join-Path $exportRoot ([IO.Path]::ChangeExtension($relative, $null).TrimEnd('.'))
    if (!$Force -and ((Test-Path -LiteralPath "$stem.png") -or (Test-Path -LiteralPath "$stem.json"))) {
        throw "Export exists: $stem. Use -Force to replace only generated test exports."
    }
    [pscustomobject]@{ Source = $file.FullName; Stem = $stem }
}
foreach ($job in $jobs) {
    $folder = Split-Path $job.Stem -Parent
    [IO.Directory]::CreateDirectory($folder) | Out-Null
    $stage = Join-Path $folder ('.stage-' + [guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($stage) | Out-Null
    $name = Split-Path $job.Stem -Leaf
    $png = Join-Path $stage "$name.png"
    $json = Join-Path $stage "$name.json"
    & $exe --batch --list-tags $job.Source --sheet-type horizontal --format json-array --sheet $png --data $json | Out-Host
    if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $png) -or !(Test-Path -LiteralPath $json)) {
        throw "Export failed; diagnostic files retained in $stage"
    }
    $data = Get-Content -LiteralPath $json -Raw -Encoding UTF8 | ConvertFrom-Json
    if (!$data.frames.Count) { throw "No frames exported: $($job.Source)" }
    # Store a portable sibling image name instead of an absolute staging path.
    $data.meta.image = "$name.png"
    $raw = ConvertTo-Json -InputObject $data -Depth 100
    [IO.File]::WriteAllText($json, $raw, (New-Object Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath $png -Destination "$($job.Stem).png" -Force:$Force
    Copy-Item -LiteralPath $json -Destination "$($job.Stem).json" -Force:$Force
    Remove-Item -LiteralPath $png, $json
    Remove-Item -LiteralPath $stage
    Write-Host "Exported $($data.frames.Count) frames -> $($job.Stem).png / .json"
}
