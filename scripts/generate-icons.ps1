Add-Type -AssemblyName System.Drawing

$srcOg = 'assets/img/og-image.png'
$dest512 = 'assets/img/icon-512.png'
Copy-Item $srcOg $dest512 -Force
Write-Host 'Copied icon-512.png'

$srcBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path 'assets/img/splash-logo.png'))

# 192x192
$destBmp192 = [System.Drawing.Bitmap]::new(192, 192)
$g192 = [System.Drawing.Graphics]::FromImage($destBmp192)
$g192.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g192.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g192.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g192.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g192.DrawImage($srcBmp, 0, 0, 192, 192)
$g192.Dispose()
$destBmp192.Save('assets/img/icon-192.png', [System.Drawing.Imaging.ImageFormat]::Png)
$destBmp192.Dispose()
Write-Host 'Generated icon-192.png'

# 180x180 (Apple touch icon)
$destBmp180 = [System.Drawing.Bitmap]::new(180, 180)
$g180 = [System.Drawing.Graphics]::FromImage($destBmp180)
$g180.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g180.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g180.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g180.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g180.DrawImage($srcBmp, 0, 0, 180, 180)
$g180.Dispose()
$destBmp180.Save('assets/img/apple-touch-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$destBmp180.Dispose()
Write-Host 'Generated apple-touch-icon.png'

$srcBmp.Dispose()
