import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Paper,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { fetchSnapshots, ReportingSnapshot } from './api/snapshots';
import { fetchSnapshotDetails } from './api/snapshotDetails';

/* =========================
   GOVERNANCE STORAGE
========================= */

type SnapshotGov = {
  label?: string;
  status?: 'draft' | 'final';
  sealed?: boolean;
  verified?: boolean;
  approvals?: string[];
  restored?: boolean;
  restoredAt?: string;
  restoredBy?: string;
};

const GOV_KEY = 'bms.snapshot.governance';
const PAYLOAD_KEY = 'bms.snapshot.payloads';

function loadGov(): Record<string, SnapshotGov> {
  return JSON.parse(localStorage.getItem(GOV_KEY) || '{}');
}
function saveGov(v: Record<string, SnapshotGov>) {
  localStorage.setItem(GOV_KEY, JSON.stringify(v));
}

function loadPayloads(): Record<string, any> {
  return JSON.parse(localStorage.getItem(PAYLOAD_KEY) || '{}');
}
function savePayloads(v: Record<string, any>) {
  localStorage.setItem(PAYLOAD_KEY, JSON.stringify(v));
}

/* =========================
   DASHBOARD (APPROVED ONLY)
========================= */

function Home() {
  const [snapshots, setSnapshots] = useState<ReportingSnapshot[]>([]);
  const gov = loadGov();

  const approved = snapshots.find(
    s =>
      gov[s.snapshotId]?.status === 'final' &&
      gov[s.snapshotId]?.sealed &&
      gov[s.snapshotId]?.verified &&
      (gov[s.snapshotId]?.approvals?.length ?? 0) >= 2
  );

  useEffect(() => {
    fetchSnapshots().then(setSnapshots);
  }, []);

  return (
    <Box p={4}>
      <Typography variant="h4">BMS Enterprise Suite</Typography>
      <Typography variant="body2">
        Approved snapshot dashboard (locked)
      </Typography>

      {!approved && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No approved snapshot available.
        </Alert>
      )}

      {approved && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6">Approved Snapshot</Typography>
          <Typography sx={{ fontFamily: 'monospace' }}>
            {approved.snapshotId}
          </Typography>

          <Button
            sx={{ mt: 2 }}
            component={Link}
            to={`/snapshots/${approved.snapshotId}`}
            variant="contained"
          >
            Open Snapshot
          </Button>
        </Paper>
      )}
    </Box>
  );
}

/* =========================
   SNAPSHOT DETAILS (RESTORE)
========================= */

function SnapshotDetails() {
  const { snapshotId } = useParams<{ snapshotId: string }>();
  const [payload, setPayload] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [gov, setGov] = useState(loadGov());
  const payloads = loadPayloads();

  const g = snapshotId ? gov[snapshotId] : null;

  useEffect(() => {
    if (!snapshotId) return;

    // Try backend first
    fetchSnapshotDetails(snapshotId)
      .then(setPayload)
      .catch(() => {
        // fallback to restored payload
        if (payloads[snapshotId]) {
          setPayload(payloads[snapshotId]);
        }
      })
      .finally(() => setLoading(false));
  }, [snapshotId]);

  const canRestore =
    g?.status === 'final' &&
    g?.sealed &&
    g?.verified &&
    (g?.approvals?.length ?? 0) >= 2 &&
    !g?.restored;

  const handleRestore = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const json = JSON.parse(reader.result as string);
      if (json.snapshotId !== snapshotId) {
        alert('Snapshot ID mismatch');
        return;
      }

      const nextPayloads = {
        ...payloads,
        [snapshotId]: json,
      };
      savePayloads(nextPayloads);

      const nextGov = {
        ...gov,
        [snapshotId]: {
          ...g,
          restored: true,
          restoredAt: new Date().toISOString(),
          restoredBy: 'local-operator',
        },
      };
      setGov(nextGov);
      saveGov(nextGov);

      setPayload(json);
    };
    reader.readAsText(file);
  };

  if (!snapshotId) return <Navigate to="/" replace />;

  return (
    <Box p={4}>
      <Button component={Link} to="/">Back</Button>

      {loading && <CircularProgress sx={{ mt: 3 }} />}

      {!loading && g && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5">Snapshot</Typography>
          <Typography sx={{ fontFamily: 'monospace' }}>
            {snapshotId}
          </Typography>

          {g.restored && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              RESTORED — VIEW ONLY — NOT SOURCE OF TRUTH
              <br />
              Restored at: {g.restoredAt}
            </Alert>
          )}

          {canRestore && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Backend payload missing. You may restore from archive.
              <br />
              <input
                type="file"
                accept="application/json"
                onChange={(e) =>
                  e.target.files && handleRestore(e.target.files[0])
                }
              />
            </Alert>
          )}

          {payload && (
            <Paper sx={{ p: 2, mt: 3 }}>
              <pre>{JSON.stringify(payload, null, 2)}</pre>
            </Paper>
          )}
        </Paper>
      )}
    </Box>
  );
}

/* =========================
   ROUTES
========================= */

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/snapshots/:snapshotId" element={<SnapshotDetails />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
