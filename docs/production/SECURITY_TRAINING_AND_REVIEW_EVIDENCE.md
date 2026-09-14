# Security Training and Review Evidence

## Purpose

This is an evidence template for SellerHisab security governance. It defines the records that must exist outside the public repository before related Amazon SP-API controls are represented as completed.

**Template status:** NOT COMPLETED by repository code. Blank sections are intentional and must be completed by the responsible human reviewer using real evidence.

## 1. Security awareness training — every 6 months

Training record ID: `[SEC-TRAIN-YYYY-H#]`  
Training date: `[YYYY-MM-DD]`  
Facilitator / Security Owner: `[name/role]`  
Next due date: `[YYYY-MM-DD]`

Required topics:

- Amazon SP-API data handling and least-privilege access.
- Credential/token secrecy and approved secret-storage channels.
- Phishing/social-engineering awareness and privileged-account MFA.
- Secure coding, dependency/source-secret checks and review discipline.
- Incident identification, containment, evidence preservation and escalation.
- Amazon Information Security Incident notification to `security@amazon.com` within 24 hours of identification.
- Customer/seller privacy and prohibition on copying raw secrets or seller data into tickets, chat or public repositories.

Attendance record:

| Person / role | Attended | Completion evidence location | Follow-up required |
|---|---|---|---|
| `[name/role]` | `[yes/no]` | `[restricted record reference]` | `[none/action]` |

Reviewer sign-off: `[name/role/date]`

## 2. Incident response plan review — every 6 months

Review ID: `[IR-REVIEW-YYYY-H#]`  
Review date: `[YYYY-MM-DD]`  
Reviewer: `[name/role]`  
Approver: `[name/role]`

Checklist:

- [ ] Named incident commander and backups are current.
- [ ] Amazon `security@amazon.com` 24-hour notification requirement remains present and understood.
- [ ] Provider/support escalation contacts are current.
- [ ] Credential/key rotation procedures are still valid.
- [ ] Evidence/log preservation instructions remain valid.
- [ ] Changes in production architecture have been incorporated.
- [ ] Findings have owners and due dates.

Findings / changes: `[summary]`  
Restricted evidence reference: `[location/id]`  
Next review due: `[YYYY-MM-DD]`

## 3. Quarterly access review

Use `ACCESS_REVIEW_PROCEDURE.md` and retain a signed record outside the public repository.

Access review ID: `[AR-YYYY-Q#]`  
Date: `[YYYY-MM-DD]`  
Result: `[pass/findings]`  
Restricted evidence reference: `[location/id]`

The review must cover admin allowlists, active admin MFA enrollment, GitHub access, Cloudflare members/tokens, Amazon Solution Provider Portal / Developer Profile access, marketplace scopes/connections, privileged sessions and production secrets inventory.

## 4. Network / endpoint control evidence

Use `NETWORK_SECURITY_RESPONSIBILITY.md`.

Evidence record ID: `[NETSEC-YYYY-MM-DD]`

- [ ] Cloudflare WAF/firewall evidence captured.
- [ ] Threat-detection/IDS-equivalent provider controls relied upon by SellerHisab verified.
- [ ] Cloudflare account/member MFA and least-privilege access verified.
- [ ] Production binding/service boundary reviewed.
- [ ] Privileged endpoint anti-malware/firewall/patching/disk encryption verified.
- [ ] GitHub and Amazon privileged-account MFA verified.

Reviewer: `[name/role]`  
Evidence location: `[restricted location/id]`

## 5. Tabletop / incident drill — quarterly

Drill ID: `[TTX-YYYY-Q#]`  
Date: `[YYYY-MM-DD]`  
Scenario: `[admin compromise / Amazon token exposure / provider outage / other]`

Record:

- participants and roles;
- detection trigger;
- incident commander assignment;
- containment decision;
- Amazon notification decision and simulated 24-hour timeline when Amazon data is involved;
- credential/session rotation actions;
- recovery/reconciliation actions;
- gaps discovered;
- corrective actions, owner and due date.

Result: `[pass/findings]`  
Evidence location: `[restricted location/id]`

## 6. Evidence handling

- Store completed evidence in restricted operational storage, not this public/source repository.
- Do not record secret values, recovery codes, access tokens, seller data or customer PII in evidence templates.
- Retain signed security/access-review records according to the approved business retention policy; `ACCESS_REVIEW_PROCEDURE.md` currently calls for at least 24 months for access-review records.
- Repository presence of this template proves the process is defined; it does **not** prove training, reviews, drills, endpoint protection or provider controls were actually completed.
