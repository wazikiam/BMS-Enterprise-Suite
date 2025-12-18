\# BMS Enterprise Suite — UI State \& Messaging Standard (Authoritative)



\## 1. Purpose



This document defines mandatory UI states and messages

to ensure users always understand system truth.



It prevents confusion, misinterpretation, and misuse.



This document is normative.



---



\## 2. Core Principle



The UI must never hide uncertainty.



If the system does not know, the user must know.



---



\## 3. Mandatory Global UI States



Every screen MUST clearly indicate one of the following states:



\### 3.1 LIVE DATA

Meaning:

\- Data is current

\- Data may change

\- Data is not approved history



Required indicators:

\- “LIVE DATA” badge

\- As-of timestamp

\- Active period



---



\### 3.2 SNAPSHOT DATA — APPROVED

Meaning:

\- Data is immutable

\- Data is official history



Required indicators:

\- “APPROVED SNAPSHOT” badge

\- Snapshot ID

\- Snapshot period

\- Sealed timestamp



---



\### 3.3 SNAPSHOT DATA — NOT AVAILABLE

Meaning:

\- Snapshot exists and is approved

\- Runtime payload is missing



Required behavior:

\- Explicit message: “Snapshot data is not available”

\- Explanation: “Payload is not currently loaded”

\- No numbers displayed

\- No fallback to live data



---



\## 4. Error vs State Distinction



The UI MUST distinguish between:



\- Errors (something failed)

\- States (something is unavailable by design)



Missing snapshot payload is a STATE, not an error.



---



\## 5. Forbidden UI Patterns



The UI MUST NOT:

\- Display numbers without truth context

\- Replace missing snapshot data with live data

\- Hide or downplay unavailable states

\- Show spinners indefinitely for known states



---



\## 6. Operator Messaging



Operator-facing messages MUST:

\- Be factual

\- Be calm

\- Avoid blame or ambiguity

\- Explain what is known and unknown



---



\## 7. Final Statement



If a user can misinterpret system truth,

the UI is incorrect.



Clarity is a system requirement.



End of document.



