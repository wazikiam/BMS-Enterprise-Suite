\# BMS Enterprise Suite — Snapshot Governance \& Vault Runbook



\## 1. Scope and Authority



This runbook governs operational handling of Reporting Snapshots, the Audit Vault, and the explicit restore/apply workflow.



This system is designed for bank-grade correctness:

\- Governance decisions must survive restarts.

\- Runtime payload may be absent and is not authoritative.

\- Approved snapshots may exist without runtime payload.

\- No silent restoration is permitted.



This runbook is authoritative for production operations.



---



\## 2. Definitions



\### Snapshot

A point-in-time reporting artifact identified by `snapshotId` with a runtime `payload`.



\### Governance (UI-owned)

Sealing, verification, and approval (4-eyes) are governed by the UI workflow and stored locally as governance metadata.



\### Sealed Hash

A cryptographic digest of the canonical snapshot payload used to bind an immutable approval state to a concrete payload.



\### Audit Vault (authoritative for audit payloads)

A content-addressed, immutable archive store keyed by `sealedHash`.

\- Write-once per `sealedHash`.

\- Append-only event log for restore/apply actions.

\- Vault does not imply runtime availability.



\### Runtime Snapshot Store (non-authoritative)

An operational cache enabling runtime viewing.

\- May be in-memory and cleared on restart.

\- Absence is not an error; it is an expected state.



---



\## 3. Non-Negotiable Rules



1\. Never fake data if backend returns 404.

2\. Never auto-restore approved snapshots silently.

3\. Governance decisions survive restarts; runtime data may not.

4\. Always prefer correctness over convenience.

5\. Approved snapshot may exist WITHOUT runtime payload; this is correct.

6\. Restore and Apply are explicit, permissioned actions.

7\. All vault write operations must pass server-side integrity checks.

8\. No payload may be returned by operational “status” endpoints.



---



\## 4. Roles and Access Control



\### SNAPSHOT\_VAULT\_WRITER

Required to store sealed payload bundles in the Audit Vault.



\### SNAPSHOT\_VAULT\_RESTORER

Required to restore/apply from vault into runtime.



\### SNAPSHOT\_VAULT\_AUDITOR

Allowed to query vault status and review audit posture.



If actor identity is missing, the server must deny (403).



---



\## 5. System Endpoints (Operational)



\### 5.1 Vault Status (read-only, metadata only)

`GET /vault/status?sealedHash=<hash>` or `GET /vault/status?snapshotId=<id>`



Returns:

\- Whether vault bundle exists

\- Whether runtime payload exists

\- Metadata only (no payload)



This endpoint is safe for operations and audit posture checks.



\### 5.2 Vault Store (explicit)

`POST /vault/store`



Purpose:

\- Store sealed snapshot payload in vault after UI governance sealing.



Requirements:

\- Role: SNAPSHOT\_VAULT\_WRITER

\- Server-side hash verification enforced

\- Write-once semantics (immutable)



Forbidden:

\- Calling this endpoint before sealing

\- Using it to overwrite or alter an existing sealed hash



\### 5.3 Vault Restore (explicit, non-activating)

`POST /vault/restore`



Purpose:

\- Logs restore intent; may fetch bundle; does not activate runtime payload.



Requirements:

\- Role: SNAPSHOT\_VAULT\_RESTORER

\- Reason required

\- Logs event: action=RESTORE



\### 5.4 Vault Apply (explicit activation)

`POST /vault/apply`



Purpose:

\- Applies vault payload into runtime store for viewing.



Requirements:

\- Role: SNAPSHOT\_VAULT\_RESTORER

\- Reason required

\- Logs event: action=APPLY



---



\## 6. Canonical Operational Flows



\### 6.1 Normal approved snapshot lifecycle

1\. Generate snapshot payload (runtime).

2\. UI performs seal + verify + 4-eyes approval (governance metadata stored locally).

3\. UI calls `/vault/store` with payload + sealedHash (explicit persistence).

4\. Runtime viewing is available while runtime cache exists.

5\. If runtime cache is lost (restart), approved snapshot remains approved but may 404 for payload until apply.



\### 6.2 Restart scenario (expected)

\- Governance remains.

\- Runtime payload may be missing.

\- System must show 404 for payload access, and UI must show “No approved snapshot available” where appropriate.

\- Operator may optionally restore/apply if needed for runtime viewing.



\### 6.3 Explicit recovery to view an approved snapshot (authorized)

1\. Check posture:

&nbsp;  - `GET /vault/status?sealedHash=...`

2\. Restore intent:

&nbsp;  - `POST /vault/restore` with sealedHash + reason

3\. Apply:

&nbsp;  - `POST /vault/apply` with sealedHash + reason

4\. Confirm runtime:

&nbsp;  - `GET /vault/status?snapshotId=...`



---



\## 7. Failure Handling



\### 7.1 404 — Snapshot payload missing at runtime

This is not necessarily an incident.

\- Do NOT fabricate payload.

\- Do NOT silently repair.

\- Confirm vault availability.

\- If vault contains bundle, follow explicit restore/apply procedure if runtime viewing is required.



\### 7.2 409 — sealedHash mismatch

This is a critical integrity failure.

\- Treat as a security/control breach or a serialization mismatch.

\- Do not store payload.

\- Escalate to engineering: investigate canonical JSON serialization and sealing logic.

\- Confirm UI and backend hash algorithms match exactly.



\### 7.3 Vault IO failures

If vault is unreachable:

\- Sealed payload cannot be persisted.

\- Do not claim audit persistence.

\- Escalate as operational incident if approvals are being performed.



---



\## 8. CLI (Read-only)



The server includes a read-only CLI for vault inspection:



\- `vault status <sealedHash>`

\- `vault verify <sealedHash>`

\- `vault events`



The CLI is diagnostic only. No restore/apply is permitted via CLI.



---



\## 9. Explicitly Forbidden Actions



\- Any automatic restore on server startup.

\- Any silent fallback from vault to runtime without explicit operator action.

\- Any “best effort” payload reconstruction if missing.

\- Any downgrade of approved/audit artifacts into non-audit runtime artifacts.

\- Returning snapshot payload from status endpoints.



---



\## 10. Audit Expectations



For any production restore/apply:

\- Must have a human reason.

\- Must have actor identity + roles.

\- Must emit append-only event log entries.

\- Must keep vault bundles immutable and content-addressed.



End of runbook.



