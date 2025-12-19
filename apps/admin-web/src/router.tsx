// apps/admin-web/src/router.tsx
// ADMIN WEB ROUTER — GOVERNANCE SAFE
//
// Rules:
// - Read-only UI
// - No mutation routes here
// - Deterministic navigation
// - Explicit pages only

import { createBrowserRouter } from 'react-router-dom';

import ApprovedSnapshotResolver from './ApprovedSnapshotResolver';

// Existing pages
import ARInvoicesPage from './pages/ARInvoices';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ApprovedSnapshotResolver />,
    children: [
      // ─────────────────────────────────────────────
      // Accounts Receivable (READ-ONLY)
      // ─────────────────────────────────────────────
      {
        path: 'ar/invoices',
        element: <ARInvoicesPage />,
      },

      // ─────────────────────────────────────────────
      // Fallback
      // ─────────────────────────────────────────────
      {
        path: '*',
        element: (
          <div style={{ padding: 24 }}>
            <h2>Page not found</h2>
          </div>
        ),
      },
    ],
  },
]);
