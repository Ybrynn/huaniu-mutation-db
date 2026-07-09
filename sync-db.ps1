param(
  [string]$Url,
  [string]$Token,
  [switch]$NoImages
)

$configFile = Join-Path $PSScriptRoot ".sync-config.json"

if (-not $Url -or -not $Token) {
  if (Test-Path $configFile) {
    $cfg = Get-Content $configFile | ConvertFrom-Json
    if (-not $Url) { $Url = $cfg.url }
    if (-not $Token) { $Token = $cfg.token }
  }
}

if (-not $Url -or -not $Token) {
  Write-Host "di1ci1shi3yong4: .\sync-db.ps1 -Url https://ni3de4xiang4mu4.zeabur.app -Token ni3de5token"
  Write-Host "hou4xu4 zhi2jie1 yun4xing2 .\sync-db.ps1 ji4ke3"
  Write-Host "huo3qu3 Token: F12 -> ying4yong1 -> ben3di4 cun2chu3 kong1jian1 -> auth_token"
  exit 1
}

@{ url = $Url; token = $Token } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8

$outFile = Join-Path $PSScriptRoot "mutations.db"
$backupFile = Join-Path $PSScriptRoot "mutations.backup-$($(Get-Date -Format 'yyyyMMdd-HHmmss')).db"

if (Test-Path $outFile) {
  Copy-Item $outFile $backupFile
  Write-Host "local DB backed up: $backupFile"
}

try {
  $uri = "$Url/api/admin/db-download"
  Write-Host "downloading online DB..."
  Invoke-WebRequest -Uri $uri -Headers @{ 'x-auth-token' = $Token } -OutFile $outFile
  Write-Host "DB synced!"
}
catch {
  Write-Host "DB download failed: $($_.Exception.Message)"
  if (-not $NoImages) { $NoImages = $true }
}

if (-not $NoImages) {
  try {
    $uri = "$Url/api/admin/uploads-list"
    Write-Host "fetching image list..."
    $files = Invoke-WebRequest -Uri $uri -Headers @{ 'x-auth-token' = $Token } -UseBasicParsing | ConvertFrom-Json

    $uploadsDir = Join-Path $PSScriptRoot "uploads"
    if (-not (Test-Path $uploadsDir)) { New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null }

    $count = 0
    foreach ($f in $files) {
      $fileUrl = "$Url/$($f -replace '\\', '/')"
      $outPath = Join-Path $uploadsDir (Split-Path $f -Leaf)
      Write-Host "  $($f) ... " -NoNewline
      try {
        Invoke-WebRequest -Uri $fileUrl -Headers @{ 'x-auth-token' = $Token } -OutFile $outPath -UseBasicParsing
        Write-Host "OK"
        $count++
      }
      catch {
        Write-Host "FAIL"
      }
    }
    Write-Host "images synced! total: $count"
  }
  catch {
    Write-Host "image list failed: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "restart Node service to apply."
