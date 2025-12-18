\# BMS Enterprise Suite — Export Header \& Watermark Standard (Authoritative)



\## 1. Purpose



This document defines mandatory headers and watermarks for all exported

financial artifacts (PDF, CSV, XLS, etc.).



It ensures that exported data:

\- Declares its truth source

\- Cannot be mistaken for live data

\- Preserves audit meaning outside the system



This document is normative.



---



\## 2. Core Principle



Any data that leaves the system MUST carry its truth context with it.



An export without context is invalid.



---



\## 3. Export Truth Modes



Every export MUST declare exactly one truth mode.



\### 3.1 LIVE DATA EXPORT

Meaning:

\- Data reflects current runtime state

\- Data is mutable

\- Data is not approved history



Mandatory header fields:

\- Truth Mode: LIVE DATA

\- As-of Timestamp

\- Current Period

\- Exported At (timestamp)

\- Exported By (actor identity)



Mandatory watermark:

\- “LIVE DATA — NOT APPROVED HISTORY”



---



\### 3.2 SNAPSHOT DATA — APPROVED

Meaning:

\- Data comes from an approved snapshot

\- Data is immutable

\- Data represents official history



Mandatory header fields:

\- Truth Mode: SNAPSHOT DATA — APPROVED

\- Snapshot ID

\- Snapshot Period

\- Sealed At (timestamp)

\- Approved By (actors, if available)

\- Exported At (timestamp)

\- Exported By (actor identity)



Mandatory watermark:

\- “APPROVED SNAPSHOT — IMMUTABLE”



---



\### 3.3 SNAPSHOT DATA — NOT AVAILABLE

Meaning:

\- Snapshot is approved

\- Runtime payload is missing

\- No data can be exported



Required behavior:

\- Export MUST be blocked

\- User MUST be informed explicitly

\- No fallback to live data is permitted



---



\## 4. Placement Rules



\### 4.1 Headers

Headers MUST appear:

\- At the top of the first page (PDF)

\- As the first rows (CSV/XLS)

\- Before any numeric content



Headers MUST be human-readable.



---



\### 4.2 Watermarks

Watermarks MUST:

\- Be visible but not obstruct data

\- Appear on every page (PDF)

\- Be included in export metadata where applicable



---



\## 5. Forbidden Export Behaviors



The system MUST NOT:

\- Export snapshot data without snapshot identifiers

\- Export live data without a live warning

\- Mix live and snapshot data in one export

\- Export when truth mode is ambiguous



---



\## 6. Audit Semantics



An exported file MUST be self-describing.



An auditor reading the file without system access must be able to answer:

\- What data is this?

\- When was it true?

\- Was it approved?

\- Who exported it?



If these questions cannot be answered, the export is invalid.



---



\## 7. Final Statement



Exports are extensions of the system’s truth.



If exported data can be misunderstood,

the export mechanism is incorrect.



End of document.



