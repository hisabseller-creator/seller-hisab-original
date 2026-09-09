$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$coreRequired = @(
  "SESSION_SECRET",
  "ENTITLEMENT_SECRET",
  "MSG91_AUTH_KEY",
  "MSG91_WIDGET_ID",
  "MSG91_WIDGET_TOKEN",
  "ADMIN_EMAILS"
)
$optionalAdmin = @("ADMIN_PHONES")
$blogMedia = @("AWS_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")
$razorpay = @("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_STARTER_PLAN_ID", "RAZORPAY_PRO_PLAN_ID")

$list = pnpm exec wrangler secret list --config wrangler.jsonc | ConvertFrom-Json
$names = @($list | ForEach-Object { $_.name })

function Show-SecretGroup($title, $group, $missingColor) {
  Write-Host "`n$title" -ForegroundColor Cyan
  foreach ($name in $group) {
    if ($names -contains $name) { Write-Host "[OK] $name" -ForegroundColor Green }
    else { Write-Host "[MISSING] $name" -ForegroundColor $missingColor }
  }
}

Show-SecretGroup "Core production secrets" $coreRequired "Red"
Show-SecretGroup "Optional admin-phone allowlist" $optionalAdmin "Yellow"
Show-SecretGroup "AWS blog-media secrets (required before image upload)" $blogMedia "Yellow"
Show-SecretGroup "Razorpay live secrets/IDs (required before paid checkout)" $razorpay "Yellow"

Write-Host "`nCurrent production routing" -ForegroundColor Cyan
Get-Content .\wrangler.jsonc | Select-String 'APP_ENV|sellerhisab.com|www.sellerhisab.com'

Write-Host "`nSource consistency" -ForegroundColor Cyan
pnpm prod:check

Write-Host "`nProduction runtime is already enabled. Keep paid checkout unavailable until Razorpay live verification is complete." -ForegroundColor Yellow
