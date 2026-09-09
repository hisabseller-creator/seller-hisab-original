$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "SellerHisab AWS S3 blog media setup" -ForegroundColor Cyan
Write-Host "Create the bucket and least-privilege IAM user in AWS first. Do not paste credentials into chat." -ForegroundColor Yellow

$region = Read-Host "AWS region (example: ap-south-1)"
$bucket = Read-Host "S3 bucket name"
$access = Read-Host "AWS access key ID"
$secretSecure = Read-Host "AWS secret access key" -AsSecureString
$secret = [System.Net.NetworkCredential]::new("", $secretSecure).Password

if ([string]::IsNullOrWhiteSpace($region) -or [string]::IsNullOrWhiteSpace($bucket) -or [string]::IsNullOrWhiteSpace($access) -or [string]::IsNullOrWhiteSpace($secret)) {
  throw "All S3 values are required."
}

$region | pnpm exec wrangler secret put AWS_S3_REGION
$bucket | pnpm exec wrangler secret put AWS_S3_BUCKET
$access | pnpm exec wrangler secret put AWS_ACCESS_KEY_ID
$secret | pnpm exec wrangler secret put AWS_SECRET_ACCESS_KEY
$secret = $null

Write-Host "AWS S3 Worker secrets uploaded." -ForegroundColor Green
