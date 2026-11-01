Add-Type -AssemblyName PresentationCore
$ErrorActionPreference = 'Stop'
$directory = Join-Path $PSScriptRoot '../assets/barel/black-moon-slash-concepts'
$encoder = [System.Windows.Media.Imaging.GifBitmapEncoder]::new()
$files = Get-ChildItem -LiteralPath $directory -Filter 'hit-*.png' | Sort-Object Name
if ($files.Count -ne 5) { throw 'Expected five strike sheets.' }
foreach ($file in $files) {
    $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($file.FullName, [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $source = $decoder.Frames[0]
    for ($row = 0; $row -lt 2; $row++) {
        for ($col = 0; $col -lt 5; $col++) {
            $x = [int][Math]::Floor($col * $source.PixelWidth / 5)
            $y = [int][Math]::Floor($row * $source.PixelHeight / 2)
            $width = [int][Math]::Floor(($col + 1) * $source.PixelWidth / 5) - $x
            $height = [int][Math]::Floor(($row + 1) * $source.PixelHeight / 2) - $y
            # Uniform dimensions keep the GIF canvas stable.
            $rect = [System.Windows.Int32Rect]::new($x, $y, 396, 396)
            $crop = [System.Windows.Media.Imaging.CroppedBitmap]::new($source, $rect)
            $metadata = [System.Windows.Media.Imaging.BitmapMetadata]::new('gif')
            $metadata.SetQuery('/grctlext/Delay', [uint16]8)
            $metadata.SetQuery('/grctlext/Disposal', [byte]2)
            if ($encoder.Frames.Count -eq 0) {
                $metadata.SetQuery('/appext/Application', [byte[]](78,69,84,83,67,65,80,69,50,46,48))
                $metadata.SetQuery('/appext/Data', [byte[]](3,1,0,0,0))
            }
            $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($crop, $null, $metadata, $null))
        }
    }
}
$output = Join-Path $directory 'black-moon-slash-preview.gif'
$stream = [System.IO.File]::Create($output)
try { $encoder.Save($stream) } finally { $stream.Dispose() }
# WPF's GIF encoder discards per-frame timing metadata. Set the control
# extensions directly and add the standard infinite-loop application block.
$bytes = [System.IO.File]::ReadAllBytes($output)
$offset = 13
if ($bytes[10] -band 0x80) { $offset += 3 * (1 -shl (($bytes[10] -band 7) + 1)) }
$headerEnd = $offset
$frameCount = 0
while ($offset -lt $bytes.Length) {
    $marker = $bytes[$offset++]
    if ($marker -eq 0x3b) { break }
    if ($marker -eq 0x21) {
        $label = $bytes[$offset++]
        if ($label -eq 0xf9) {
            if ($bytes[$offset] -ne 4) { throw 'Invalid GIF control block.' }
            $bytes[$offset + 1] = ($bytes[$offset + 1] -band 0xe3) -bor 8
            $bytes[$offset + 2] = 8; $bytes[$offset + 3] = 0
        }
    } elseif ($marker -eq 0x2c) {
        $packed = $bytes[$offset + 8]
        $offset += 9
        if ($packed -band 0x80) { $offset += 3 * (1 -shl (($packed -band 7) + 1)) }
        $offset++ # LZW minimum code size
        $frameCount++
    } else { throw "Unexpected GIF block: $marker" }
    do { $size = $bytes[$offset]; $offset += 1 + $size } while ($size -ne 0)
}
if ($frameCount -ne 50) { throw "Expected 50 frames, found $frameCount." }
$loop = [byte[]](0x21,0xff,0x0b,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0)
$stream = [System.IO.File]::Create($output)
try {
    $stream.Write($bytes, 0, $headerEnd)
    $stream.Write($loop, 0, $loop.Length)
    $stream.Write($bytes, $headerEnd, $bytes.Length - $headerEnd)
} finally { $stream.Dispose() }
Write-Output "Saved $output ($($encoder.Frames.Count) frames)"
