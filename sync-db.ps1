param(
  [string]$Url,
  [string]$Token
)

if (-not $Url -or -not $Token) {
  Write-Host "用法: .\sync-db.ps1 -Url <线上地址> -Token <管理员token>"
  Write-Host ""
  Write-Host "示例: .\sync-db.ps1 -Url https://你的项目.zeabur.app -Token eyJ..."
  Write-Host ""
  Write-Host "获取 Token: 浏览器登录线上系统后 F12 → Application → Local Storage → auth_token"
  exit 1
}

$outFile = Join-Path $PSScriptRoot "mutations.db"
$backupFile = Join-Path $PSScriptRoot "mutations.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').db"

if (Test-Path $outFile) {
  Copy-Item $outFile $backupFile
  Write-Host "本地数据库已备份至: $backupFile"
}

try {
  $uri = "$Url/api/admin/db-download"
  Write-Host "正在从线上下载数据库..."
  Invoke-WebRequest -Uri $uri -Headers @{ 'x-auth-token' = $Token } -OutFile $outFile
  Write-Host "同步成功！本地数据库已更新: $outFile"
  Write-Host "请重启 Node 服务使新数据库生效。"
}
catch {
  Write-Host "同步失败: $($_.Exception.Message)"
}
