param(
  [string]$Url,
  [string]$Token
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
  Write-Host "同步成功！请重启 Node 服务。"
}
catch {
  Write-Host "同步失败: $($_.Exception.Message)"
}
