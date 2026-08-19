# ──────────────────────────────────────────────────────────────────────────────
# backup-college.ps1 — nightly backup for the college LAN deployment.
#
# Backs up ONLY the local college data (independent of cloud storage):
#   1. mongodump --archive --gzip  while MongoDB is running
#   2. Compress-Archive of backend/uploads
# Backups are written to <DataDir>\backups and pruned after N days (default 14).
#
# Optional:  $env:MONGO_DBPATH  to match the deploy data dir (defaults to
#            <repo>\college-data\db, same default as deploy-college.ps1).
# Optional:  $env:BACKUP_KEEP_DAYS  retention (default 14).
#
# Schedule (idempotent, run once as admin):
#   schtasks /Create /TN "InterviewAppBackup" /SC DAILY /ST 02:00 /TR "powershell -ExecutionPolicy Bypass -File \"C:\path\scripts\backup-college.ps1\""
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

$DataDir = if ($env:MONGO_DBPATH) { Split-Path -Parent $env:MONGO_DBPATH } else { Join-Path $Root 'college-data' }
$BackupDir = Join-Path $DataDir 'backups'
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$KeepDays = if ($env:BACKUP_KEEP_DAYS) { [int]$env:BACKUP_KEEP_DAYS } else { 14 }
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# Locate mongodump.exe (ships with MongoDB Community Server)
$MongoBin = if ($env:MONGOD_EXE) { Split-Path -Parent $env:MONGOD_EXE } else { 'C:\Program Files\MongoDB\Server\7.0\bin' }
$MongoDump = Join-Path $MongoBin 'mongodump.exe'
if (-not (Test-Path -LiteralPath $MongoDump)) {
  $cmd = Get-Command mongodump -ErrorAction SilentlyContinue
  if ($cmd) { $MongoDump = $cmd.Source } else { Write-Error "mongodump.exe not found. Set `$env:MONGOD_EXE or add MongoDB bin to PATH." }
}

Write-Host "=== College backup -> $BackupDir ===" -ForegroundColor Cyan

# 1. Database archive (while MongoDB is running)
$dbArchive = Join-Path $BackupDir "interviewapp-$Stamp.gz"
& $MongoDump --db interviewapp --archive=$dbArchive --gzip
if ($LASTEXITCODE -ne 0) { Write-Error "mongodump failed (exit $LASTEXITCODE). Is MongoDB running?" }
Write-Host ("  database archive: {0}  ({1:N0} bytes)" -f (Split-Path -Leaf $dbArchive), (Get-Item $dbArchive).Length) -ForegroundColor Green

# 2. Uploads (interview media / reference images still on disk)
$uploadsDir = Join-Path $Root 'backend\uploads'
if (Test-Path -LiteralPath $uploadsDir) {
  $uploadsZip = Join-Path $BackupDir "uploads-$Stamp.zip"
  Compress-Archive -Path (Join-Path $uploadsDir '*') -DestinationPath $uploadsZip -CompressionLevel Optimal
  Write-Host ("  uploads archive:   {0}  ({1:N0} bytes)" -f (Split-Path -Leaf $uploadsZip), (Get-Item $uploadsZip).Length) -ForegroundColor Green
} else {
  Write-Host '  uploads directory not found - skipping.' -ForegroundColor Yellow
}

# 3. Prune old backups
$cutoff = (Get-Date).AddDays(-$KeepDays)
$removed = 0
Get-ChildItem -LiteralPath $BackupDir -File | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Force
  $removed++
}
Write-Host "Pruned $removed backup(s) older than $KeepDays day(s)." -ForegroundColor Gray
Write-Host '=== Backup complete ===' -ForegroundColor Green
