<#
.SYNOPSIS
Memasang Kopi Senja POS di laptop Windows dari nol.

.DESCRIPTION
Urutan: Git (jika belum ada), clone repo, Node.js 22 portable, pnpm, lalu
install dependency, setup database, dan build produksi. Node.js dan pnpm hanya
dipasang di dalam folder proyek (.tools), sehingga instalasi Node lain di
laptop tidak berubah. Jalankan ulang script ini untuk memperbarui aplikasi;
data, .env.local, dan .tools dipertahankan.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:USERPROFILE 'KopiSenja'),
    [string]$RepoUrl = 'https://github.com/thomiaditya/senja-pos-system.git',
    [string]$Branch = 'main',
    [string]$NodeVersion = 'v22.23.4'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Info([string]$Message) { Write-Host "    $Message" }
function Write-Warn([string]$Message) { Write-Host "    PERINGATAN: $Message" -ForegroundColor Yellow }

# Menjalankan program eksternal dan menghentikan script jika exit code bukan 0.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$Exe,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory
    )
    $location = if ($WorkingDirectory) { $WorkingDirectory } else { (Get-Location).Path }
    Push-Location $location
    try {
        & $Exe @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Perintah gagal (kode $LASTEXITCODE): $Exe $($Arguments -join ' ')"
        }
    } finally {
        Pop-Location
    }
}

function Find-Git {
    $cmd = Get-Command git -ErrorAction SilentlyContinue
    if ($cmd) { return (Split-Path $cmd.Source) }
    $candidates = @(
        (Join-Path $env:ProgramFiles 'Git\cmd'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd')
    )
    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir 'git.exe')) { return $dir }
    }
    return $null
}

# Fallback jika Git tidak tersedia: unduh ZIP branch dari GitHub lalu timpa file sumber.
function Get-RepoZip {
    $pattern = 'github\.com[/:]([^/]+)/([^/]+?)(\.git)?/?$'
    if ($RepoUrl -notmatch $pattern) {
        throw "Unduhan ZIP hanya didukung untuk repo GitHub: $RepoUrl"
    }
    $match = [regex]::Match($RepoUrl, $pattern)
    $url = "https://github.com/$($match.Groups[1].Value)/$($match.Groups[2].Value)/archive/refs/heads/$Branch.zip"
    $tmp = Join-Path $env:TEMP ('kopi-senja-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        $zip = Join-Path $tmp 'repo.zip'
        Write-Info "Mengunduh $url"
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath $tmp
        $root = Get-ChildItem $tmp -Directory | Select-Object -First 1
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        Copy-Item -Path (Join-Path $root.FullName '*') -Destination $InstallDir -Recurse -Force
    } finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Step "1/6 Memeriksa sistem dan Git"
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') {
    throw "Installer ini hanya untuk Windows 64-bit (x64). Arsitektur terdeteksi: $env:PROCESSOR_ARCHITECTURE"
}
$gitDir = Find-Git
if (-not $gitDir -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Info "Git belum ada. Memasang Git lewat winget (Windows mungkin meminta izin)."
    & winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
    $gitDir = Find-Git
}
if ($gitDir) {
    $env:Path = "$gitDir;$env:Path"
    Write-Info "Git siap: $gitDir"
} else {
    Write-Warn "Git tidak tersedia. Repo diunduh sebagai ZIP dan update berikutnya juga lewat ZIP."
}

Write-Step "2/6 Menyiapkan repo di $InstallDir"
$repoGit = Join-Path $InstallDir '.git'
$hasSources = Test-Path (Join-Path $InstallDir 'package.json')
if (Test-Path $repoGit) {
    Write-Info "Repo Git sudah ada, memperbarui branch $Branch."
    Invoke-Native git @('fetch', 'origin', $Branch) -WorkingDirectory $InstallDir
    Invoke-Native git @('checkout', $Branch) -WorkingDirectory $InstallDir
    Invoke-Native git @('pull', '--ff-only', 'origin', $Branch) -WorkingDirectory $InstallDir
} elseif ($hasSources) {
    Write-Info "Instalasi sebelumnya berupa ZIP, memperbarui file sumber."
    Get-RepoZip
} elseif ($gitDir) {
    if ((Test-Path $InstallDir) -and @(Get-ChildItem $InstallDir -Force).Count -gt 0) {
        throw "Folder $InstallDir sudah berisi file lain. Pilih folder kosong dengan -InstallDir."
    }
    Invoke-Native git @('clone', '--branch', $Branch, $RepoUrl, $InstallDir)
} else {
    Get-RepoZip
}

Write-Step "3/6 Menyiapkan Node.js $NodeVersion (portable)"
$toolsDir = Join-Path $InstallDir '.tools'
$nodeDir = Join-Path $toolsDir 'node'
$nodeExe = Join-Path $nodeDir 'node.exe'
$currentNode = if (Test-Path $nodeExe) { (& $nodeExe -v) } else { '' }
if ($currentNode -ne $NodeVersion) {
    $base = "https://nodejs.org/dist/$NodeVersion"
    $zipName = "node-$NodeVersion-win-x64.zip"
    $tmp = Join-Path $env:TEMP ('node-setup-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        $zipPath = Join-Path $tmp $zipName
        Write-Info "Mengunduh $zipName"
        Invoke-WebRequest -Uri "$base/$zipName" -OutFile $zipPath -UseBasicParsing

        $sums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing).Content -split "\r?\n"
        $line = $sums | Where-Object { $_ -match ('\s' + [regex]::Escape($zipName) + '$') } | Select-Object -First 1
        if (-not $line) { throw "Checksum untuk $zipName tidak ditemukan di SHASUMS256.txt." }
        $expected = ($line.Trim() -split '\s+')[0]
        $actual = (Get-FileHash -Algorithm SHA256 $zipPath).Hash
        if ($actual.ToLowerInvariant() -ne $expected.ToLowerInvariant()) {
            throw 'Checksum Node.js tidak cocok. Unduhan mungkin rusak, jalankan ulang installer.'
        }

        Expand-Archive -Path $zipPath -DestinationPath $tmp
        New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
        if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
        Move-Item -Path (Join-Path $tmp "node-$NodeVersion-win-x64") -Destination $nodeDir
    } finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$env:Path = "$nodeDir;$env:Path"
Write-Info "Node.js aktif: $(& $nodeExe -v)"

Write-Step "4/6 Menyiapkan pnpm"
$pkg = Get-Content (Join-Path $InstallDir 'package.json') -Raw | ConvertFrom-Json
if (-not $pkg.packageManager -or $pkg.packageManager -notmatch '^pnpm@') {
    throw 'package.json tidak mencantumkan versi pnpm pada field packageManager.'
}
$pnpmVersion = $pkg.packageManager -replace '^pnpm@', ''
$pnpmCmd = Join-Path $nodeDir 'pnpm.cmd'
if (-not (Test-Path $pnpmCmd) -or ((& $pnpmCmd -v) -ne $pnpmVersion)) {
    Invoke-Native (Join-Path $nodeDir 'npm.cmd') @('install', '-g', "pnpm@$pnpmVersion", '--prefix', $nodeDir)
}
Write-Info "pnpm aktif: $(& $pnpmCmd -v)"

Write-Step "5/6 Install dependency, setup database, dan build"
Write-Info 'Tahap ini bisa memakan beberapa menit di laptop spek rendah.'
Invoke-Native $pnpmCmd @('install', '--frozen-lockfile') -WorkingDirectory $InstallDir
Invoke-Native $pnpmCmd @('db:setup') -WorkingDirectory $InstallDir
Invoke-Native $pnpmCmd @('build') -WorkingDirectory $InstallDir

Write-Step "6/6 Shortcut desktop dan firewall"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Kopi Senja POS.lnk'))
$shortcut.TargetPath = Join-Path $InstallDir 'scripts\windows\start-server.bat'
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Save()
Write-Info "Shortcut 'Kopi Senja POS' dibuat di desktop."

$ruleName = 'Kopi Senja POS (TCP 3000)'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private | Out-Null
    }
    Write-Info 'Firewall dibuka untuk port 3000 pada jaringan Private.'
} else {
    Write-Warn "Bukan Administrator, firewall belum dibuka. Jalankan PowerShell sebagai Administrator lalu: New-NetFirewallRule -DisplayName ""$ruleName"" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private"
}

$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress

Write-Host "`nInstalasi selesai." -ForegroundColor Green
Write-Info "Folder aplikasi : $InstallDir"
Write-Info "Jalankan server : shortcut 'Kopi Senja POS' di desktop"
Write-Info 'Buka di server  : http://localhost:3000'
foreach ($ip in $ips) { Write-Info "Dari perangkat lain: http://${ip}:3000" }
Write-Info 'Password demo dicetak oleh db:setup pada instalasi pertama dan tersimpan di .env.local (DEMO_PASSWORD).'
Write-Info 'Tanya AI bersifat opsional: isi GEMINI_API_KEY di .env.local bila ingin mengaktifkannya.'
