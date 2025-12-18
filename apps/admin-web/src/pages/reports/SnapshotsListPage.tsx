// apps/admin-web/src/pages/reports/SnapshotsListPage.tsx
// READ-ONLY — Financial Snapshots List (UI shell)
// Phase: Finance Reporting UI (no data wiring yet)

import React from "react";

export default function SnapshotsListPage() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Reporting Snapshots</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Read-only list of approved financial snapshots. No edits, no deletes, no regeneration.
        </p>
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          background: "rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search by snapshot ID..."
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              minWidth: 280,
            }}
            disabled
          />
          <select
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              minWidth: 220,
            }}
            disabled
          >
            <option>Status (coming next)</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                  Snapshot ID
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                  Period
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                  As Of
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                  Currency
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                  Status
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  —
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  —
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  —
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  —
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  —
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <button disabled style={{ padding: "8px 10px", borderRadius: 10 }}>
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: 12, opacity: 0.7 }}>
            Next step: wire this list to the snapshot read API.
          </p>
        </div>
      </div>
    </div>
  );
}
