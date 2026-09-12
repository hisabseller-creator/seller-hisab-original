# Amazon SP-API Re-application Checklist

## Purpose

This checklist maps the four previously rejected security areas to evidence that must exist before SellerHisab submits a new Amazon Developer Profile/security case.

A `PASS` must be supported by real code/configuration plus, where applicable, dated operational evidence. Do not answer `Yes` to Amazon merely because a policy document exists.

## 1. Incident response and 24-hour Amazon notification

**Repository/source status: PASS (process defined).**

Evidence in source:

- `INCIDENT_RESPONSE.md` defines severity, ownership, containment, evidence preservation and Amazon-specific response.
- Amazon Information Security Incidents involving confirmed or suspected Amazon data/credential exposure must be reported to `security@amazon.com` within 24 hours of identification.
- `AMAZON_DATA_HANDLING_POLICY.md` defines Amazon data categories and incident actions.

Still required before re-application:

- [ ] Named Security Owner / incident commander and backups assigned.
- [ ] Current contact/escalation records retained outside the repository.
- [ ] Incident-response plan reviewed and signed within the last 6 months.
- [ ] Tabletop/drill evidence completed and findings closed or tracked.

Until those operational records exist: **PARTIAL overall / external evidence pending**.

## 2. Firewall, IDS/IPS-equivalent monitoring, anti-malware and segmentation

**Repository/source status: PARTIAL.**

Repository proves application-layer security boundaries such as same-origin mutation checks, sensitive-route throttling, HTTP security headers, tenant scoping, encrypted connector secrets and source-secret scanning.

Repository does not prove Cloudflare dashboard settings or workstation security.

Required external evidence:

- [ ] Cloudflare WAF/firewall rules reviewed and retained.
- [ ] Provider threat-detection / IDS/IPS-equivalent controls relied upon by SellerHisab verified and alert ownership documented.
- [ ] Production service/binding boundaries and least privilege reviewed.
- [ ] Cloudflare privileged members use MFA and only required roles/tokens.
- [ ] Privileged operator/developer endpoints have active anti-malware, firewall, patching and disk encryption.
- [ ] GitHub/Amazon privileged accounts use MFA.

See `NETWORK_SECURITY_RESPONSIBILITY.md`.

Until real evidence is collected: **EXTERNAL VERIFICATION REQUIRED**; do not answer `Yes` solely from repository evidence.

## 3. Password controls, lockout and MFA

**Remediation source status: IMPLEMENTED, pending validation/deployment.**

The remediation branch implements:

- admin password minimum 12 characters with uppercase, lowercase, number and symbol;
- 1-day minimum password age;
- 365-day maximum password age;
- current password plus last 10 prior password hashes blocked from reuse after the control is activated;
- durable account lockout after 10 consecutive password failures, in addition to existing IP/identity rate limits;
- RFC 6238 TOTP for privileged admin access;
- encrypted-at-rest TOTP secret;
- hashed, single-use recovery codes;
- TOTP replay prevention;
- privileged step-up bound to current session, credential and security version with a 15-minute maximum lifetime;
- privileged proof invalidation after password/MFA security-version changes;
- MFA confirmation required for admin password changes when MFA is already enabled.

Important limitations:

- Password history cannot reconstruct passwords used before this control existed. History becomes authoritative from activation forward.
- Historical retired v2/600k hashes cannot be evaluated in the Cloudflare Workers runtime; those accounts use verified OTP reset into the supported current format.
- The source implementation is not a production control until migration `0024_admin_security_controls.sql` is reviewed/applied, code is deployed and each privileged admin completes MFA enrollment.

Required before Amazon re-application:

- [ ] Full CI/security/schema/build validation green on the remediation head.
- [ ] Reviewed merge/release approved.
- [ ] Migration 0024 applied successfully to production through the approved procedure.
- [ ] Production deployment verified.
- [ ] Every active privileged admin enrolled in MFA and recovery codes stored safely.
- [ ] Production test confirms privileged admin routes reject access without valid step-up.

## 4. Governance, roles, six-month reviews and access reviews

**Repository/source status: PASS for defined process; operational evidence pending.**

Source defines:

- Security Owner, Technical Lead and Operations Lead responsibilities;
- six-month security-governance and incident-response review cadence;
- quarterly access review;
- six-month security awareness training;
- quarterly tabletop drill;
- source-secret/dependency/CI change-management controls;
- explicit prohibition on claiming SOC 2 / ISO 27001 or unverified external controls.

Still required:

- [ ] Named people assigned to roles.
- [ ] Six-month security training record completed.
- [ ] Six-month incident-response review signed.
- [ ] Quarterly access review completed and signed.
- [ ] Cloudflare/GitHub/Amazon privileged-access evidence retained.
- [ ] Any findings have owners and due dates.

See `SECURITY_GOVERNANCE_POLICY.md`, `ACCESS_REVIEW_PROCEDURE.md` and `SECURITY_TRAINING_AND_REVIEW_EVIDENCE.md`.

## Release / submission gate

A new Amazon case should be submitted only when all of the following are true:

1. Repository CI/security/schema/build checks are green on the reviewed remediation revision.
2. Migration 0024 and the remediation code are deployed to production with explicit owner approval.
3. Privileged admin MFA enrollment and production behavior are verified.
4. Cloudflare/network/endpoint evidence is collected and reviewed.
5. Required governance/training/access-review records are signed and current.
6. Developer Profile answers are re-checked against actual evidence; no aspirational control is answered `Yes`.

**Current rule:** repository completion alone is not Amazon re-application readiness.
