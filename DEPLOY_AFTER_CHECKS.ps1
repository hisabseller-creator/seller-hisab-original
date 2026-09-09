# Run manually only after reviewing the release report and configuring providers.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& (Join-Path $PSScriptRoot 'VALIDATE_LOCAL.ps1')
function Invoke-Pnpm {
 param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
 & pnpm @Arguments
 if ($LASTEXITCODE -ne 0) { throw "Stopped: pnpm $($Arguments -join ' ')" }
}
Invoke-Pnpm exec wrangler whoami
# Stop if migration tracking is absent/inconsistent. Never rerun historical SQL.
$raw = & pnpm exec wrangler d1 execute DB --remote --config wrangler.jsonc --command 'SELECT name FROM d1_migrations ORDER BY name' --json
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify production migration ledger. No migration/deploy performed.' }
$parsed = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
$applied = @($parsed | ForEach-Object { $_.results } | ForEach-Object { $_.name })
$historical = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'drizzle') -Filter '*.sql' | Where-Object { [int]$_.Name.Substring(0,4) -le 18 } | ForEach-Object { $_.Name })
$missing = @($historical | Where-Object { $_ -notin $applied })
if ($missing.Count -gt 0) { throw "Historical migration ledger mismatch: $($missing -join ', '). Reconcile tracking with actual schema; DO NOT rerun these files." }
$allowed = @('0019_durable_execution.sql','0020_connector_coverage.sql','0021_blog_locale_metadata.sql','0022_connector_notifications.sql')
$local = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'drizzle') -Filter '*.sql' | ForEach-Object { $_.Name })
$unexpected = @($local | Where-Object { $_ -notin $applied -and $_ -notin $allowed })
if ($unexpected.Count -gt 0) { throw "Unexpected pending migration: $($unexpected -join ', ')" }
Invoke-Pnpm exec wrangler d1 migrations list DB --remote --config wrangler.jsonc
Write-Host 'Confirm four queues already exist and a current D1 recovery point is recorded.'
$confirmation = Read-Host 'Type DEPLOY to apply only pending forward migrations and deploy'
if ($confirmation -cne 'DEPLOY') { throw 'Deployment cancelled.' }
Invoke-Pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.jsonc
Invoke-Pnpm deploy
