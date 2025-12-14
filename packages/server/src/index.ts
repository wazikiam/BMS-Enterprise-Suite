import express from 'express';
import cors from 'cors';

import reportingRouter from './routes/reporting';
import { createLedgerProvider } from './api/ledgerProvider';
import { createLedgerRoutes } from './api/ledger.routes';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'BMS Enterprise Suite',
    status: 'running',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
  });
});

app.use('/api/reports', reportingRouter);

const ledgerProvider = createLedgerProvider();
app.use(
  '/api/ledger',
  createLedgerRoutes(ledgerProvider.controller)
);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : undefined,
    });
  }
);

app.listen(PORT, () => {
  console.log(`Ledger API listening on http://localhost:${PORT}`);
});

export { app };
