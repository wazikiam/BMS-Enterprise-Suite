// packages/server/src/index.ts

import express from 'express';
import cors from 'cors';

// Reporting
import reportingRouter from './routes/reporting';

// Ledger balance (read-only)
import { createLedgerBalanceProvider } from './api/ledgerBalanceProvider';
import { createLedgerBalanceRoutes } from './api/ledgerBalance.routes';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Reporting API
app.use('/api/reports', reportingRouter);

// Ledger API (READ-ONLY balance endpoint)
const ledgerBalanceProvider = createLedgerBalanceProvider();
app.use('/api/ledger', createLedgerBalanceRoutes(ledgerBalanceProvider));

app.listen(PORT, () => {
  // Keep logs simple and stable for Windows
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         BMS Enterprise Suite Server Started                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                              ║');
  console.log(`║  Server:   http://localhost:${PORT}                               ║`);
  console.log(`║  Health:   http://localhost:${PORT}/health                       ║`);
  console.log(`║  API:      http://localhost:${PORT}/api                          ║`);
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
});

export { app };
