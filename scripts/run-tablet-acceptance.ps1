param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_.:-]+$')][string]$Serial,[int]$PerformanceSeconds=900)
$ErrorActionPreference='Stop'
$taskRoot=[System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$adb=Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$qaPackage='com.qiaoyu.adventure.qa'
$apk=Join-Path $taskRoot 'android/app/build/outputs/apk/qa/debug/app-qa-debug.apk'
$testApk=Join-Path $taskRoot 'android/app/build/outputs/apk/androidTest/qa/debug/app-qa-debug-androidTest.apk'
$fixture=Join-Path $taskRoot 'evidence/private/little_islandSQLite.db'
foreach($target in @($apk,$testApk,$fixture)){if(-not(Test-Path -LiteralPath $target)){throw "Missing acceptance input: $target"}}
function Adb([string[]]$Arguments){& $adb -s $Serial @Arguments;if($LASTEXITCODE -ne 0){throw 'ADB operation failed. Check tablet approval and USB installation permission.'}}
Adb @('install','-r',$apk)
Adb @('install','-r',$testApk)
Adb @('shell','am','force-stop',$qaPackage)
Adb @('push',$fixture,'/data/local/tmp/little-island-qa.db')
Adb @('shell','run-as',$qaPackage,'mkdir','-p','databases')
Adb @('shell','run-as',$qaPackage,'cp','/data/local/tmp/little-island-qa.db','databases/little_islandSQLite.db')
$priorAirplane=(& $adb -s $Serial shell settings get global airplane_mode_on).Trim()
$priorWifi=(& $adb -s $Serial shell settings get global wifi_on).Trim()
if($priorAirplane -notin @('0','1') -or $priorWifi -notin @('0','1','2')){throw 'Unable to determine original tablet network state; no radio changes were made.'}
try {
 Adb @('shell','cmd','connectivity','airplane-mode','enable')
 Adb @('shell','svc','wifi','disable')
 $testOutput=& $adb -s $Serial shell am instrument -w -e performanceSeconds "$PerformanceSeconds" -e class com.qiaoyu.adventure.IslandAcceptanceTest "$qaPackage.test/androidx.test.runner.AndroidJUnitRunner"
 $testExit=$LASTEXITCODE
 $testOutput | Set-Content -LiteralPath (Join-Path $taskRoot 'evidence/private/tablet-instrumentation.txt') -Encoding utf8
 Write-Output $testOutput
 if($testExit -ne 0 -or ($testOutput -join "`n") -notmatch 'OK \(\d+ tests?\)'){throw 'Native acceptance failed; inspect tablet-instrumentation.txt.'}
 foreach($name in @('native-acceptance.json','flow-state.json','home-dom.txt')){
  $output=[System.IO.Path]::GetFullPath((Join-Path $taskRoot "evidence/private/$name"))
  if(-not $output.StartsWith($taskRoot+[System.IO.Path]::DirectorySeparatorChar)){throw 'Output path escaped workspace'}
  $startInfo=[System.Diagnostics.ProcessStartInfo]::new($adb)
  $startInfo.UseShellExecute=$false;$startInfo.CreateNoWindow=$true;$startInfo.RedirectStandardOutput=$true
  foreach($arg in @('-s',$Serial,'exec-out','run-as',$qaPackage,'cat',"files/acceptance/$name")){$startInfo.ArgumentList.Add($arg)}
  $process=[System.Diagnostics.Process]::Start($startInfo)
  $file=[System.IO.File]::Create($output)
  try{$process.StandardOutput.BaseStream.CopyTo($file)}finally{$file.Dispose()}
  $process.WaitForExit();if($process.ExitCode -ne 0){throw 'Acceptance report not available'}
 }
 Adb @('shell','am','force-stop',$qaPackage)
 Adb @('shell','am','start','-n',"$qaPackage/com.qiaoyu.adventure.MainActivity")
 Write-Output 'Acceptance completed; inspect evidence/private/native-acceptance.json for frame-rate samples and persisted balances.'
} finally {
 if($priorAirplane -eq '0'){& $adb -s $Serial shell cmd connectivity airplane-mode disable}
 if($priorWifi -in @('1','2')){& $adb -s $Serial shell svc wifi enable}
}
