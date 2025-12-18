\# BMS Enterprise Suite — Authority Injection \& Middleware Contract (Authoritative)



\## 1. Purpose



This document defines the mandatory contract for identity and authority injection

into server requests.



It specifies:

\- How `req.actor` must be populated

\- What guarantees middleware must provide

\- What the server may and may not assume

\- How failures must be handled



This document is normative. All protected endpoints must conform to it.



---



\## 2. Scope



This contract applies to:

\- All HTTP requests reaching protected server endpoints

\- All middleware responsible for authentication or identity resolution

\- All runtime environments (development, staging, production)



This document does NOT mandate:

\- An authentication provider

\- A token format

\- A login mechanism

\- An identity source (SSO, LDAP, OAuth, etc.)



It defines \*\*rules\*\*, not vendors.



---



\## 3. Mandatory Actor Object



For any request reaching a protected endpoint, the middleware MUST inject:



req.actor = {

id: string,

displayName?: string,

roles: string\[]

}





\### Field semantics



\- `id`

  - Stable, unique identifier for the actor

  - Must not be empty

  - Must be traceable in audit logs



\- `displayName`

  - Optional, human-readable label

  - Used only for audit readability

  - Must not be used for authorization decisions



\- `roles`

  - Array of role identifiers

  - Case-sensitive

  - Must be explicit

  - Must not be inferred



---



\## 4. Injection Guarantees



Middleware injecting `req.actor` MUST guarantee:



1\. Identity authenticity

   The actor represents a verified identity according to the authentication system in use.



2\. Role accuracy

   The roles array reflects the actor’s current assigned roles at request time.



3\. Completeness

   All required fields are present and well-formed.



4\. Non-ambiguity

   No role inference, defaults, or fallbacks are applied.



---



\## 5. Hard Failure Rules (Fail Closed)



The server MUST reject the request with \*\*403 Forbidden\*\* if ANY of the following are true:



\- `req.actor` is missing

\- `req.actor.id` is missing or not a string

\- `req.actor.roles` is missing

\- `req.actor.roles` is not an array

\- A required role for the endpoint is not present



Under no circumstances may the server:

\- Guess identity

\- Assume a default role

\- Continue processing without authority



---



\## 6. Authorization Enforcement Model



\### Endpoint responsibility



Each protected endpoint MUST:

\- Explicitly check required roles

\- Fail closed on missing authority

\- Never escalate privileges

\- Never trust upstream checks implicitly



Authorization checks belong at the \*\*edge of the action\*\*, not deep inside business logic.



---



\## 7. Middleware Responsibilities



Authentication / identity middleware MUST:



\- Populate `req.actor` before routing

\- Never populate partial actor objects

\- Never inject placeholder or anonymous identities

\- Never inject roles not explicitly assigned



Middleware MUST NOT:

\- Modify request behavior after injection

\- Bypass endpoint-level authorization checks

\- Mask or suppress identity failures



---



\## 8. Logging and Audit Requirements



For any protected action:



\- Actor identity MUST be available to logging

\- Actor roles MUST be loggable

\- Actions MUST be attributable to a single actor



Middleware MAY enrich logs but MUST NOT:

\- Alter actor identity mid-request

\- Aggregate multiple identities into one request



---



\## 9. Explicitly Forbidden Patterns



The following patterns are forbidden system-wide:



\- Network-based trust (e.g. “internal IPs are trusted”)

\- Environment-based trust (e.g. “dev mode skips auth”)

\- Implicit admin roles

\- Time-based privilege escalation

\- Temporary bypasses for testing



If authority is missing, the request must fail.



---



\## 10. Compliance Alignment



This contract enforces:

\- Principle of least privilege

\- Separation of duties

\- Explicit accountability

\- Deterministic authorization behavior



It is suitable for regulated financial and enterprise systems.



---



\## 11. Final Statement



The server does not decide who you are.

The server only enforces what is explicitly proven.



If identity or authority is unclear, the action must not occur.



End of document.

