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
  Write-Host "第一次使用: .\sync-db.ps1 -Url https://你的项目.zeabur.app -Token 你的token"
  Write-Host ""
  Write-Host "之后直接运行 .\sync-db.ps1 即可（token 7天过期后需重新传入）"
  Write-Host ""
  Write-Host "获取 Token: 浏览器登录线上系统后 F12 → 应用 → 本地存储空间 → auth_token"
  exit 1
}

# 保存配置供下次使用
@{ url = $Url; token = $Token } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8

# ---- 同步数据库 ----
$outFile = Join-Path $PSScriptRoot "mutations.db"
$backupFile = Join-Path $PSScriptRoot "mutations.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').db"

if (Test-Path $outFile) {
  Copy-Item $outFile $backupFile
  Write-Host "本地数据库已备份: $backupFile"
}

try {
  $uri = "$Url/api/admin/db-download"
  Write-Host "正在从线上下载数据库..."
  Invoke-WebRequest -Uri $uri -Headers @{ 'x-auth-token' = $Token } -OutFile $outFile
  Write-Host "数据库同步成功！"
}
catch {
  Write-Host "数据库下载失败: $($_.Exception.Message)"
  if (-not $NoImages) { $NoImages = $true }
}

# ---- 同步图片 ----
if (-not $NoImages) {
  try {
    $uri = "$Url/api/admin/uploads-list"
    Write-Host "正在获取线上图片列表..."
    $files = Invoke-WebRequest -Uri $uri -Headers @{ 'x-auth-token' = $Token } -UseBasicParsing | ConvertFrom-Json

    $uploadsDir = Join-Path $PSScriptRoot "uploads"
    if (-not (Test-Path $uploadsDir)) { New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null }

    $count = 0
    foreach ($f in $files) {
      $fileUrl = "$Url/$($f -replace '\\', '/')"
      $outPath = Join-Path $uploadsDir (Split-Path $f -Leaf)
      Write-Host "  下载: $($f)" -NoNewline
      try {
        Invoke-WebRequest -Uri $fileUrl -Headers @{ 'x-auth-token' = $Token } -OutFile $outPath -UseBasicParsing
        Write-Host " ✓"
        $count++
      }
      catch {
        Write-Host " ✗"
      }
    }
    Write-Host "图片同步完成！共下载 $count 张。"
  }
  catch {
    Write-Host "图片列表获取失败: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "请重启 Node 服务使新数据生效。"
