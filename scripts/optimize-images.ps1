Add-Type -AssemblyName System.Drawing

function Optimize-JpgFile($filePath, $maxDim, $quality) {
    if (-not (Test-Path $filePath)) { return }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $img = [System.Drawing.Bitmap]::FromStream($ms)
    $origW = $img.Width
    $origH = $img.Height

    $ratio = [Math]::Min($maxDim / $origW, $maxDim / $origH)
    if ($ratio -gt 1) { $ratio = 1 }
    $newW = [Math]::Max(1, [int]($origW * $ratio))
    $newH = [Math]::Max(1, [int]($origH * $ratio))

    $newImg = New-Object System.Drawing.Bitmap($newW, $newH)
    $g = [System.Drawing.Graphics]::FromImage($newImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $newW, $newH)

    $img.Dispose()
    $ms.Dispose()
    $g.Dispose()

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)

    $outMs = New-Object System.IO.MemoryStream
    $newImg.Save($outMs, $codec, $encoderParams)
    $newImg.Dispose()

    [System.IO.File]::WriteAllBytes($filePath, $outMs.ToArray())
    $outMs.Dispose()

    $newLen = (Get-Item $filePath).Length
    Write-Host "$filePath -> $newLen bytes ($newW x $newH)"
}

$files = @(
    "assets/img/guru_1.jpg",
    "assets/img/guru_2.jpg",
    "assets/img/guru_3.jpg",
    "assets/img/guru_4.jpg",
    "assets/img/guru_5.jpg",
    "assets/img/guru_6.jpg",
    "assets/img/pembimbing_fuadah.jpg",
    "assets/img/pembimbing_robiah.jpg",
    "assets/img/testimoni_wali_1.jpg",
    "assets/img/testimoni_wali_2.jpg",
    "assets/img/testimoni_wali_3.jpg",
    "assets/img/testimoni_alumni_1.jpg",
    "assets/img/testimoni_alumni_2.jpg",
    "assets/img/testimoni_alumni_3.jpg"
)

foreach ($f in $files) {
    Optimize-JpgFile $f 400 82
}
