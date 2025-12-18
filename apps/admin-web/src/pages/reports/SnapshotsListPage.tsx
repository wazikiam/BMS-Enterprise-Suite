// apps/admin-web/src/pages/reports/SnapshotsListPage.tsx
// READ-ONLY — Financial Snapshots List (WIRED)
// Phase: Admin Snapshot UX (governance-safe, deterministic)
//
// Rules:
// - READ-ONLY
// - No mutations
// - Fail-closed errors
// - Deterministic rendering

import React, { useEffect, useState } from "react";
import { fetchSnapshots, ReportingSnapshot } from "../../api/snapshots";
import { Link } from "react-router-dom";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; snapshots: ReportingSnapshot[] };

export default function SnapshotsListPage(): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchSnapshots()
      .then((snapshots) => {
        if (cancelled) return;

        if (!Array.isArray(snapshots) || snapshots.length === 0) {
          setState({ status: "empty" });
          return;
        }

        // Deterministic ordering: newest asOf first
        const ordered = [...snapshots].sort((a, b) => {
          const ta = new Date(a.asOf).getTime();
          const tb = new Date(b.asOf).getTime();
          return tb - ta;
        });

        setState({ status: "ready", snapshots: ordered });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err.message || "Failed to load snapshots",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Reporting Snapshots</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Read-only list of approved financial snapshots. Immutable. Audit-safe.
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
        {state.status === "loading" && (
          <p style={{ opacity: 0.7 }}>Loading snapshots…</p>
        )}

        {state.status === "error" && (
          <div>
            <p style={{ color: "#b00020", margin: 0 }}>
              Error loading snapshots
            </p>
            <p style={{ opacity: 0.7, marginTop: 6 }}>{state.message}</p>
          </div>
        )}

        {state.status === "empty" && (
          <p style={{ opacity: 0.7 }}>
            No snapshots available.
          </p>
        )}

        {state.status === "ready" && (
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
                    Status
                  </th>
                  <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {state.snapshots.map((s) => (
                  <tr key={s.snapshotId}>
                    <td
                      style={{
                        padding: 10,
                        borderBottom: "1px solid rgba(0,0,0,0.08)",
                        fontFamily: "monospace",
                      }}
                    >
                      {s.snapshotId}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {s.periodFrom} → {s.periodTo}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {s.asOf}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      IMMUTABLE
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <Link to={`/reports/snapshots/${s.snapshotId}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
