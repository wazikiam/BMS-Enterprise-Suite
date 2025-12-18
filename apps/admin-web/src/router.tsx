// apps/admin-web/src/router.tsx
// ADMIN-WEB ROUTER — DETERMINISTIC, GOVERNANCE-SAFE
//
// Rules:
// - No lazy-loading (deterministic build + routing)
// - Explicit routes only
// - Snapshot UX is read-only and separated from write commands

import React from 'react';
import {
  Navigate,
  createBrowserRouter,
} from 'react-router-dom';

import SnapshotsListPage from './pages/reports/SnapshotsListPage';
import SnapshotDetailsPage from './pages/reports/SnapshotDetailsPage';
import ApprovedSnapshotResolver from './ApprovedSnapshotResolver';

function NotFound(): JSX.Element {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: 0 }}>Not Found</h2>
      <p style={{ marginTop: 8 }}>
        The requested page does not exist.
      </p>
    </div>
  );
}

/**
 * Router contract:
 * - /reports/snapshots              => list snapshots
 * - /reports/snapshots/:snapshotId  => snapshot details
 * - /reports/snapshots/approved     => resolves to the approved snapshot (if any)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/reports/snapshots" replace />,
    errorElement: <NotFound />,
  },
  {
    path: '/reports',
    errorElement: <NotFound />,
    children: [
      {
        path: 'snapshots',
        children: [
          {
            index: true,
            element: <SnapshotsListPage />,
          },
          {
            path: 'approved',
            element: <ApprovedSnapshotResolver />,
          },
          {
            path: ':snapshotId',
            element: <SnapshotDetailsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
