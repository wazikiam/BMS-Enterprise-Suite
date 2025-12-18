// apps/admin-web/src/router.tsx
// BMS ENTERPRISE SUITE — ADMIN WEB ROUTER
// Deterministic, explicit routing. No lazy magic. No side effects.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────
// Pages
// (These must exist. If one is missing, build will fail — by design.)
// ─────────────────────────────────────────────────────────────

import DashboardPage from './pages/DashboardPage';
import SnapshotsPage from './pages/SnapshotsPage';
import SnapshotDetailsPage from './pages/SnapshotDetailsPage';
import FinancePeriodsPage from './pages/FinancePeriodsPage';
import LedgerPage from './pages/LedgerPage';
import TrialBalancePage from './pages/TrialBalancePage';

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export function AppRouter(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Core */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Reporting / Snapshots */}
        <Route path="/snapshots" element={<SnapshotsPage />} />
        <Route
          path="/snapshots/:snapshotId"
          element={<SnapshotDetailsPage />}
        />

        {/* Finance */}
        <Route path="/finance/periods" element={<FinancePeriodsPage />} />

        {/* Ledger */}
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/ledger/trial-balance" element={<TrialBalancePage />} />

        {/* Fallback — fail closed */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
