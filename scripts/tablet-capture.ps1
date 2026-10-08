param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_.:-]+$')][string]$Serial,[ValidatePattern('^[A-Za-z0-9_.-]+\.png$')][string]$Name='tablet.png')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$target=Join-Path $taskRoot ('evidence/'+$Name)
New-Item -ItemType Directory -Path (Join-Path $taskRoot 'evidence') -Force | Out-Null
$toolPath=Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$capture=Start-Process -FilePath $toolPath -ArgumentList '-s',$Serial,'exec-out','screencap','-p' -RedirectStandardOutput $target -WindowStyle Hidden -Wait -PassThru
if($capture.ExitCode -ne 0){throw 'Tablet screenshot failed'}
Write-Output $target
