// apps/admin-web/src/router.tsx
// ADMIN WEB ROUTER — GOVERNANCE SAFE
//
// Rules:
// - AR / master data pages are ALWAYS accessible
// - Snapshot governance applies ONLY to reporting
// - Deterministic navigation
// - No silent redirects

import { createBrowserRouter } from 'react-router-dom';
import ApprovedSnapshotResolver from './ApprovedSnapshotResolver.tsx';
// Pages
import ARInvoicesPage from './pages/ARInvoices';

export const router = createBrowserRouter([
  // ─────────────────────────────────────────────
  // ROOT — SAFE LANDING
  // ─────────────────────────────────────────────
  {
    path: '/',
    element: (
      <div style={{ padding: 24 }}>
        <h1>BMS Enterprise Suite</h1>
        <p>Select a module:</p>
        <ul>
          <li>
            <a href="/ar/invoices">Accounts Receivable</a>
          </li>
          <li>
            <a href="/reports/snapshots">Reporting</a>
          </li>
        </ul>
      </div>
    ),
  },

  // ─────────────────────────────────────────────
  // ACCOUNTS RECEIVABLE (READ-ONLY, ALWAYS OPEN)
  // ─────────────────────────────────────────────
  {
    path: '/ar/invoices',
    element: <ARInvoicesPage />,
  },

  // ─────────────────────────────────────────────
  // SNAPSHOT-GOVERNED REPORTING
  // ─────────────────────────────────────────────
  {
    path: '/reports',
    element: <ApprovedSnapshotResolver />,
    children: [
      {
        path: 'snapshots',
        element: (
          <div style={{ padding: 24 }}>
            <h2>Snapshots</h2>
            <p>Snapshot list goes here</p>
          </div>
        ),
      },
    ],
  },

  // ─────────────────────────────────────────────
  // FALLBACK
  // ─────────────────────────────────────────────
  {
    path: '*',
    element: (
      <div style={{ padding: 24 }}>
        <h2>Page not found</h2>
      </div>
    ),
  },
]);
