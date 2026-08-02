# Incident Response Plan

## 1. Objectives
Contain, eradicate, and recover from security incidents while preserving evidence and minimizing confidentiality/integrity/availability impact to member organizations' data.

## 2. Roles
- **Incident Commander (IC)**: System Administrator on call; makes containment decisions.
- **Technical Lead**: investigates root cause, implements fixes.
- **Communications Lead**: notifies affected Organization Administrators (in-app + out-of-band channel, since email/SMS are not used by the platform — a pre-agreed out-of-band contact method must exist per org for this exact scenario).

## 3. Severity Classification
| Level | Definition | Example |
|---|---|---|
| SEV-1 Critical | Active data breach or full compromise | DB exfiltration, root secret leaked |
| SEV-2 High | Confirmed vulnerability exploited, contained | Single account takeover via credential stuffing |
| SEV-3 Medium | Vulnerability found, not confirmed exploited | Pentest finding pre-exploitation |
| SEV-4 Low | Minor policy violation, no data exposure | Misconfigured header |

## 4. Phases

### 4.1 Detection & Triage
- Sources: `security_events` alert thresholds, proxy/app anomaly logs, admin report, pentest finding.
- Triage within: SEV-1 ≤ 15 min, SEV-2 ≤ 1 hr, SEV-3 ≤ 1 business day.

### 4.2 Containment
- Short-term: revoke affected sessions/devices (`DELETE /admin/sessions/{id}`), disable affected accounts, rotate implicated secrets, isolate affected container (stop/replace, don't just patch live).
- Do not destroy evidence: snapshot logs and affected DB rows before remediation where feasible.

### 4.3 Eradication
- Patch root cause, deploy through normal CI/CD (no ad hoc unreviewed hotfix to prod), re-run security test suite.

### 4.4 Recovery
- Restore from clean backup only if integrity of live data is in doubt (see DR plan).
- Force password reset + MFA re-enrollment for all impacted accounts.
- Rotate: JWT signing keys, root encryption secret (if suspected exposed), DB credentials.

### 4.5 Post-Incident Review
- Blameless retrospective within 5 business days of SEV-1/2 closure.
- Timeline, root cause, what worked, what didn't, action items with owners.
- Update threat model / this plan if a gap is found.

## 5. Notification
- Affected Organization Administrators notified via in-app banner (if platform still trustworthy) **and** pre-registered out-of-band contact (phone/alternate channel) for SEV-1/2, since the platform intentionally has no email integration.
- Notification content: what happened, what data may be affected, what was done, what the org should do (e.g., rotate their users' passwords).
- Legal/regulatory notification obligations (breach notification laws) are the deploying organization's responsibility — this plan provides the technical timeline/evidence they need to meet those obligations; it does not itself constitute legal advice.

## 6. Evidence Handling
- Preserve: `security_events` rows, proxy access logs, container logs, relevant DB snapshots — copied to a separate, access-controlled location, checksummed, timestamped.
- Chain of custody log for anything that may support later legal action.

## 7. Runbook Quick Reference
```
Suspected account takeover:
  1. DELETE all sessions for user (admin API)
  2. Revoke all devices for user
  3. Force password reset + MFA re-enrollment
  4. Review security_events for that user for lateral actions taken
  5. Notify org admin

Suspected server compromise:
  1. Isolate host (firewall/network cutoff) while preserving disk state
  2. Rotate all secrets (JWT key, root encryption key, DB creds)
  3. Rebuild from known-clean image + restore data from last verified-clean backup
  4. Full security_events + access log review for scope of compromise
  5. Notify all org admins, prepare disclosure per severity

Suspected data leak (document/message exposure):
  1. Identify scope via document_versions/messages access logs
  2. Invalidate any outstanding signed download tokens (rotate signing secret)
  3. Determine affected orgs/projects, notify per Section 5
```
