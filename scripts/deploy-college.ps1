# ──────────────────────────────────────────────────────────────────────────────
# deploy-college.ps1 — deploy the InterviewApp to a single Windows lab PC
# (bare processes managed by PM2 + local MongoDB). Idempotent: safe to re-run.
#
# Prerequisites (run once, manually):
#   - Install MongoDB Community Server (provides mongod.exe / mongodump.exe)
#   - Install Node.js 20+ and Python 3.11+
#   - npm install -g pm2 pm2-windows-startup   (for reboot auto-start)
#
# Optional env overrides (before running):
#   $env:MONGOD_EXE  = path to mongod.exe  (default: C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe)
#   $env:PYTHON_EXE  = python interpreter  (default: python)
#   $env:MONGO_DBPATH= MongoDB data dir    (default: <repo>\college-data\db)
#   $env:APP_PORT    = backend port        (default: 5000)
#
# Run from any directory:  powershell -ExecutionPolicy Bypass -File scripts\deploy-college.ps1
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

$MongoDbExe = if ($env:MONGOD_EXE) { $env:MONGOD_EXE } else { 'C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe' }
$PythonExe  = if ($env:PYTHON_EXE) { $env:PYTHON_EXE } else { 'python' }
$AppPort    = if ($env:APP_PORT) { [int]$env:APP_PORT } else { 5000 }

function Test-CommandExists([string]$Cmd) {
  return [bool](Get-Command $Cmd -ErrorAction SilentlyContinue)
}

Write-Host "=== College deployment for: $Root ===" -ForegroundColor Cyan

# ── Preflight ─────────────────────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath $MongoDbExe)) {
  if (Test-CommandExists 'mongod') { $MongoDbExe = (Get-Command mongod).Source }
  else {
    Write-Error "mongod.exe not found at '$MongoDbExe' and 'mongod' is not on PATH. Install MongoDB Community Server first (or set `$env:MONGOD_EXE)."
  }
}
if (-not (Test-CommandExists 'node'))  { Write-Error 'Node.js is required (node not found on PATH).' }
if (-not (Test-CommandExists $PythonExe)) { Write-Error "Python interpreter '$PythonExe' not found." }
if (-not (Test-CommandExists 'pm2'))  { Write-Error 'PM2 is required (npm install -g pm2).' }

# Writable data directory (outside the repo so app data survives repo updates)
$DataDir = if ($env:MONGO_DBPATH) { $env:MONGO_DBPATH } else { Join-Path $Root 'college-data' }
$DbPath  = Join-Path $DataDir 'db'
$LogDir  = Join-Path $DataDir 'logs'
New-Item -ItemType Directory -Path $DbPath -Force | Out-Null
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$testFile = Join-Path $DbPath '.write-test'
try { Set-Content -Path $testFile -Value 'ok'; Remove-Item $testFile -Force } catch { Write-Error "MongoDB data dir is not writable: $DbPath" }

# ── Environment files (never overwrite an existing .env) ──────────────────────
function Ensure-Env([string]$Target, [string]$Template, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Target)) {
    Copy-Item -LiteralPath $Template -Destination $Target
    Write-Host "  created $Label from template (fill in real values and re-run to apply)." -ForegroundColor Yellow
  } else {
    Write-Host "  $Label already present - leaving untouched." -ForegroundColor Gray
  }
}
Ensure-Env (Join-Path $Root 'backend\.env') (Join-Path $PSScriptRoot 'college.env.example') 'backend/.env'
Ensure-Env (Join-Path $Root 'ai-services\face-service\.env') (Join-Path $Root 'ai-services\face-service\.env.example') 'face-service/.env'
Ensure-Env (Join-Path $Root 'ai-services\voice-service\.env') (Join-Path $Root 'ai-services\voice-service\.env.example') 'voice-service/.env'
Ensure-Env (Join-Path $Root 'ai-services\nlp-service\.env') (Join-Path $Root 'ai-services\nlp-service\.env.example') 'nlp-service/.env'

# Warn if the backend .env looks like the default cloud template (missing college flags)
$backendEnv = Join-Path $Root 'backend\.env'
if (Test-Path -LiteralPath $backendEnv) {
  $envText = Get-Content $backendEnv -Raw
  if ($envText -notmatch 'SERVE_FRONTEND=true') {
    Write-Host "  WARNING: backend/.env does not set SERVE_FRONTEND=true. Copy scripts\college.env.example over backend/.env for college mode." -ForegroundColor Yellow
  }
}

# ── Install dependencies (idempotent) ─────────────────────────────────────────
Write-Host "=== Installing dependencies ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root 'backend')
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Error 'backend npm install failed.' }
Pop-Location
Push-Location (Join-Path $Root 'frontend')
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Error 'frontend npm install failed.' }
Pop-Location
foreach ($svc in @('face-service', 'voice-service', 'nlp-service')) {
  $dir = Join-Path $Root "ai-services\$svc"
  Push-Location $dir
    & $PythonExe -m pip install -r requirements.txt --quiet
    if ($LASTEXITCODE -ne 0) { Write-Error "$svc pip install failed." }
  Pop-Location
}

# ── Pre-seed the SER model so the voice service does not download on first use ─
$voiceEnv = Join-Path $Root 'ai-services\voice-service\.env'
$serPath = Join-Path $Root 'SER_model\best_model_path.pth'
if (-not (Test-Path -LiteralPath $serPath)) {
  Write-Host "=== Pre-seeding SER model ===" -ForegroundColor Cyan
  New-Item -ItemType Directory -Path (Split-Path -Parent $serPath) -Force | Out-Null
  $url = $null
  if (Test-Path -LiteralPath $voiceEnv) {
    $line = Select-String -Path $voiceEnv -Pattern '^SER_MODEL_URL=' | Select-Object -First 1
    if ($line) { $url = ($line.Line -replace '^SER_MODEL_URL=', '') }
  }
  if (-not $url) { $url = 'https://github.com/Noob-code7/InterviewApp/releases/download/v1.0-ser-model/best_model_path.pth' }
  try {
    Invoke-WebRequest -Uri $url -OutFile $serPath -UseBasicParsing
    Write-Host "  downloaded SER model -> $serPath" -ForegroundColor Green
  } catch {
    Write-Host "  SER model download failed ($($_.Exception.Message)). The voice service will try to download it on first use." -ForegroundColor Yellow
  }
} else {
  Write-Host "  SER model already present." -ForegroundColor Gray
}

# ── Build frontend for single-origin serving (relative API base) ──────────────
Write-Host "=== Building frontend ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root 'frontend')
  $env:VITE_API_URL = '/'
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Error 'frontend build failed.' }
Pop-Location

# ── PM2: start or reload all apps (idempotent) ────────────────────────────────
Write-Host "=== Starting services via PM2 ===" -ForegroundColor Cyan
& pm2 startOrRestart (Join-Path $Root 'ecosystem.college.config.cjs')
if ($LASTEXITCODE -ne 0) { Write-Error 'pm2 startOrRestart failed.' }
& pm2 save
if ($LASTEXITCODE -ne 0) { Write-Error 'pm2 save failed.' }

# ── Windows reboot auto-start (idempotent) ────────────────────────────────────
Write-Host "=== Ensuring PM2 auto-start on boot ===" -ForegroundColor Cyan
if (-not (Test-CommandExists 'pm2-startup')) {
  npm install -g pm2-windows-startup --silent
}
try {
  & pm2-startup install 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  pm2-startup install returned $LASTEXITCODE (may already be configured) - continuing." -ForegroundColor Yellow }
  else { Write-Host "  pm2-startup installed (boot auto-restore enabled)." -ForegroundColor Green }
} catch {
  Write-Host "  pm2-startup install skipped ($($_.Exception.Message)). Run 'pm2-startup install' manually once (needs admin)." -ForegroundColor Yellow
}

# ── Firewall: allow inbound traffic on the app port (idempotent) ──────────────
Write-Host "=== Configuring Windows Firewall ===" -ForegroundColor Cyan
$ruleName = "InterviewApp-LAN-$AppPort"
$existing = & netsh advfirewall firewall show rule name="$ruleName" 2>$null | Out-String
if ($existing -match 'No rules match') {
  & netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=$AppPort | Out-Null
  Write-Host "  added firewall rule '$ruleName' for port $AppPort." -ForegroundColor Green
} else {
  Write-Host "  firewall rule '$ruleName' already exists." -ForegroundColor Gray
}

# ── Health checks ─────────────────────────────────────────────────────────────
Write-Host "=== Waiting for services to become healthy ===" -ForegroundColor Cyan
$targets = @(
  @{ Name = 'MongoDB';   Port = 27017 },
  @{ Name = 'Backend';   Port = $AppPort },
  @{ Name = 'Face';      Port = 8001 },
  @{ Name = 'Voice';     Port = 8002 },
  @{ Name = 'NLP';       Port = 8003 }
)
$deadline = (Get-Date).AddMinutes(3)
foreach ($t in $targets) {
  $ok = $false
  while ((Get-Date) -lt $deadline) {
    $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port $t.Port -WarningAction SilentlyContinue
    if ($conn.TcpTestSucceeded) { $ok = $true; break }
    Start-Sleep -Seconds 3
  }
  if ($ok) { Write-Host ("  {0,-10} OK  (port {1})" -f $t.Name, $t.Port) -ForegroundColor Green }
  else     { Write-Host ("  {0,-10} FAILED (port {1}) - check PM2: 'pm2 logs'" -f $t.Name, $t.Port) -ForegroundColor Red }
}

# ── LAN URL ───────────────────────────────────────────────────────────────────
$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } |
      Select-Object -First 1
Write-Host ""
Write-Host "=== Deployment complete ===" -ForegroundColor Cyan
if ($ip) {
  Write-Host "Students connect to:  http://$($ip.IPAddress):$AppPort" -ForegroundColor Green
} else {
  Write-Host "LAN URL: http://<this-machine-ip>:$AppPort  (detect IP via ipconfig)" -ForegroundColor Green
}
Write-Host "PM2 status:   pm2 status"
Write-Host "PM2 logs:     pm2 logs college-backend"
Write-Host "Backup:       powershell -ExecutionPolicy Bypass -File scripts\backup-college.ps1"
