$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$nativeRoot=Join-Path $taskRoot 'android'
$settingsPath=Join-Path $nativeRoot 'signing.properties'
if(Test-Path -LiteralPath $settingsPath){Write-Output 'Existing update signing key preserved.';exit 0}
$signingFolder=Join-Path $nativeRoot 'signing'
New-Item -ItemType Directory -Path $signingFolder -Force | Out-Null
$keyPath=Join-Path $signingFolder 'island-release.jks'
if(Test-Path -LiteralPath $keyPath){throw 'Signing key already exists without properties; do not replace it.'}
$env:ISLAND_STORE_PASSWORD=[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
try {
  & rtk proxy keytool -genkeypair -keystore $keyPath -storepass:env ISLAND_STORE_PASSWORD -keypass:env ISLAND_STORE_PASSWORD -alias island -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Little Adventure Island, OU=Family App, O=Qiaoyu, C=CN' -noprompt
  if($LASTEXITCODE -ne 0){throw 'Signing key generation failed'}
  $settings="storeFile=signing/island-release.jks`nstorePassword=$env:ISLAND_STORE_PASSWORD`nkeyAlias=island`nkeyPassword=$env:ISLAND_STORE_PASSWORD`n"
  [System.IO.File]::WriteAllText($settingsPath,$settings,[System.Text.UTF8Encoding]::new($false))
  Write-Output 'Persistent local release signing key created. Keep android/signing and signing.properties for future updates.'
} finally {Remove-Item Env:ISLAND_STORE_PASSWORD -ErrorAction SilentlyContinue}
