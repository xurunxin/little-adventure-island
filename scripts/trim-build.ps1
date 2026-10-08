$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$assetRoot=[System.IO.Path]::GetFullPath((Join-Path $taskRoot 'dist/client/assets'))
$manifest=Get-Content -LiteralPath (Join-Path $taskRoot 'design/art-manifest.json') -Raw | ConvertFrom-Json
foreach($image in $manifest){
 $target=[System.IO.Path]::GetFullPath((Join-Path $assetRoot $image.source))
 if(-not $target.StartsWith($assetRoot+[System.IO.Path]::DirectorySeparatorChar)){throw 'Build asset path escaped the generated build folder'}
 $runtime=[System.IO.Path]::GetFullPath((Join-Path $assetRoot $image.runtime))
 if(-not(Test-Path -LiteralPath $runtime)){throw "Runtime image missing: $($image.runtime)"}
 if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target}
}
Write-Output 'Build contains optimized images and animation atlases; authoring PNGs remain in public/assets.'
