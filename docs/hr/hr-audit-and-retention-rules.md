\# BMS Enterprise Suite — HR Audit \& Retention Rules (Authoritative)



\## 1. Purpose



This document defines mandatory audit, retention, and deletion

rules for HR data in BMS Enterprise Suite.



It ensures compliance, traceability, and legal defensibility.



This document is normative.



---



\## 2. Core Principle



HR data must be traceable longer than it is editable.



Deletion is the exception, not the rule.



---



\## 3. Audit Logging (Mandatory)



Every HR-related mutation MUST be audit logged, including:



\- Actor identity (id, roles)

\- Action type (create, update, terminate)

\- Affected employeeId

\- Changed fields (old → new)

\- Timestamp

\- Optional human-readable reason



Audit logs are:

\- Append-only

\- Immutable

\- Never editable

\- Never deletable



---



\## 4. Retention Rules (Minimum)



\### 4.1 Active Employees

\- Records retained indefinitely while active

\- Full edit history preserved



---



\### 4.2 Terminated Employees

\- Employee record retained for \*\*minimum 10 years\*\*

\- Employment fields frozen

\- Contact fields may be masked after termination

\- Legal/government fields NEVER deleted



---



\### 4.3 Contractors / Temporary Staff

\- Records retained for \*\*minimum 7 years\*\*

\- Same audit rules apply



---



\## 5. Deletion Rules (Very Restricted)



Hard deletion is ONLY allowed if:

\- Required by law (e.g. court order)

\- Approved by SYSTEM\_ADMIN

\- Action is audit logged with legal reference



Soft deletion (logical deletion) is preferred:

\- Record marked as inactive

\- Data remains present but restricted



---



\## 6. Right to Access \& Rectification



If an employee requests:

\- Data access → allowed, audited

\- Data correction → allowed via append-only correction

\- Data erasure → evaluated against legal retention rules



No silent erasure is permitted.



---



\## 7. Data Masking Rules



After termination:

\- Contact fields MAY be masked

\- Identity and legal fields MUST remain

\- Masking actions are audit logged



---



\## 8. Forbidden Practices



The HR module MUST NOT:

\- Auto-delete employee records

\- Overwrite historical values

\- Suppress audit entries

\- Allow bulk deletion



---



\## 9. Compliance Alignment



These rules align with:

\- Labor law retention expectations

\- Audit and forensic requirements

\- GDPR-style access and rectification principles



---



\## 10. Final Statement



HR data outlives employment.



If history can be erased,

trust is lost.



End of document.



