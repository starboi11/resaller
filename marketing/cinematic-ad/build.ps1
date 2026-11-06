$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ffmpeg = & py -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'
if ($LASTEXITCODE -ne 0) { throw 'imageio-ffmpeg is required.' }

$render = Join-Path $repo 'test-results\cinematic-ad-render'
New-Item -ItemType Directory -Force -Path $render | Out-Null
$frames = @('seller-packing', 'buyer-unboxing', 'delivery')
$clips = @()
foreach ($frame in $frames) {
  $source = Join-Path $PSScriptRoot "$frame.png"
  $clip = Join-Path $render "$frame.mp4"
  & $ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i $source `
    -vf "scale=1408:792:force_original_aspect_ratio=increase,crop=1408:792,zoompan=z='min(zoom+0.00085,1.085)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,fade=t=in:st=0:d=0.25,fade=t=out:st=2.75:d=0.25,format=yuv420p" `
    -frames:v 90 -an -c:v libx264 -preset medium -crf 21 -movflags +faststart $clip
  if ($LASTEXITCODE -ne 0) { throw "Failed to render $frame" }
  $clips += $clip
}

$outro = Join-Path $render 'outro.mp4'
& $ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'color=c=0x08090b:s=1280x720:r=30:d=3' `
  -vf "drawbox=x=538:y=250:w=204:h=3:color=0xb92e42:t=fill,drawtext=font='Arial':text='RESALLER.UZ':fontcolor=white:fontsize=78:x=(w-text_w)/2:y=287,drawtext=font='Arial':text='Xarid qilish va sotishning yaxshiroq yo''li':fontcolor=0xcacace:fontsize=29:x=(w-text_w)/2:y=407,fade=t=in:st=0:d=0.35,fade=t=out:st=2.7:d=0.3,format=yuv420p" `
  -frames:v 90 -an -c:v libx264 -preset medium -crf 21 -movflags +faststart $outro
if ($LASTEXITCODE -ne 0) { throw 'Failed to render outro' }
$clips += $outro

$output = Join-Path $repo 'apps\web\public\ads\resaller-cinematic-12s.mp4'
& $ffmpeg -hide_banner -loglevel error -y -i $clips[0] -i $clips[1] -i $clips[2] -i $clips[3] `
  -filter_complex '[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]' -map '[v]' `
  -an -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart $output
if ($LASTEXITCODE -ne 0) { throw 'Failed to concatenate ad' }
Write-Output $output
