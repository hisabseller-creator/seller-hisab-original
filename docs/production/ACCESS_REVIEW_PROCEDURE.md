# Access Review Procedure

## Purpose

This procedure defines how SellerHisab reviews and validates privileged access to production systems, source code, marketplace credentials and seller data. It supports the security-governance cadence and Amazon SP-API re-application evidence.

## Scope and cadence

Complete a review every quarter and after any SEV-1/SEV-2 incident or material privileged-access change. Repository presence of this procedure is not proof that a review was completed; signed evidence must be retained outside the public repository.

## 1. SellerHisab platform admin identities

Review `ADMIN_EMAILS` and `ADMIN_PHONES` in the production environment without copying secret/config values into public evidence.

For every allowlisted identity:

- confirm the person still requires platform-admin access;
- verify the identity belongs to the intended operator;
- verify admin TOTP MFA is enrolled after the remediation control is deployed;
- verify recovery codes are held only by the authorized operator in approved secure storage;
- review recent admin/auth audit events and active sessions for anomalies;
- verify the admin password is not expired and that no unresolved lockout/security event exists;
- remove identities that no longer need access and revoke their sessions.

Production must not depend on the local-development admin fallback.

## 2. GitHub access

Review:

- repository collaborators and teams;
- minimum required permission for each person;
- privileged GitHub account MFA;
- branch/review protections actually configured for `main`;
- GitHub Actions secrets/variables and installed apps for unnecessary production access;
- stale tokens, apps or collaborators.

Do not infer branch protection or account MFA from repository files; verify them in GitHub and retain dated evidence.

## 3. Cloudflare access and network controls

Review:

- Cloudflare account members and roles;
- privileged account MFA;
- API tokens and least-privilege scopes;
- Worker custom domains/routes and production bindings;
- D1/R2/Queues access boundaries;
- WAF/firewall rules and managed security controls;
- threat-detection/IDS-equivalent monitoring relied upon by SellerHisab and alert ownership;
- unnecessary/stale credentials or dashboard access.

Follow `NETWORK_SECURITY_RESPONSIBILITY.md`. Repository code cannot prove these dashboard settings.

## 4. Production secret inventory

Review the existence, ownership and rotation state — never the plaintext value — of required production secrets, including:

- `SESSION_SECRET`
- `ENTITLEMENT_SECRET`
- `CONNECTOR_ENCRYPTION_KEY` / `CONNECTOR_ENCRYPTION_KEY_V2`
- Razorpay credentials/webhook secret
- MSG91 credentials
- Amazon LWA/SP-API credentials
- Shopify/Flipkart credentials where active
- AWS credentials where still required

Any suspected exposure triggers immediate rotation/revocation and `INCIDENT_RESPONSE.md`.

## 5. Amazon / marketplace access

For Amazon specifically:

- verify Developer Profile/application status;
- verify requested roles/scopes match SellerHisab's current read-only reporting/reconciliation purpose;
- remove unused roles/scopes;
- verify privileged Amazon Developer/Seller Central accounts use MFA;
- review active seller connections and investigate stale/unknown connections;
- verify connector encryption key version/rotation state;
- verify no raw Amazon credential is exposed in UI, logs, source or evidence records.

Apply equivalent least-privilege checks to other connected marketplaces/providers.

## 6. Inactive accounts and unnecessary privileges

Review:

- privileged identities with no legitimate recent use;
- active sessions for departed/unapproved operators;
- workspace owner/admin memberships that are no longer required;
- stale marketplace connections;
- expired OAuth state/session/rate-limit cleanup behavior;
- orphaned or anomalous tenant ownership/access relationships.

Do not automatically delete financial/business records solely because an account appears inactive; follow approved retention and account-lifecycle rules.

## 7. Privileged endpoint security

For each workstation/device used for production administration or SellerHisab/Amazon privileged access, verify externally:

- supported OS and patching;
- active anti-malware/endpoint protection;
- local firewall;
- disk encryption where supported;
- strong device authentication/screen lock;
- no unnecessary shared/local-admin privilege;
- browser/provider account MFA.

Retain dated evidence in restricted operational storage; this cannot be proven from GitHub.

## 8. Review record and sign-off

Use a record equivalent to:

```
Review ID:                AR-YYYY-Q#
Review date:              YYYY-MM-DD
Reviewer:                 [name / role]
Approver:                 [Security Owner name / role]
SellerHisab admins:       [reviewed / findings]
Admin MFA enrollment:     [reviewed / findings]
GitHub access:            [reviewed / findings]
Cloudflare access/WAF:    [reviewed / findings]
Amazon access/scopes/MFA: [reviewed / findings]
Endpoint protection:      [reviewed / findings]
Marketplace connections:  [reviewed / findings]
Secrets inventory:        [reviewed / findings]
Changes made:             [summary or None]
Open findings:            [owner + due date]
Incidents since review:   [summary or None]
Next review due:          YYYY-MM-DD
Reviewer approval:        [recorded]
Security Owner approval:  [recorded]
Restricted evidence ref:  [location / record ID]
```

Retain signed access-review evidence outside the public repository for the approved record-retention period; the current governance template calls for at least 24 months for access-review records.

## Escalation

- Unknown privileged identity/member -> treat as a security incident, revoke/gate access and follow `INCIDENT_RESPONSE.md`.
- Suspected secret/token exposure -> rotate/revoke immediately and assess incident scope.
- Amazon credential/data exposure or suspected Amazon Information Security Incident -> start the `security@amazon.com` 24-hour notification workflow from identification time.
- Excess marketplace scope -> remove/reduce it, re-test required connector behavior and record the change.
- Missing MFA/endpoint/network evidence -> mark the Amazon control **EXTERNAL VERIFICATION REQUIRED** rather than claiming PASS.

## References

- `SECURITY_GOVERNANCE_POLICY.md`
- `INCIDENT_RESPONSE.md`
- `AMAZON_DATA_HANDLING_POLICY.md`
- `NETWORK_SECURITY_RESPONSIBILITY.md`
- `SECURITY_TRAINING_AND_REVIEW_EVIDENCE.md`
- `AMAZON_REAPPLICATION_CHECKLIST.md`
