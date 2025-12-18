\# BMS Enterprise Suite — Snapshot Naming \& Classification (Authoritative)



\## 1. Purpose



This document defines mandatory naming and classification rules

for all snapshots in BMS Enterprise Suite.



It ensures that every snapshot can be understood

without relying on tribal knowledge.



This document is normative.



---



\## 2. Core Principle



A snapshot name must explain:

\- What was captured

\- Why it was captured

\- When it represents truth



A snapshot without context is invalid.



---



\## 3. Snapshot Classification (Mandatory)



Every snapshot MUST declare exactly one classification.



\### 3.1 PERIOD CLOSE

Meaning:

\- Represents official end-of-period numbers

\- Typically used for monthly or quarterly close



Required conditions:

\- Period is CLOSED or REPORTED

\- Snapshot is approved (4-eyes)



---



\### 3.2 MANAGEMENT REVIEW

Meaning:

\- Represents a management review point

\- Used for internal analysis or decision-making



Required conditions:

\- Period may be OPEN

\- Snapshot is approved

\- Not used for external reporting



---



\### 3.3 AUDIT / COMPLIANCE

Meaning:

\- Represents numbers prepared for audit or regulatory review



Required conditions:

\- Period is CLOSED or REPORTED

\- Snapshot is approved

\- Vault persistence is REQUIRED



---



\### 3.4 INVESTIGATION

Meaning:

\- Represents a temporary investigative snapshot



Required conditions:

\- Clearly marked as non-final

\- NOT to be used for reporting or compliance



---



\## 4. Snapshot Naming Convention



Snapshot names MUST follow this structure:



<Classification> — <Period> — <Short Description>





Examples:

\- `PERIOD CLOSE — 2025-01 — January Close`

\- `MANAGEMENT REVIEW — 2025-02 — Mid-Month Review`

\- `AUDIT / COMPLIANCE — 2024-Q4 — External Audit`

\- `INVESTIGATION — 2025-03 — Variance Analysis`



---



\## 5. Required Metadata



Every snapshot MUST store:

\- Classification

\- Period

\- As-of date

\- Sealed timestamp

\- Approval metadata



Optional metadata:

\- Human-readable description

\- Reference ticket or case ID



---



\## 6. Interpretation Rules



\- Classification defines intended use

\- PERIOD CLOSE and AUDIT snapshots represent official history

\- MANAGEMENT REVIEW snapshots are internal

\- INVESTIGATION snapshots must never be exported externally



---



\## 7. Forbidden Practices



The system MUST NOT:

\- Reclassify snapshots after approval

\- Use INVESTIGATION snapshots for reporting

\- Export snapshots without classification

\- Present snapshots without their classification label



---



\## 8. Final Statement



A snapshot is a statement of intent and truth.



If its purpose cannot be understood from its name and classification,

the snapshot is invalid.



End of document.



