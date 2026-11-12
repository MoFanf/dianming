# Build a clean folder for uploading to Cloudflare Pages.
# Usage: powershell -ExecutionPolicy Bypass -File tools\make-deploy.ps1
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'deploy'

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$files = @('index.html', 'app.js', 'style.css', 'sw.js', 'manifest.json')
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { Write-Error ("missing: " + $f); exit 1 }
  Copy-Item $src $out
}
New-Item -ItemType Directory -Path (Join-Path $out 'vendor') -Force | Out-Null
Copy-Item (Join-Path $root 'vendor\xlsx.full.min.js') (Join-Path $out 'vendor')
Copy-Item (Join-Path $root 'icons') $out -Recurse
Copy-Item (Join-Path $root 'sounds') $out -Recurse
$soundReadme = Join-Path $out 'sounds\README.md'
if (Test-Path $soundReadme) { Remove-Item $soundReadme -Force }

$all = Get-ChildItem $out -Recurse -File
$sum = ($all | Measure-Object Length -Sum).Sum
Write-Host ("deploy ready: {0} files, {1:N1} KB" -f $all.Count, ($sum / 1KB))
$all | Sort-Object FullName | ForEach-Object { Write-Host ("  " + $_.FullName.Substring($out.Length + 1)) }
