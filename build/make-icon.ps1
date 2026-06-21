Add-Type -AssemblyName System.Drawing

$size = 256
$out  = Join-Path $PSScriptRoot 'icon.png'

$x = 8
$y = 8
$w = $size - 16
$h = $size - 16

$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

# --- Rounded gradient tile ---
$rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
$c1   = [System.Drawing.Color]::FromArgb(0x6c, 0x8c, 0xff)   # accent
$c2   = [System.Drawing.Color]::FromArgb(0x3a, 0x5a, 0xcf)   # deeper accent
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)

$radius = 56
$rX = $rect.X
$rY = $rect.Y
$rR = $rect.Right
$rB = $rect.Bottom
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($rX,             $rY,        $radius, $radius, 180, 90)
$path.AddArc($rR - $radius,   $rY,        $radius, $radius, 270, 90)
$path.AddArc($rR - $radius,   $rB - $radius, $radius, $radius, 0,   90)
$path.AddArc($rX,             $rB - $radius, $radius, $radius, 90,  90)
$path.CloseFigure()
$g.FillPath($grad, $path)
$g.SetClip($path)

# --- Hub motif: ring + 4 ports + center ---
$cx = $size / 2
$cy = $size / 2
$white    = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 24)
$whitePen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center

$ringR = 58
$ringX = $cx - $ringR
$ringY = $cy - $ringR
$ringD = $ringR * 2
$g.DrawEllipse($whitePen, $ringX, $ringY, $ringD, $ringD)

$dotR = 16
$g.FillEllipse($white, ($cx - $dotR), ($cy - $dotR), ($dotR * 2), ($dotR * 2))

$portR    = 13
$portDist = 92
$ports = New-Object 'System.Collections.Generic.List[object]'
$ports.Add(@{ X = $cx;             Y = $cy - $portDist }) | Out-Null
$ports.Add(@{ X = $cx + $portDist; Y = $cy })             | Out-Null
$ports.Add(@{ X = $cx;             Y = $cy + $portDist }) | Out-Null
$ports.Add(@{ X = $cx - $portDist; Y = $cy })             | Out-Null
foreach ($p in $ports) {
  $g.FillEllipse($white, ($p.X - $portR), ($p.Y - $portR), ($portR * 2), ($portR * 2))
}

$g.ResetClip()
$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output ("wrote " + $out + " (" + (Get-Item $out).Length + " bytes)")
