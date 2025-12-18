\# BMS Enterprise Suite — Audit \& Runtime Signals (Authoritative)



\## 1. Purpose



This document defines the mandatory operational signals that MUST be observable

to ensure the system never fails silently.



Signals are visibility mechanisms, not automation triggers.



This document is normative.



---



\## 2. Design Principle



The system must prefer:

\- Explicit visibility over implicit repair

\- Honest failure over hidden recovery

\- Signals over automation



No signal defined here may mutate system state.



---



\## 3. Audit Vault Signals



\### 3.1 Vault Write Signal

Emitted when:

\- A sealed snapshot bundle is successfully stored



Includes:

\- snapshotId

\- sealedHash

\- actor.id

\- timestamp



Purpose:

\- Prove audit persistence occurred



---



\### 3.2 Vault Integrity Failure Signal

Emitted when:

\- sealedHash mismatch is detected

\- vault write is rejected



Severity: HIGH



Purpose:

\- Detect integrity violations immediately



---



\### 3.3 Vault Restore Intent Signal

Emitted when:

\- `/vault/restore` is called



Includes:

\- snapshotId

\- sealedHash

\- actor.id

\- reason



Purpose:

\- Track recovery intent



---



\### 3.4 Vault Apply Signal

Emitted when:

\- `/vault/apply` succeeds



Includes:

\- snapshotId

\- actor.id

\- runtime target



Purpose:

\- Track runtime activation of audit artifacts



---



\## 4. Runtime Snapshot Signals



\### 4.1 Runtime Missing Payload Signal

Emitted when:

\- Approved snapshot exists

\- Runtime payload is missing

\- API returns 404



Severity: LOW (expected condition)



Purpose:

\- Visibility into restart or cache loss

\- NOT an incident by itself



---



\### 4.2 Runtime Payload Loaded Signal

Emitted when:

\- Payload is successfully applied to runtime



Purpose:

\- Confirm viewing capability restored



---



\## 5. Forbidden Signals



The system MUST NOT emit signals that:

\- Trigger automatic restore

\- Trigger automatic apply

\- Attempt self-healing

\- Mask state loss



Signals are informational only.



---



\## 6. Consumption



Signals may be consumed by:

\- Logs

\- Metrics

\- Dashboards

\- SIEM systems



Signal consumption is outside the scope of this document.



---



\## 7. Compliance Statement



These signals ensure:

\- No silent audit failures

\- No silent runtime loss

\- Full operational transparency



They support regulated operational oversight.



---



\## 8. Final Statement



If the system is unhealthy, it must say so.

If the system is missing data, it must show it.



Silence is a failure.



End of document.



