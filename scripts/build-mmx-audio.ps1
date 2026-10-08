param([string]$Voice='Chinese (Mandarin)_Cute_Spirit')
$ErrorActionPreference='Stop'
if(-not $env:MINIMAX_CN_API_KEY){throw 'MINIMAX_CN_API_KEY is not available in the environment'}
$env:MINIMAX_API_KEY=$env:MINIMAX_CN_API_KEY
$taskRoot=Split-Path -Parent $PSScriptRoot
$prompts=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'audio-texts.json') -Raw | ConvertFrom-Json
$voiceHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Voice))).Substring(0,12).ToLowerInvariant()
$staging=Join-Path $taskRoot "design/mmx-audio/speech-2.8-hd-092-$voiceHash"
New-Item -ItemType Directory -Path $staging -Force | Out-Null
$manifest=@()
foreach($item in $prompts){
 $destination=Join-Path $staging ($item.id+'.mp3')
 $inputPath=Join-Path $staging ($item.id+'.txt')
 $sameText=(Test-Path -LiteralPath $inputPath) -and [System.IO.File]::ReadAllText($inputPath) -eq $item.text
 [System.IO.File]::WriteAllText($inputPath,$item.text,[System.Text.UTF8Encoding]::new($false))
 if(-not(Test-Path -LiteralPath $destination) -or -not $sameText){
  $emotion=if($item.id -in @('task-approved','level-up','reward-approved')){'happy'}else{'calm'}
  & rtk proxy mmx speech synthesize --region cn --text-file $inputPath --model speech-2.8-hd --voice $Voice --speed 0.92 --emotion $emotion --language Chinese --format mp3 --sample-rate 32000 --bitrate 128000 --channels 1 --out $destination --quiet --non-interactive
  if($LASTEXITCODE -ne 0){throw "MiniMax TTS failed: $($item.id)"}
 }
 if((Get-Item -LiteralPath $destination).Length -lt 1000){throw "Invalid TTS audio: $($item.id)"}
 Copy-Item -LiteralPath $destination -Destination (Join-Path $taskRoot ('public/audio/'+$item.id+'.mp3')) -Force
 $manifest+=@{id=$item.id;model='speech-2.8-hd';voice=$Voice;speed=0.92;sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash}
 Write-Output "MiniMax audio ready: $($item.id)"
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $taskRoot 'design/audio-manifest.json') -Encoding utf8
Write-Output "Completed $($manifest.Count) offline MiniMax TTS files."
