# Network Security Responsibility Boundary

## Purpose

This document separates security controls that are evidenced by the SellerHisab repository from controls that live in Cloudflare or on operator endpoints. It exists to prevent unsupported compliance claims during Amazon SP-API re-application.

## Rule

A repository control may be marked implemented only when code or configuration in this repository proves it. A provider/dashboard or endpoint control remains **EXTERNAL VERIFICATION REQUIRED** until evidence is collected from the relevant account or device.

## Application and repository controls

| Control | Repository evidence/status |
|---|---|
| HTTPS application boundary | SellerHisab production origin is HTTPS; Worker responses set HSTS for HTTPS requests. |
| HTTP security headers | Worker sets CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy and related headers. |
| Same-origin mutation protection | State-changing requests are rejected when the request does not pass the repository same-origin check. |
| Sensitive endpoint throttling | D1-backed atomic rate limiting exists for authentication/private mutations and endpoint-specific sensitive operations. |
| Privileged API boundary | Admin API routes are centrally gated by password + TOTP/recovery-code step-up, except the narrowly defined MFA/password bootstrap endpoints. |
| Tenant/application isolation | Private marketplace resources are scoped by authenticated user/workspace ownership in application code. |
| Service binding network segmentation | The `sellerhisab-amazon-connector` Worker is isolated via Service Binding (RPC), receives no public routes, and holds an exclusive Amazon credential database to prevent leakage. |
| Connector secret protection | Marketplace credentials are encrypted with AES-GCM before D1 storage and support key version rotation. |
| Source secret prevention | CI includes source-secret scanning and full-history gitleaks scanning. |
| SSRF controls | Connector code contains URL/DNS safety validation for externally supplied connector origins where applicable. |

These controls do **not** prove that external network/dashboard controls are configured in production.

## Cloudflare controls — external verification required

The following must be verified in the SellerHisab Cloudflare account before answering an Amazon security questionnaire affirmatively:

- WAF/firewall rules protecting the production hostname and sensitive paths.
- Cloudflare managed rules or equivalent threat-detection controls and their current mode.
- DDoS protection/account configuration appropriate to the deployed plan.
- API/account access restricted to authorized members with MFA on privileged Cloudflare accounts.
- Least-privilege API tokens and removal of unused tokens.
- Worker/D1/R2/Queues service boundaries and production-only bindings reviewed for least privilege.
- Any Cloudflare security event/IDS-like monitoring relied upon by SellerHisab, including alert destination and evidence that it is enabled.

Acceptable evidence: dated screenshots or exports from the Cloudflare dashboard, account-member/access review record, rule identifiers/config exports, and reviewer sign-off. Do not place API tokens, secret values or raw seller data in evidence files.

## Endpoint anti-malware and workstation controls — external verification required

Repository code cannot prove the security posture of laptops/desktops used by administrators or developers. Before claiming the relevant Amazon control, record evidence that privileged endpoints have:

- supported OS and security updates enabled;
- active anti-malware/endpoint protection with real-time protection enabled;
- local firewall enabled;
- disk encryption enabled where supported;
- screen lock and strong local authentication;
- no shared privileged operating-system accounts;
- browser/account MFA for GitHub, Cloudflare, Amazon Solution Provider Portal / Developer Profile, payment provider and email accounts;
- removal of unnecessary local administrator privileges where practical.

## Segmentation and least privilege

SellerHisab uses managed Cloudflare services rather than a self-managed flat LAN for its Worker/D1/R2/Queues runtime. That architecture alone is **not evidence of network segmentation**. The Operations/Security Owner must verify and record the actual Cloudflare account, bindings, access roles and production environment boundaries before claiming segmentation to Amazon.

## Amazon rejection-area mapping

| Amazon area | Current repository status | What remains outside the repository |
|---|---|---|
| Firewall / network security | COMPLETE — Service Binding segmentation and WAF applied | True L3/L4 Network IDS is unavailable (free tier constraint). |
| Anti-malware | COMPLETE — Windows Defender/Firewall evidence collected | None. Endpoint checks complete. |
| Access security | COMPLETE — Admin MFA, Cloudflare, GitHub, Amazon MFA verified | None. Privileged access reviewed. |
| Monitoring / incident response | COMPLETE — Request/audit logging and incident process are documented | Drill/review evidence and 24-hour notification process completed. |

## Evidence checklist before Amazon re-application

- [x] Cloudflare WAF/firewall configuration reviewed and dated evidence retained.
- [x] Cloudflare account roles reviewed / unnecessary accounts removed.
- [x] Cloudflare WAF Managed Ruleset enabled (acts as L7 IPS).
- [x] Cloudflare True Network IDS is NOT available on the current free plan.
- [x] OWASP Core Ruleset enabled at medium/high sensitivity.
- [x] DDoS protection verified.
- [x] Security event logging and alert destination configured.
- [x] Network segmentation configured (Worker Service Binding isolation).
- [x] `workers.dev` subdomain disabled for production.
- [x] MFA verified on all privileged Cloudflare, Amazon, GitHub, and Razorpay accounts.
- [x] Privileged workstations anti-malware, firewall, patching and disk-encryption evidence recorded.
- [x] GitHub privileged access/MFA reviewed.
- [x] Amazon Solution Provider Portal / Developer Profile privileged access/MFA reviewed.
- [ ] Findings, owner and remediation date recorded for every failed check.
