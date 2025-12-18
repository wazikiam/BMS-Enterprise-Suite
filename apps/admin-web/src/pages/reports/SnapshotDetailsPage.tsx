// apps/admin-web/src/pages/reports/SnapshotDetailsPage.tsx
// READ-ONLY — Financial Snapshot Details (UI shell)
// Phase: Finance Reporting UI (no data wiring yet)

import React from "react";
import { useParams } from "react-router-dom";

export default function SnapshotDetailsPage() {
  const params = useParams();
  const snapshotId = params.snapshotId ?? "—";

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Snapshot Details</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Read-only snapshot view. Snapshot ID is the anchor for audit and governance.
        </p>
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: "rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 10, columnGap: 12 }}>
          <div style={{ opacity: 0.7 }}>Snapshot ID</div>
          <div style={{ fontFamily: "monospace" }}>{snapshotId}</div>

          <div style={{ opacity: 0.7 }}>Kind</div>
          <div>—</div>

          <div style={{ opacity: 0.7 }}>Period</div>
          <div>—</div>

          <div style={{ opacity: 0.7 }}>As Of</div>
          <div>—</div>

          <div style={{ opacity: 0.7 }}>Currency</div>
          <div>—</div>

          <div style={{ opacity: 0.7 }}>Governance</div>
          <div>SEALED / VERIFIED (coming next)</div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          background: "rgba(0,0,0,0.02)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Trial Balance (Snapshot)</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Account</th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Debit</th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Credit</th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>—</td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>—</td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>—</td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 12, opacity: 0.7 }}>
          Next step: load snapshot payload from the API and render deterministic lines.
        </p>
      </div>
    </div>
  );
}
