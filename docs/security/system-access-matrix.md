\# BMS Enterprise Suite — System Access Matrix (Authoritative)



\## 1. Purpose



This document defines the authoritative mapping between system roles and protected server actions.



It answers, unambiguously:

\- Which role is required for which endpoint

\- Which roles are explicitly forbidden

\- Where authority boundaries are enforced



This document is normative.  

Runtime behavior MUST conform to it.



---



\## 2. Interpretation Rules



\- If an endpoint is not listed here, it MUST be treated as non-authoritative or internal.

\- If a role is not listed for an endpoint, it MUST NOT be permitted.

\- Absence of authority results in \*\*403 Forbidden\*\*.

\- No endpoint may infer authority from context.



---



\## 3. Role Legend



\- \*\*WRITER\*\* = SNAPSHOT\_VAULT\_WRITER  

\- \*\*RESTORER\*\* = SNAPSHOT\_VAULT\_RESTORER  

\- \*\*AUDITOR\*\* = SNAPSHOT\_VAULT\_AUDITOR  

\- \*\*OPERATOR\*\* = SYSTEM\_OPERATOR  

\- \*\*ADMIN\*\* = SYSTEM\_ADMIN  



ADMIN does NOT imply bypass unless explicitly stated (none are).



---



\## 4. Snapshot \& Vault Endpoints



| Endpoint | Method | Required Role(s) | Explicitly Forbidden |

|--------|--------|------------------|----------------------|

| `/snapshots` | POST | — | All vault roles |

| `/snapshots/:id` | GET | — | All vault roles |

| `/vault/store` | POST | WRITER | RESTORER, AUDITOR |

| `/vault/restore` | POST | RESTORER | WRITER, AUDITOR |

| `/vault/apply` | POST | RESTORER | WRITER, AUDITOR |

| `/vault/status` | GET | AUDITOR, RESTORER, WRITER | — |



Notes:

\- Snapshot generation and viewing do not require vault authority.

\- Vault write, restore, and apply are mutually controlled.



---



\## 5. CLI Commands (Read-Only)



| Command | Required Role(s) | Forbidden |

|-------|------------------|----------|

| `vault status` | AUDITOR, OPERATOR | WRITER, RESTORER |

| `vault verify` | AUDITOR | WRITER, RESTORER |

| `vault events` | AUDITOR | WRITER, RESTORER |



CLI commands are diagnostic only.  

No mutation is permitted.



---



\## 6. Administrative \& Operational Actions



| Action | Required Role | Forbidden |

|------|---------------|----------|

| Service restart | OPERATOR | WRITER, RESTORER |

| Role assignment | ADMIN | OPERATOR, AUDITOR |

| Vault file access | NONE (app-managed only) | ALL |



---



\## 7. Separation of Duties Enforcement



The following actions MUST NOT be performed by the same role implicitly:



\- Vault write vs vault restore/apply

\- Governance approval vs runtime activation

\- Audit inspection vs payload mutation



Overlapping roles MAY exist but are always logged with full actor identity.



---



\## 8. Forbidden Authority Escalation



The system explicitly forbids:



\- Admin implicit access to vault actions

\- Operator-triggered restore/apply

\- Auditor-triggered mutation

\- Network-based trust

\- Environment-based trust



Authority exists only where explicitly granted.



---



\## 9. Compliance Statement



This access matrix enforces:

\- Least privilege

\- Deterministic authorization

\- Clear accountability

\- Reviewable authority boundaries



It is suitable for regulated enterprise and financial systems.



---



\## 10. Final Statement



If an endpoint is not authorized here, it must not be accessible.



Authority is defined once, enforced everywhere.



End of document.



