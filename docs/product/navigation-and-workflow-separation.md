\# BMS Enterprise Suite — Navigation \& Workflow Separation (Authoritative)



\## 1. Purpose



This document defines mandatory navigation and workflow separation

rules for BMS Enterprise Suite.



It ensures users never confuse:

\- Live operational workflows

\- Historical, approved snapshot views



This document is normative.



---



\## 2. Core Principle



Live workflows and historical truth MUST NEVER share the same path.



If a user is navigating history, nothing live may influence it.

If a user is operating live, history must not interfere.



---



\## 3. Top-Level Navigation Rules



The UI MUST expose two distinct top-level areas:



\### 3.1 OPERATE (Live)

Meaning:

\- Current period

\- Mutable state

\- Ongoing operations



Examples:

\- Invoicing (open)

\- Payments

\- Live ledger balances

\- Draft reports



Visual requirements:

\- “LIVE” indicator always visible

\- Current period shown



---



\### 3.2 REVIEW (Historical)

Meaning:

\- Immutable data

\- Approved snapshots

\- Official history



Examples:

\- Period close snapshots

\- Audit snapshots

\- Management review snapshots



Visual requirements:

\- “HISTORICAL” indicator always visible

\- Snapshot context header mandatory



---



\## 4. Route-Level Separation (Mandatory)



Routes MUST NOT mix concerns.



Examples:

\- `/operate/ledger`

\- `/operate/invoices`

\- `/review/snapshots/:snapshotId`



Forbidden:

\- `/ledger?snapshotId=...`

\- Toggles between live and snapshot on the same screen



---



\## 5. Screen Behavior Rules



\### 5.1 Live Screens

\- May refresh automatically

\- May show changing values

\- Must never imply finality



\### 5.2 Snapshot Screens

\- Must never auto-refresh

\- Must never show live indicators

\- Must display snapshot metadata at all times



---



\## 6. Transitions Between Modes



Transitions between OPERATE and REVIEW MUST:

\- Be explicit

\- Require a navigation action

\- Never occur automatically



No “silent switches” are allowed.



---



\## 7. Error \& State Handling



If a snapshot is approved but unavailable:

\- Stay in REVIEW mode

\- Show “Snapshot data not available”

\- Never redirect to live data



---



\## 8. Forbidden Patterns



The UI MUST NOT:

\- Overlay snapshot context on live screens

\- Reuse live components for snapshot views without adaptation

\- Allow editing actions in REVIEW mode

\- Present REVIEW data inside OPERATE flows



---



\## 9. Final Statement



A user must always know:

\- Where they are

\- What truth they are seeing

\- Whether they can act or only observe



If navigation allows confusion, it is incorrect.



End of document.



