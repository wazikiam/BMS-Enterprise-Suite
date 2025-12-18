\# BMS Enterprise Suite — HR Authority \& Roles (Authoritative)



\## 1. Purpose



This document defines the authoritative role and authority model

for the HR module in BMS Enterprise Suite.



It enforces separation of duties and prevents privilege creep.



This document is normative.



---



\## 2. Core Principle



HR manages people records.

HR does NOT manage money, approvals, or system power.



---



\## 3. HR-Specific Roles



\### 3.1 HR\_ADMIN

Authority:

\- Create and update employee records

\- Assign business roles (non-system)

\- Manage employment status

\- Define organizational structure



Forbidden:

\- Approving financial snapshots

\- Viewing payroll amounts

\- Assigning system roles

\- Bypassing audit logging



---



\### 3.2 HR\_VIEWER

Authority:

\- View employee records

\- View organizational structure



Forbidden:

\- Editing records

\- Viewing sensitive fields marked restricted

\- Exporting bulk employee data



---



\### 3.3 HR\_AUDITOR

Authority:

\- View historical changes to employee records

\- Inspect access logs related to HR data



Forbidden:

\- Editing records

\- Creating or terminating employees

\- Exporting live datasets



---



\## 4. Separation From System Roles



HR roles are \*\*business roles\*\*, not system roles.



They MUST NOT:

\- Grant API access

\- Override SYSTEM\_ADMIN decisions

\- Modify authentication identities



System roles remain authoritative for system access.



---



\## 5. Mandatory Enforcement Rules



\- Every HR action MUST have an actor identity

\- Every HR mutation MUST be logged append-only

\- Visibility must be field-level, not just record-level

\- Missing authority fails closed



---



\## 6. Forbidden Patterns



The HR module MUST NOT:

\- Act as an identity provider

\- Store credentials

\- Store salary values in Phase 0

\- Execute approvals outside HR scope



---



\## 7. Final Statement



HR authority is limited by design.



Clear boundaries protect employees, operators, and the company.



End of document.



