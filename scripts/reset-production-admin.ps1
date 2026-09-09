$ErrorActionPreference = "Stop"

$project = Split-Path $PSScriptRoot -Parent
Set-Location $project

$adminEmail = "admin@sellerhisab.com"
$jsFile = Join-Path $env:TEMP ("sellerhisab-admin-credential-" + [Guid]::NewGuid().ToString("N") + ".js")
$sqlFile = Join-Path $env:TEMP ("sellerhisab-admin-reset-" + [Guid]::NewGuid().ToString("N") + ".sql")

Write-Host ""
Write-Host "SellerHisab production admin reset" -ForegroundColor Cyan
Write-Host "Admin ID: $adminEmail" -ForegroundColor Green
Write-Host "Generating a Cloudflare-production-compatible password hash locally..." -ForegroundColor Yellow

$js = @'
const crypto = require("node:crypto");

const password = crypto.randomBytes(24).toString("base64url") + "!9aA";
const salt = crypto.randomBytes(16);
const iterations = 100000;
const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");

process.stdout.write(JSON.stringify({
  password,
  hash: [
    "v3",
    "pbkdf2_sha256",
    String(iterations),
    salt.toString("base64url"),
    derived.toString("base64url")
  ].join("$")
}));
'@

[System.IO.File]::WriteAllText($jsFile, $js, [System.Text.UTF8Encoding]::new($false))

try {
  $pairJson = & node $jsFile
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pairJson)) {
    throw "Password generation failed."
  }

  $pair = $pairJson | ConvertFrom-Json
  $adminPassword = [string]$pair.password
  $passwordHash = [string]$pair.hash

  if ([string]::IsNullOrWhiteSpace($adminPassword) -or [string]::IsNullOrWhiteSpace($passwordHash)) {
    throw "Generated admin credential is empty."
  }

  if ($passwordHash -notlike "v3`$pbkdf2_sha256`$100000`$*") {
    throw "Generated admin hash does not use the Cloudflare-compatible v3/100000 PBKDF2 format."
  }

  $existing = pnpm exec wrangler d1 execute DB --remote --config wrangler.jsonc --command "SELECT COUNT(*) AS admin_count FROM users WHERE email='$adminEmail';" --json | Out-String
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect the remote admin row." }

  $userId = "usr_" + [Guid]::NewGuid().ToString("N").Substring(0,24)
  $now = [DateTime]::UtcNow.ToString("o")

  $sql = @"
INSERT INTO users (
  id,
  email,
  created_at,
  phone,
  password_hash,
  name,
  city,
  terms_accepted_at
)
VALUES (
  '$userId',
  '$adminEmail',
  '$now',
  NULL,
  '$passwordHash',
  'SellerHisab Admin',
  NULL,
  NULL
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = excluded.password_hash,
  name = excluded.name;

DELETE FROM sessions
WHERE user_id = (
  SELECT id
  FROM users
  WHERE email = '$adminEmail'
);
"@

  [System.IO.File]::WriteAllText($sqlFile, $sql, [System.Text.UTF8Encoding]::new($false))

  Write-Host "Writing the new admin hash to remote D1..." -ForegroundColor Cyan
  pnpm exec wrangler d1 execute DB --remote --config wrangler.jsonc --file $sqlFile
  if ($LASTEXITCODE -ne 0) { throw "Remote D1 admin reset failed." }

  Write-Host "Verifying the exact hash in remote D1..." -ForegroundColor Cyan
  $verifySql = "SELECT email, CASE WHEN password_hash='$passwordHash' THEN 1 ELSE 0 END AS password_reset_ok FROM users WHERE email='$adminEmail';"
  $verifyOutput = pnpm exec wrangler d1 execute DB --remote --config wrangler.jsonc --command $verifySql --json 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $verifyOutput -notmatch '"password_reset_ok"\s*:\s*1') {
    Write-Host $verifyOutput
    throw "Remote D1 password verification failed."
  }

  Write-Host "Updating Cloudflare ADMIN_EMAILS..." -ForegroundColor Cyan
  $adminEmail | pnpm exec wrangler secret put ADMIN_EMAILS --config wrangler.jsonc
  if ($LASTEXITCODE -ne 0) { throw "ADMIN_EMAILS update failed." }

  Set-Clipboard -Value $adminPassword

  Write-Host ""
  Write-Host "ADMIN RESET VERIFIED." -ForegroundColor Green
  Write-Host "Admin ID: $adminEmail" -ForegroundColor Cyan
  Write-Host "Password copied to clipboard." -ForegroundColor Cyan
}
finally {
  Remove-Item -LiteralPath $jsFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
  Remove-Variable adminPassword,passwordHash,pair,pairJson -ErrorAction SilentlyContinue
}
