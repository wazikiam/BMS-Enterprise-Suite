// apps/admin-web/src/pages/reports/SnapshotDetailsPage.tsx
// READ-ONLY — Financial Snapshot Details (GOVERNANCE-HARDENED + EXPORT)
// Phase: Admin Snapshot UX (audit-grade)
//
// Rules:
// - READ-ONLY
// - No mutations
// - Deterministic rendering
// - Fail-closed behavior
// - SnapshotId is the audit anchor

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchSnapshotDetailsOptional,
  ReportingSnapshotDetails,
} from "../../api/snapshotDetails";
import {
  loadMetaMap,
  resolveApprovedSnapshot,
} from "../../ApprovedSnapshotResolver";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: ReportingSnapshotDetails };

function exportTrialBalanceCSV(
  snapshotId: string,
  snapshot: ReportingSnapshotDetails
) {
  if (!Array.isArray(snapshot.trialBalance)) {
    return;
  }

  const lines: string[] = [];

  // Header (audit context)
  lines.push(`Snapshot ID,${snapshotId}`);
  lines.push(`As Of,${snapshot.asOf}`);
  if (snapshot.period?.from && snapshot.period?.to) {
    lines.push(`Period,${snapshot.period.from} -> ${snapshot.period.to}`);
  }
  lines.push(""); // spacer

  // Table header
  lines.push("Account,Debit,Credit,Balance");

  // Rows
  for (const row of snapshot.trialBalance) {
    lines.push(
      [
        row.account,
        row.debit,
        row.credit,
        row.balance,
      ].join(",")
    );
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trial-balance-${snapshotId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SnapshotDetailsPage(): JSX.Element {
  const { snapshotId } = useParams<{ snapshotId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!snapshotId) {
      setState({ status: "not-found" });
      return;
    }

    let cancelled = false;

    fetchSnapshotDetailsOptional(snapshotId)
      .then((snapshot) => {
        if (cancelled) return;

        if (!snapshot) {
          setState({ status: "not-found" });
          return;
        }

        setState({ status: "ready", snapshot });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err.message || "Failed to load snapshot",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  const metaMap = loadMetaMap();
  const meta = snapshotId ? metaMap[snapshotId] : undefined;
  const approved = resolveApprovedSnapshot();
  const isApproved = approved?.snapshotId === snapshotId;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Snapshot Details</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Read-only snapshot view. Immutable. Audit-safe.
        </p>
      </div>

      {state.status === "loading" && (
        <p style={{ opacity: 0.7 }}>Loading snapshot…</p>
      )}

      {state.status === "not-found" && (
        <div>
          <p style={{ margin: 0, color: "#b00020" }}>Snapshot not found</p>
          <p style={{ marginTop: 8, opacity: 0.7 }}>
            The snapshot payload is unavailable (for example, cleared from memory).
          </p>
          <Link to="/reports/snapshots">Back to snapshot list</Link>
        </div>
      )}

      {state.status === "error" && (
        <div>
          <p style={{ margin: 0, color: "#b00020" }}>Error loading snapshot</p>
          <p style={{ marginTop: 8, opacity: 0.7 }}>{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {/* Snapshot Identity */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 10 }}>
              <div style={{ opacity: 0.7 }}>Snapshot ID</div>
              <div style={{ fontFamily: "monospace" }}>{snapshotId}</div>

              <div style={{ opacity: 0.7 }}>Period</div>
              <div>
                {state.snapshot.period?.from} → {state.snapshot.period?.to}
              </div>

              <div style={{ opacity: 0.7 }}>As Of</div>
              <div>{state.snapshot.asOf}</div>

              <div style={{ opacity: 0.7 }}>Approval Status</div>
              <div>{isApproved ? "APPROVED (FINAL)" : "NOT APPROVED"}</div>
            </div>
          </div>

          {/* Governance Evidence */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Governance Evidence</h2>

            {!meta && (
              <p style={{ opacity: 0.7 }}>
                Governance metadata not available for this snapshot.
              </p>
            )}

            {meta && (
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 10 }}>
                <div style={{ opacity: 0.7 }}>Sealed At</div>
                <div>{meta.sealedAt ?? "—"}</div>

                <div style={{ opacity: 0.7 }}>Seal Hash</div>
                <div style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                  {meta.sealedHash ?? "—"}
                </div>

                <div style={{ opacity: 0.7 }}>Verified At</div>
                <div>{meta.verifiedAt ?? "—"}</div>

                <div style={{ opacity: 0.7 }}>Approvals</div>
                <div>
                  {Array.isArray(meta.approvals) && meta.approvals.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {meta.approvals.map((a, i) => (
                        <li key={i}>
                          {a.name}
                          {a.role ? ` (${a.role})` : ""} — {a.at}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Trial Balance + Export */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: 16,
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginTop: 0 }}>Trial Balance (Snapshot)</h2>

              <button
                onClick={() =>
                  snapshotId &&
                  exportTrialBalanceCSV(snapshotId, state.snapshot)
                }
                disabled={!Array.isArray(state.snapshot.trialBalance)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: Array.isArray(state.snapshot.trialBalance)
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                Export CSV
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                      Account
                    </th>
                    <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                      Debit
                    </th>
                    <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                      Credit
                    </th>
                    <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(state.snapshot.trialBalance) ? (
                    state.snapshot.trialBalance.map((line, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: 10 }}>{line.account}</td>
                        <td style={{ padding: 10 }}>{line.debit}</td>
                        <td style={{ padding: 10 }}>{line.credit}</td>
                        <td style={{ padding: 10 }}>{line.balance}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: 10, opacity: 0.7 }}>
                        Trial balance not available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
