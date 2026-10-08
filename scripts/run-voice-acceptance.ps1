param([ValidateSet('Before','After')][string]$Phase='After',[Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_.:-]+$')][string]$Serial)
$ErrorActionPreference='Stop'
$taskRoot=[System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$adbTool=Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$qaPackage='com.qiaoyu.adventure.qa'
$apk=if($Phase -eq 'Before'){Join-Path $taskRoot 'evidence/private/voice-before.apk'}else{Join-Path $taskRoot 'android/app/build/outputs/apk/qa/debug/app-qa-debug.apk'}
$testApk=Join-Path $taskRoot 'android/app/build/outputs/apk/androidTest/qa/debug/app-qa-debug-androidTest.apk'
$fixture=Join-Path $taskRoot 'evidence/private/little_islandSQLite.db'
function Adb([string[]]$Arguments){& $adbTool -s $Serial @Arguments;if($LASTEXITCODE -ne 0){throw 'ADB voice acceptance operation failed.'}}
Adb @('install','-r',$apk)
Adb @('install','-r',$testApk)
Adb @('shell','am','force-stop',$qaPackage)
Adb @('push',$fixture,'/data/local/tmp/little-island-voice-qa.db')
Adb @('shell','run-as',$qaPackage,'mkdir','-p','databases')
Adb @('shell','run-as',$qaPackage,'cp','/data/local/tmp/little-island-voice-qa.db','databases/little_islandSQLite.db')
Adb @('shell','pm','grant',$qaPackage,'android.permission.RECORD_AUDIO')
$expectDenied=if($Phase -eq 'Before'){'true'}else{'false'}
$reportName=if($Phase -eq 'Before'){'voice-before'}else{'voice-after'}
$startInfo=[System.Diagnostics.ProcessStartInfo]::new($adbTool)
$startInfo.UseShellExecute=$false;$startInfo.CreateNoWindow=$true;$startInfo.RedirectStandardOutput=$true;$startInfo.RedirectStandardError=$true
foreach($argument in @('-s',$Serial,'shell','am','instrument','-w','-e','expectDenied',$expectDenied,'-e','class','com.qiaoyu.adventure.VoiceHoldTest',"$qaPackage.test/androidx.test.runner.AndroidJUnitRunner")){$startInfo.ArgumentList.Add($argument)}
$testProcess=[System.Diagnostics.Process]::Start($startInfo)
$stdout=$testProcess.StandardOutput.ReadToEndAsync();$stderr=$testProcess.StandardError.ReadToEndAsync()
# MIUI blocks the instrumented background context from launching a new activity.
# Launch only our own QA activity through ADB while the test waits for it to resume.
Start-Sleep -Milliseconds 1500
Adb @('shell','am','start','-n',"$qaPackage/com.qiaoyu.adventure.MainActivity")
if(-not $testProcess.WaitForExit(60000)){Adb @('shell','am','force-stop',$qaPackage);throw 'Voice test exceeded the bounded execution window.'}
$testExit=$testProcess.ExitCode
$result=$stdout.GetAwaiter().GetResult()+$stderr.GetAwaiter().GetResult()
$result | Set-Content -LiteralPath (Join-Path $taskRoot "evidence/private/$reportName-instrumentation.txt") -Encoding utf8
Write-Output $result
if($testExit -ne 0 -or $result -notmatch 'OK \(\d+ tests?\)'){throw 'Voice acceptance failed; inspect the isolated QA test output.'}
$report=& $adbTool -s $Serial exec-out run-as $qaPackage cat "files/acceptance/$reportName.json"
if($LASTEXITCODE -ne 0){throw 'Voice acceptance report unavailable'}
$report | Set-Content -LiteralPath (Join-Path $taskRoot "evidence/$reportName.json") -Encoding utf8
Write-Output $report
Adb @('shell','am','force-stop',$qaPackage)
