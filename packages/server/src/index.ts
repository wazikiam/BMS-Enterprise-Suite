// packages/server/src/index.ts

import express from 'express';
import cors from 'cors';

import reportingRouter from './routes/reporting';
import ledgerRoutes from './api/ledger.routes';

import { createLedgerBalanceQuery } from './api/ledgerBalanceProvider';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/**
 * Root welcome page
 */
app.get('/', (_req, res) => {
  res.json({
    message: 'BMS Enterprise Suite API',
    version: '1.0.0',
    service: 'Business Management System',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      apiInfo: 'GET /api',
      frontend: 'http://localhost:5173',
    },
  });
});

/**
 * Health check
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'BMS Enterprise Suite',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * API root
 */
app.get('/api', (_req, res) => {
  res.json({
    name: 'BMS Enterprise Suite API',
    version: '1.0.0',
    description: 'Business Management System REST API',
    modules: {
      reporting: '/api/reports/*',
      ledger: '/api/ledger/*',
    },
    status: 'operational',
  });
});

/**
 * Reporting / Snapshots API
 */
app.use('/api/reports', reportingRouter);

/**
 * Ledger Posting API (append-only)
 */
app.use('/api/ledger', ledgerRoutes);

/**
 * Ledger Balance Read Model
 *
 * NOTE:
 * - Wired for composition only
 * - NOT exposed via HTTP yet
 * - NO side effects
 * - NO execution here
 */
createLedgerBalanceQuery();

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Global error handler
 */
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Something went wrong',
    });
  }
);

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         BMS Enterprise Suite Server Started                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server:   http://localhost:${PORT}                               ║
║  Health:   http://localhost:${PORT}/health                       ║
║  API Docs: http://localhost:${PORT}/api                         ║
║                                                              ║
║  Environment: development                                    ║
║  Version:    1.0.0                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

export { app };
