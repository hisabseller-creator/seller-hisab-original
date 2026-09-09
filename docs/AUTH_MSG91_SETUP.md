# SellerHisab — MSG91 Widget setup

SellerHisab uses password login and mobile OTP only for registration and password reset. The web UI uses MSG91 OTP Widget Custom UI; the server validates the verified access token before creating/resetting an account.

## MSG91 Widget

Create an **OTP Widget** in MSG91 with mobile number as the contact point and SMS as the primary channel. Keep the OTP length aligned with the website UI (currently 6 digits). For the ordinary SMS OTP flow, keep Invisible OTP off unless you intentionally want network-based verification. If Captcha Validation is enabled, the website provides a captcha render container.

Copy these values from the widget/integration screen:

- MSG91 Auth Key (server-side)
- Widget ID
- Widget Token Auth

Do not use `MSG91_TEMPLATE_ID` for this Widget integration.

## Cloudflare secrets

```powershell
pnpm exec wrangler secret put MSG91_AUTH_KEY
pnpm exec wrangler secret put MSG91_WIDGET_ID
pnpm exec wrangler secret put MSG91_WIDGET_TOKEN
```

Or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-auth.ps1
```

The browser receives Widget ID and Widget Token Auth because the MSG91 Web SDK requires them. `MSG91_AUTH_KEY` remains server-side and is used to validate the access token after successful OTP verification.

## Test and deploy

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm deploy
```

The intended account flow is:

- Register: name → city → mobile → optional email → password → terms → mobile OTP → account created.
- Login: mobile/email + password.
- Forgot password: registered mobile → new password → mobile OTP → password updated.

Legacy email-OTP and direct SendOTP routes are removed from the production source.
