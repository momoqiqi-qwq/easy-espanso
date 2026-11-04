# 把构建出的便携版同步到 DeskBox 桌面
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-deskbox.ps1
# 规则: 目标文件名恒为 "Easy Espanso.exe"（带空格、首字母大写、无版本号）
$ErrorActionPreference = 'Stop'

# 用 certutil 算 sha256：不依赖 Get-FileHash（某些环境里模块自动加载会失效）
function Get-Sha256([string]$Path) {
    $out = & certutil.exe -hashfile $Path SHA256 2>&1
    $hex = ($out | Where-Object { $_ -match '^[0-9A-Fa-f]{64}$' } | Select-Object -First 1)
    if (-not $hex) { throw "certutil 计算 sha256 失败: $Path" }
    return $hex.Trim().ToUpperInvariant()
}

$root   = Split-Path -Parent $PSScriptRoot
$src    = Join-Path $root 'releases\Easy Espanso.exe'
$dstDir = Join-Path $env:USERPROFILE 'DeskBox\DeskBox'
$dst    = Join-Path $dstDir 'Easy Espanso.exe'
# 历史错误命名（点号版），迁移完成后删除
$legacy = Join-Path $dstDir 'Easy.Espanso.exe'

if (-not (Test-Path $src))    { throw "找不到便携版: $src（先跑第三节的便携版步骤）" }
if (-not (Test-Path $dstDir)) { throw "找不到 DeskBox 目录: $dstDir" }

$srcHash = Get-Sha256 $src
$srcVer  = (Get-Item $src).VersionInfo.FileVersion

if ((Test-Path $dst) -and ((Get-Sha256 $dst) -eq $srcHash)) {
    Write-Host "[skip] DeskBox 已是同版本 ($srcVer)，sha256 一致"
    exit 0
}

# 备份 DeskBox 上现有版本（固定名优先，其次旧的点号名）
if (Test-Path $dst) { $current = $dst } elseif (Test-Path $legacy) { $current = $legacy } else { $current = $null }
if ($current) {
    $curVer = (Get-Item $current).VersionInfo.FileVersion
    $bak = Join-Path $dstDir ("Easy Espanso.exe.old-$curVer")
    Copy-Item $current $bak -Force
    Write-Host "[backup] $current -> $bak"
}

try {
    Copy-Item $src $dst -Force
} catch {
    throw "复制失败（应用可能正在运行，先退出 Easy Espanso 再同步）: $($_.Exception.Message)"
}

$dstHash = Get-Sha256 $dst
if ($dstHash -ne $srcHash) { throw "复制后 sha256 不一致: $dst" }

if (Test-Path $legacy) {
    Remove-Item $legacy -Force
    Write-Host "[clean] 已删除旧命名 Easy.Espanso.exe"
}

Write-Host "[ok] DeskBox 已更新为 $srcVer"
Write-Host "     $dst"
Write-Host "     sha256=$dstHash"
