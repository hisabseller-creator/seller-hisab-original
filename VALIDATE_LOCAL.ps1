$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  & pnpm @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Validation stopped: pnpm $($Arguments -join ' ')" }
}
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot '.playwright-browsers'
$env:WRANGLER_LOG_PATH = Join-Path $PSScriptRoot '.wrangler/logs'
$env:WRANGLER_WRITE_LOGS = 'false'
$env:VISUAL_REGRESSION = '1'
Invoke-Pnpm install --frozen-lockfile
Invoke-Pnpm repo:check
Invoke-Pnpm prod:check
Invoke-Pnpm seo:check
Invoke-Pnpm typecheck
Invoke-Pnpm lint
Invoke-Pnpm fixtures
Invoke-Pnpm test
Invoke-Pnpm schema:check
& node scripts/check-source-secrets.mjs
if ($LASTEXITCODE -ne 0) { throw 'Source credential scan failed.' }
& node scripts/test-password-runtime.mjs
if ($LASTEXITCODE -ne 0) { throw 'Workers password runtime check failed.' }
Invoke-Pnpm security:check
Invoke-Pnpm compat:check
Invoke-Pnpm exec playwright install chromium webkit
Invoke-Pnpm test:e2e --project chromium --project webkit
Invoke-Pnpm build
& node scripts/check-performance-budget.mjs
if ($LASTEXITCODE -ne 0) { throw 'Performance budget failed.' }
& node scripts/generate-sbom.mjs
if ($LASTEXITCODE -ne 0) { throw 'SBOM generation failed.' }
Write-Host 'Local gates passed. Remote migrations and deployment have NOT run.'
