\# BMS Enterprise Suite — Snapshot UI Component Contract (Authoritative)



\## 1. Purpose



This document defines mandatory UI components and behaviors

for displaying snapshot data in BMS Enterprise Suite.



It ensures snapshots are always recognized as immutable,

official, and non-interactive.



This document is normative.



---



\## 2. Core Principle



Snapshot data is history.

History must never look editable.



---



\## 3. Mandatory Snapshot Header (ALL SNAPSHOT SCREENS)



Every snapshot screen MUST render a fixed header containing:



\- Classification (PERIOD CLOSE, AUDIT, etc.)

\- Snapshot name

\- Snapshot ID

\- Period (from / to)

\- As-of date

\- Sealed timestamp

\- Approval status (Approved / Not Approved)



This header MUST:

\- Be visually distinct

\- Be pinned (always visible)

\- Never be collapsible



---



\## 4. Immutable Visual Indicators



Snapshot screens MUST apply:



\- Lock icon (🔒) near the title

\- Muted or neutral color palette

\- Disabled interaction affordances



Buttons for create, edit, delete MUST NOT appear.



---



\## 5. Snapshot Availability States



\### 5.1 Available

\- Numbers are rendered

\- Header metadata visible

\- No live indicators



\### 5.2 Approved but Payload Missing

\- No numbers rendered

\- Clear message: “Snapshot data is not available”

\- Explanation: “Payload is not currently loaded”

\- Metadata header still visible



This is NOT an error state.



---



\## 6. Forbidden UI Behavior



The UI MUST NOT:

\- Allow exporting from unavailable snapshots

\- Allow copying numbers from unavailable snapshots

\- Fall back to live data

\- Display spinners indefinitely



---



\## 7. Interaction Rules



\- All snapshot views are read-only

\- Navigation away is allowed

\- No inline actions permitted



---



\## 8. Reuse Rules



Live components MAY be reused ONLY IF:

\- Editing is disabled

\- Live badges are removed

\- Snapshot header is present



Otherwise, components must be adapted.



---



\## 9. Final Statement



If a snapshot can be mistaken for live data,

the UI is incorrect.



Snapshots are records, not tools.



End of document.



