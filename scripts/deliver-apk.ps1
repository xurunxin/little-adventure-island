param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_.:-]+$')][string]$Serial,[ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version='1.0.2')
$ErrorActionPreference='Stop'
$taskRoot=[System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$source=[System.IO.Path]::GetFullPath((Join-Path $taskRoot 'android/app/build/outputs/apk/personal/release/app-personal-release.apk'))
$releaseRoot=[System.IO.Path]::GetFullPath((Join-Path $taskRoot 'releases'))
if(-not $source.StartsWith($taskRoot+[System.IO.Path]::DirectorySeparatorChar) -or -not $releaseRoot.StartsWith($taskRoot+[System.IO.Path]::DirectorySeparatorChar)){throw 'Unexpected delivery path'}
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$target=Join-Path $releaseRoot "小小冒险岛-$Version.apk"
Copy-Item -LiteralPath $source -Destination $target -Force
$hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
$remote="/sdcard/Download/LittleAdventureIsland-$Version-$($hash.Substring(0,8)).apk"
$adb=Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
& $adb -s $Serial shell test -e $remote
if($LASTEXITCODE -ne 0){& $adb -s $Serial push $target $remote;if($LASTEXITCODE -ne 0){throw 'Unable to copy release APK to tablet'}}
$remoteHash=(& $adb -s $Serial shell sha256sum $remote).Trim().Split(' ')[0]
if($remoteHash -ne $hash){throw 'Tablet APK checksum differs'}
[ordered]@{apk=$target;tabletFile=$remote;sha256=$hash;bytes=(Get-Item -LiteralPath $target).Length;installed=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'evidence/apk-delivery.json') -Encoding utf8
Write-Output "APK delivered to $target and $remote; SHA256 matches. Installation still requires tablet approval."
