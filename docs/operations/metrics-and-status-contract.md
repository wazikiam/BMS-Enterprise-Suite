\# BMS Enterprise Suite — Metrics \& Status Contract (Authoritative)



\## 1. Purpose



This document defines the authoritative metrics and status signals

exposed to operators for BMS Enterprise Suite.



It enables observability without exposing business data.



This document is normative.



---



\## 2. Core Principles



\- Metrics are operational, not financial

\- No customer, ledger, or snapshot payloads are exposed

\- Read-only access only

\- Signals must reflect reality



---



\## 3. Mandatory Metrics



The system MUST expose the following metrics:



\### 3.1 Process Metrics

\- Uptime seconds

\- Node version

\- Process memory usage

\- Event loop lag (if available)



---



\### 3.2 Request Metrics

\- Total requests (by route group)

\- Error counts (4xx, 5xx)

\- Average response time



No request payloads may be exposed.



---



\### 3.3 Snapshot Metrics

\- Runtime snapshot store status (present / empty)

\- Count of runtime snapshots

\- Vault connectivity status



Important:

\- Missing runtime snapshots are not an error

\- Vault unavailability must be explicit



---



\## 4. Status Signals



The system MUST expose:



\- Overall mode: LIVE / DEGRADED / UNSAFE

\- Reasons for degradation

\- Last configuration load time



---



\## 5. Forbidden Metrics



The system MUST NOT expose:

\- Financial values

\- Customer identifiers

\- Snapshot payload content

\- Secrets or credentials



---



\## 6. Access Rules



\- Metrics endpoint is read-only

\- Protected by identity and role (OPERATOR or ADMIN)

\- No anonymous access in production



---



\## 7. Final Statement



Operators must see the truth of system health

without seeing the business itself.



End of document.



