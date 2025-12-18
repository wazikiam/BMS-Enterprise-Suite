\# BMS Enterprise Suite — UI Truth Labeling Standard (Authoritative)



\## 1. Purpose



This document defines mandatory UI labeling rules that make the

truth status of all numbers explicit to users.



It prevents confusion between:

\- Live runtime data

\- Approved historical snapshot data



This document is normative.



---



\## 2. Core Principle



Every numeric view MUST declare:

\- What data it shows

\- When it was true

\- Whether it is mutable



No number may appear without context.



---



\## 3. Truth Labels (Mandatory)



The UI MUST use exactly one of the following labels on every financial view.



\### 3.1 LIVE DATA

Meaning:

\- Data reflects current runtime state

\- Data may change

\- Data is not approved history



Required metadata:

\- As-of timestamp

\- Current period



---



\### 3.2 SNAPSHOT DATA — APPROVED

Meaning:

\- Data comes from an approved snapshot

\- Data is immutable

\- Data represents official history



Required metadata:

\- Snapshot ID

\- Snapshot period

\- Sealed timestamp



---



\### 3.3 SNAPSHOT DATA — NOT AVAILABLE

Meaning:

\- Snapshot is approved

\- Runtime payload is missing

\- No data can be shown



Required behavior:

\- Display explicit message

\- Do NOT fabricate data

\- Do NOT fallback to live data



---



\## 4. Forbidden UI Behaviors



The UI MUST NOT:

\- Mix live and snapshot data in one view

\- Recalculate snapshot values

\- Hide missing snapshot payloads

\- Display numbers without a truth label



---



\## 5. Error Semantics



When runtime snapshot payload is missing:

\- API returns 404

\- UI displays “Snapshot data not available”

\- This is NOT an error state



This behavior is intentional.



---



\## 6. Placement Rules



Truth labels MUST be visible:

\- At the top of reports

\- On export headers (PDF/CSV)

\- On dashboards

\- On detail views



Labels must be readable without scrolling.



---



\## 7. Final Statement



If a user cannot tell whether a number is live or historical,

the UI is incorrect.



Truth must be visible at all times.



End of document.



