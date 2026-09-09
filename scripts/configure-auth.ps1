$ErrorActionPreference = "Stop"

Write-Host "SellerHisab authentication setup" -ForegroundColor Cyan
Write-Host "Secrets are sent directly to Cloudflare Wrangler and are not written to project files." -ForegroundColor DarkGray

$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($bytes)
} finally {
  $rng.Dispose()
}
$sessionSecret = [Convert]::ToBase64String($bytes)
$sessionSecret | pnpm exec wrangler secret put SESSION_SECRET
Write-Host "SESSION_SECRET configured." -ForegroundColor Green

$msg91AuthKey = Read-Host "Enter MSG91 Auth Key (press Enter to configure later)"
if (-not [string]::IsNullOrWhiteSpace($msg91AuthKey)) {
  $msg91AuthKey | pnpm exec wrangler secret put MSG91_AUTH_KEY

  $widgetId = Read-Host "Enter MSG91 OTP Widget ID"
  if ([string]::IsNullOrWhiteSpace($widgetId)) { throw "Widget ID is required when MSG91 is configured." }
  $widgetId | pnpm exec wrangler secret put MSG91_WIDGET_ID

  $widgetToken = Read-Host "Enter MSG91 Widget Token Auth"
  if ([string]::IsNullOrWhiteSpace($widgetToken)) { throw "Widget Token Auth is required when MSG91 is configured." }
  $widgetToken | pnpm exec wrangler secret put MSG91_WIDGET_TOKEN

  Write-Host "MSG91 Widget authentication secrets configured." -ForegroundColor Green
} else {
  Write-Host "MSG91 skipped for now. Mobile OTP stays disabled until MSG91_AUTH_KEY, MSG91_WIDGET_ID and MSG91_WIDGET_TOKEN are configured." -ForegroundColor Yellow
}

$adminPhone = Read-Host "Admin mobile in 91XXXXXXXXXX format (optional; press Enter to skip)"
if (-not [string]::IsNullOrWhiteSpace($adminPhone)) {
  ($adminPhone -replace '\D','') | pnpm exec wrangler secret put ADMIN_PHONES
  Write-Host "ADMIN_PHONES configured." -ForegroundColor Green
}

Write-Host ""
Write-Host "Next: pnpm db:remote ; pnpm typecheck ; pnpm lint ; pnpm test ; pnpm build ; pnpm deploy" -ForegroundColor Yellow
