// packages/server/src/index.ts

import express from 'express';
import cors from 'cors';

import reportingRouter from './routes/reporting';
import { createLedgerProvider } from './api/ledgerProvider';
import { createLedgerBalanceRoutes } from './api/ledgerBalance.routes';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/**
 * Root
 */
app.get('/', (_req, res) => {
  res.json({
    service: 'BMS Enterprise Suite API',
    version: '1.0.0',
  });
});

/**
 * Health
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
  });
});

/**
 * Providers
 */
const ledgerProvider = createLedgerProvider();

/**
 * Routes
 */
app.use('/api/reports', reportingRouter);
app.use('/api/ledger', createLedgerBalanceRoutes(ledgerProvider));

/**
 * 404
 */
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Error handler
 */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
