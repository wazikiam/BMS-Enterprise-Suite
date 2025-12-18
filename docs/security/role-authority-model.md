\# BMS Enterprise Suite — Role \& Authority Model (Authoritative)



\## 1. Purpose



This document defines the authoritative role and authority model for BMS Enterprise Suite.



It answers:

\- Who may perform which actions

\- Which actions are mutually exclusive

\- How authority is proven and enforced

\- What happens when identity or authority is missing



This document is normative. Code must conform to it.



---



\## 2. Identity Contract (Mandatory)



Every request reaching protected server endpoints MUST have an injected actor object:



req.actor = {

id: string,

displayName?: string,

roles: string\[]

}



\### Hard rules

\- If `req.actor` is missing → \*\*403 Forbidden\*\*

\- If `roles` is missing or not an array → \*\*403 Forbidden\*\*

\- The server must never infer or guess identity

\- Anonymous authority is forbidden



Identity injection is the responsibility of authentication middleware and is outside the scope of this document.



---



\## 3. System Roles (Frozen)



\### 3.1 SNAPSHOT\_VAULT\_WRITER

\*\*Authority:\*\*

\- Store sealed snapshot payloads into the Audit Vault



\*\*Explicitly forbidden:\*\*

\- Restore payloads

\- Apply payloads to runtime

\- Modify governance metadata



---



\### 3.2 SNAPSHOT\_VAULT\_RESTORER

\*\*Authority:\*\*

\- Restore sealed snapshots from the Audit Vault

\- Apply restored snapshots into runtime



\*\*Explicitly forbidden:\*\*

\- Write sealed payloads to the vault

\- Modify governance metadata



---



\### 3.3 SNAPSHOT\_VAULT\_AUDITOR

\*\*Authority:\*\*

\- Query vault status

\- Inspect audit posture (presence, metadata)

\- Use read-only CLI commands



\*\*Explicitly forbidden:\*\*

\- Store payloads

\- Restore payloads

\- Apply payloads



---



\### 3.4 SYSTEM\_OPERATOR

\*\*Authority:\*\*

\- Perform operational checks

\- Restart services

\- Inspect logs and metrics



\*\*Explicitly forbidden:\*\*

\- Alter audit payloads

\- Bypass role checks

\- Modify governance metadata



---



\### 3.5 SYSTEM\_ADMIN

\*\*Authority:\*\*

\- Assign roles

\- Configure infrastructure

\- Grant or revoke operator access



\*\*Explicitly forbidden:\*\*

\- Silent alteration of audit records

\- Direct manipulation of vault contents



---



\## 4. Separation of Duties Rules



The system enforces separation of duties through role design.



\### Mandatory constraints

\- Writing to the vault (`SNAPSHOT\_VAULT\_WRITER`) is separated from restoring/applying (`SNAPSHOT\_VAULT\_RESTORER`)

\- Runtime activation is never implicit

\- Governance approval is not a server-side responsibility



\### Allowed overlaps

\- An actor MAY hold multiple roles, but actions are always logged with actor identity

\- Overlaps are a governance decision, not a technical shortcut



---



\## 5. Authority Enforcement Principles



\- Authority is checked at \*\*every protected endpoint\*\*

\- Authority is explicit and role-based

\- Missing authority fails closed (403)

\- No endpoint escalates privileges



There is no “admin bypass” in runtime logic.



---



\## 6. Auditability and Accountability



For every high-risk action:

\- Actor identity must be present

\- Roles must be listed

\- A human reason must be provided

\- Action must be logged append-only



This ensures post-hoc accountability.



---



\## 7. Forbidden Patterns (System-Wide)



The following are forbidden across the system:

\- Implicit trust based on network location

\- Role inference from request context

\- Silent fallback when authority is missing

\- “Temporary” bypasses for convenience



---



\## 8. Compliance Statement



This role model supports:

\- Principle of least privilege

\- Separation of duties

\- Explicit accountability

\- Deterministic enforcement



It is suitable for regulated financial systems.



---



\## 9. Final Statement



If an action cannot be attributed to an identified role, it must not occur.



Authority is explicit, or it does not exist.



End of document.



