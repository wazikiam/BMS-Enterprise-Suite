\# BMS Enterprise Suite — Employee Data Model \& Sensitivity (Authoritative)



\## 1. Purpose



This document defines the authoritative employee data model

and classifies each field by sensitivity level.



It ensures correct access control, logging, and future compliance.



This document is normative.



---



\## 2. Core Principle



Not all employee data is equal.



Visibility must be intentional, justified, and auditable.



---



\## 3. Employee Record (Canonical)



Each employee record consists of the following logical groups.



---



\## 4. Identity Fields (LOW Sensitivity)



These fields uniquely identify the employee.



| Field | Description |

|-----|------------|

| employeeId | Internal stable identifier |

| employeeCode | Human-readable internal code |

| firstName | Legal first name |

| lastName | Legal last name |



Rules:

\- Visible to HR\_ADMIN, HR\_VIEWER, HR\_AUDITOR

\- Logged on access

\- Immutable employeeId



---



\## 5. Employment Fields (MEDIUM Sensitivity)



These fields describe the employment relationship.



| Field | Description |

|-----|------------|

| status | active / suspended / terminated |

| hireDate | Employment start date |

| terminationDate | End date (if applicable) |

| contractType | permanent / fixed / consultant |

| departmentId | Organizational unit |

| managerEmployeeId | Reporting manager |



Rules:

\- Editable only by HR\_ADMIN

\- Viewable by HR\_VIEWER

\- Changes are audit-logged



---



\## 6. Contact Fields (HIGH Sensitivity)



Personally identifiable contact information.



| Field | Description |

|-----|------------|

| email | Work email |

| phone | Work phone |

| address | Legal address |



Rules:

\- Visible only to HR\_ADMIN

\- Masked or hidden for HR\_VIEWER

\- All access logged

\- Never exported in bulk without explicit authorization



---



\## 7. Legal \& Government Fields (RESTRICTED)



Highly sensitive, regulated data.



| Field | Description |

|-----|------------|

| nationalId | Government-issued ID |

| taxIdentifier | Tax reference number |

| socialSecurityNumber | Social security reference |



Rules:

\- Visible only to HR\_ADMIN

\- Never editable after entry (append-only corrections)

\- Access requires justification

\- Mandatory audit logging

\- Never exposed to UI without explicit intent



---



\## 8. Role Assignment Fields (LOW Sensitivity)



Business (non-system) roles.



| Field | Description |

|-----|------------|

| businessRoles | Domain roles (e.g. Sales, Ops) |



Rules:

\- Managed by HR\_ADMIN

\- Does NOT grant system access

\- Audited on change



---



\## 9. Explicit Exclusions (Phase 0)



The following MUST NOT exist in Phase 0:

\- Salary amounts

\- Bank account details

\- Bonus or compensation data

\- Performance ratings



These belong to later phases.



---



\## 10. Audit Requirements



For employee records:

\- All mutations are append-only

\- Old values are preserved

\- Actor identity is mandatory

\- Timestamp is mandatory



---



\## 11. Final Statement



Employee data is sensitive by default.



If access is not explicitly justified,

it must not be allowed.



End of document.



