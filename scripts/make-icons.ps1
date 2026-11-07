# make-icons.ps1
# ---------------------------------------------------------------------------
# Generate every Android launcher icon / splash PNG from one square source
# image (resources/icon-src.png).
#
#   powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1 -Source D:\path\to\icon.png
#
# Outputs (overwrites):
#   res/mipmap-<density>/ic_launcher.png             legacy square icon
#   res/mipmap-<density>/ic_launcher_round.png       legacy round icon
#   res/mipmap-<density>/ic_launcher_foreground.png  adaptive foreground
#   res/drawable*/splash.png                         launch screen (old API)
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 files as ANSI unless
# they carry a BOM, so non-ASCII literals inside this file would be mangled.
# ---------------------------------------------------------------------------
param(
    [string]$Source = ''
)

Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($Source)) {
    $Source = Join-Path $root 'resources\icon-src.png'
}
$res = Join-Path $root 'android\app\src\main\res'

if (-not (Test-Path -LiteralPath $Source)) {
    throw "source image not found: $Source"
}
if (-not (Test-Path -LiteralPath $res)) {
    throw "android res dir not found: $res"
}

# light blue taken from the artwork background; used behind the photo
$bgColor = [System.Drawing.Color]::FromArgb(255, 216, 236, 250)

$src = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source).Path)

function New-Bitmap([int]$w, [int]$h) {
    return New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function New-Graphics([System.Drawing.Bitmap]$bmp) {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    return $g
}

# square region in the middle of the source (so a non-square photo still works)
function Get-SquareRect([System.Drawing.Image]$img) {
    $side = [Math]::Min($img.Width, $img.Height)
    $x = [int](($img.Width - $side) / 2)
    $y = [int](($img.Height - $side) / 2)
    return New-Object System.Drawing.Rectangle($x, $y, $side, $side)
}

function Get-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    if ($r -le 0) {
        $p.AddRectangle((New-Object System.Drawing.RectangleF($x, $y, $w, $h)))
        return $p
    }
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$sq = Get-SquareRect $src

# --- legacy square icon: photo fills the whole tile -------------------------
function Write-LegacySquare([int]$size, [string]$path) {
    $bmp = New-Bitmap $size $size
    $g = New-Graphics $bmp
    $g.Clear($bgColor)
    $dst = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($src, $dst, $sq, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    Save-Png $bmp $path
    $bmp.Dispose()
}

# --- legacy round icon: circle crop of the same photo -----------------------
function Write-LegacyRound([int]$size, [string]$path) {
    $bmp = New-Bitmap $size $size
    $g = New-Graphics $bmp
    $g.Clear([System.Drawing.Color]::Transparent)
    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    $clip.AddEllipse(0, 0, $size, $size)
    $g.SetClip($clip)
    $dst = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($src, $dst, $sq, [System.Drawing.GraphicsUnit]::Pixel)
    $g.ResetClip()
    $g.Dispose()
    $clip.Dispose()
    Save-Png $bmp $path
    $bmp.Dispose()
}

# --- adaptive foreground: 108dp canvas, artwork at 80% with rounded corners --
function Write-AdaptiveForeground([int]$size, [string]$path) {
    $bmp = New-Bitmap $size $size
    $g = New-Graphics $bmp
    $g.Clear($bgColor)
    $inner = [int][Math]::Round($size * 0.80)
    $off = [int](($size - $inner) / 2)
    $clip = Get-RoundedPath $off $off $inner $inner ($inner * 0.14)
    $g.SetClip($clip)
    $dst = New-Object System.Drawing.Rectangle($off, $off, $inner, $inner)
    $g.DrawImage($src, $dst, $sq, [System.Drawing.GraphicsUnit]::Pixel)
    $g.ResetClip()
    $g.Dispose()
    $clip.Dispose()
    Save-Png $bmp $path
    $bmp.Dispose()
}

# --- old-style launch screen: flat background + small centred artwork --------
function Write-Splash([int]$w, [int]$h, [string]$path) {
    $bmp = New-Bitmap $w $h
    $g = New-Graphics $bmp
    $g.Clear($bgColor)
    $inner = [int][Math]::Round([Math]::Min($w, $h) * 0.34)
    $x = [int](($w - $inner) / 2)
    $y = [int](($h - $inner) / 2)
    $clip = Get-RoundedPath $x $y $inner $inner ($inner * 0.18)
    $g.SetClip($clip)
    $dst = New-Object System.Drawing.Rectangle($x, $y, $inner, $inner)
    $g.DrawImage($src, $dst, $sq, [System.Drawing.GraphicsUnit]::Pixel)
    $g.ResetClip()
    $g.Dispose()
    $clip.Dispose()
    Save-Png $bmp $path
    $bmp.Dispose()
}

$densities = @(
    @{ Dir = 'mipmap-mdpi';    Icon = 48;  Fg = 108 },
    @{ Dir = 'mipmap-hdpi';    Icon = 72;  Fg = 162 },
    @{ Dir = 'mipmap-xhdpi';   Icon = 96;  Fg = 216 },
    @{ Dir = 'mipmap-xxhdpi';  Icon = 144; Fg = 324 },
    @{ Dir = 'mipmap-xxxhdpi'; Icon = 192; Fg = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $res $d.Dir
    Write-LegacySquare $d.Icon (Join-Path $dir 'ic_launcher.png')
    Write-LegacyRound $d.Icon (Join-Path $dir 'ic_launcher_round.png')
    Write-AdaptiveForeground $d.Fg (Join-Path $dir 'ic_launcher_foreground.png')
    Write-Host ("icon  {0}: {1}px / fg {2}px" -f $d.Dir, $d.Icon, $d.Fg)
}

$splashes = @(
    @{ Dir = 'drawable';              W = 480;  H = 320 },
    @{ Dir = 'drawable-land-mdpi';    W = 480;  H = 320 },
    @{ Dir = 'drawable-land-hdpi';    W = 800;  H = 480 },
    @{ Dir = 'drawable-land-xhdpi';   W = 1280; H = 720 },
    @{ Dir = 'drawable-land-xxhdpi';  W = 1600; H = 960 },
    @{ Dir = 'drawable-land-xxxhdpi'; W = 1920; H = 1280 },
    @{ Dir = 'drawable-port-mdpi';    W = 320;  H = 480 },
    @{ Dir = 'drawable-port-hdpi';    W = 480;  H = 800 },
    @{ Dir = 'drawable-port-xhdpi';   W = 720;  H = 1280 },
    @{ Dir = 'drawable-port-xxhdpi';  W = 960;  H = 1600 },
    @{ Dir = 'drawable-port-xxxhdpi'; W = 1280; H = 1920 }
)

foreach ($s in $splashes) {
    Write-Splash $s.W $s.H (Join-Path (Join-Path $res $s.Dir) 'splash.png')
    Write-Host ("splash {0}: {1}x{2}" -f $s.Dir, $s.W, $s.H)
}

$src.Dispose()
Write-Host 'done.'
