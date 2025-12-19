// packages/server/src/index.ts
// BMS ENTERPRISE SUITE — SERVER ENTRYPOINT
// Governance-grade, fail-closed, audit-first

import express from 'express';
import cors from 'cors';

// ─────────────────────────────────────────────────────────────
// STARTUP GUARD — FAIL FAST IF GOVERNANCE IS BROKEN
// ─────────────────────────────────────────────────────────────

import { StartupGuard } from './startup/startupGuard';
StartupGuard.enforce();

// ─────────────────────────────────────────────────────────────
// Actor injection (explicit, fail-closed)
// ─────────────────────────────────────────────────────────────

import { actorInjectionMiddleware } from './middleware/actorInjection.middleware';

// ─────────────────────────────────────────────────────────────
// Request instrumentation
// ─────────────────────────────────────────────────────────────

import { requestMetricsMiddleware } from './middleware/requestMetrics.middleware';

// ─────────────────────────────────────────────────────────────
// Operations (health / readiness / metrics)
// ─────────────────────────────────────────────────────────────

import operationsRoutes from './api/operations/operations.routes';

// ─────────────────────────────────────────────────────────────
// HR
// ─────────────────────────────────────────────────────────────

import hrRoutes from './hr/hr.routes';

// ─────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────

import reportingRouter from './routes/reporting';

// ─────────────────────────────────────────────────────────────
// Ledger WRITE (APPEND-ONLY, IDEMPOTENT)
// ─────────────────────────────────────────────────────────────

import { createLedgerRoutes } from './api/ledger.routes';

// ─────────────────────────────────────────────────────────────
// Ledger balance (READ-ONLY, PERIOD-AWARE)
// ─────────────────────────────────────────────────────────────

import { createLedgerBalanceProvider } from './api/ledgerBalanceProvider';
import { createLedgerBalanceRoutes } from './api/ledgerBalance.routes';

// ─────────────────────────────────────────────────────────────
// Ledger balance (READ-ONLY, SNAPSHOT-CONSISTENT)
// ─────────────────────────────────────────────────────────────

import { LedgerBalanceSnapshotService } from './api/LedgerBalanceSnapshotService';
import { LedgerBalanceSnapshotController } from './api/LedgerBalanceSnapshotController';
import { ledgerBalanceSnapshotRoutes } from './api/ledgerBalanceSnapshot.routes';

import { reportingSnapshotReaderAdapter } from './api/ReportingSnapshotReaderAdapter';
import { LedgerAccountIndex } from './api/LedgerAccountIndex';
import { PostgresLedgerBalanceRepository } from './api/PostgresLedgerBalanceRepository';

// ─────────────────────────────────────────────────────────────
// Trial Balance (READ-ONLY, PERIOD-AWARE) — CANONICAL
// ─────────────────────────────────────────────────────────────

import { TrialBalanceController } from './api/TrialBalanceController';
import { createTrialBalanceRoutes } from './api/trialBalance.routes';
import { PostgresTrialBalanceReadService } from './services/TrialBalanceReadService';

// ─────────────────────────────────────────────────────────────
// Finance Periods (READ + COMMAND)
// ─────────────────────────────────────────────────────────────

import financePeriodReadRoutes from './api/financePeriods.read.routes';
import financePeriodCommandRoutes from './api/financePeriods.command.routes';

// ─────────────────────────────────────────────────────────────
// Accounts Receivable (READ-ONLY)
// ─────────────────────────────────────────────────────────────

import arReadRoutes from './api/ar.read.routes';

// ─────────────────────────────────────────────────────────────
// Financial Snapshots (READ-ONLY)
// ─────────────────────────────────────────────────────────────

import { createFinancialSnapshotReadRoutes } from './api/financialSnapshots.routes';

// ─────────────────────────────────────────────────────────────
// Internal Snapshot Vault (OPERATOR ONLY)
// ─────────────────────────────────────────────────────────────

import { createSnapshotVaultRouter } from './api/internal/snapshotVault.routes';
import { SnapshotVaultController } from './api/internal/snapshotVault.controller';

import { createSnapshotVaultAuditRouter } from './api/internal/snapshotVaultAudit.routes';
import { SnapshotVaultAuditController } from './api/internal/snapshotVaultAudit.controller';

import { createSnapshotVaultRetentionRouter } from './api/internal/snapshotVaultRetention.routes';
import { SnapshotVaultRetentionController } from './api/internal/snapshotVaultRetention.controller';

import { createSnapshotVaultDeletionRouter } from './api/internal/snapshotVaultDeletion.routes';
import { SnapshotVaultDeletionController } from './api/internal/snapshotVaultDeletion.controller';

import { ReportingSnapshotVaultService } from './reporting/vault/ReportingSnapshotVaultService';
import { ReportingSnapshotRestoreService } from './reporting/vault/ReportingSnapshotRestoreService';
import { SnapshotVaultAuditReadService } from './reporting/vault/SnapshotVaultAuditReadService';
import { SnapshotVaultRetentionService } from './reporting/vault/SnapshotVaultRetentionService';
import { SnapshotVaultDeletionService } from './reporting/vault/SnapshotVaultDeletionService';

// ─────────────────────────────────────────────────────────────
// Infrastructure
// ─────────────────────────────────────────────────────────────

import { getPostgresPool } from './db/PostgresClient';
import { runtimeSnapshotStore } from './reporting/runtime/runtimeSnapshotStore';
import { requireOperatorRole } from './security/requireOperatorRole';

// ─────────────────────────────────────────────────────────────

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

// Actor injection MUST be first
app.use(actorInjectionMiddleware);

// Request metrics
app.use(requestMetricsMiddleware);

// ─────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────

app.use('/', operationsRoutes);

// ─────────────────────────────────────────────────────────────
// Shared Postgres pool (single instance)
// ─────────────────────────────────────────────────────────────

const pool = getPostgresPool();

// ─────────────────────────────────────────────────────────────
// INTERNAL SNAPSHOT VAULT (OPERATOR ONLY)
// ─────────────────────────────────────────────────────────────

const snapshotVaultService = new ReportingSnapshotVaultService(
  pool,
  runtimeSnapshotStore
);

const snapshotRestoreService = new ReportingSnapshotRestoreService(
  pool,
  runtimeSnapshotStore
);

const snapshotVaultAuditReadService = new SnapshotVaultAuditReadService(pool);
const snapshotVaultRetentionService = new SnapshotVaultRetentionService(pool);
const snapshotVaultDeletionService = new SnapshotVaultDeletionService(pool);

const snapshotVaultController = new SnapshotVaultController(
  snapshotVaultService,
  snapshotRestoreService
);

const snapshotVaultAuditController = new SnapshotVaultAuditController(
  snapshotVaultAuditReadService
);

const snapshotVaultRetentionController = new SnapshotVaultRetentionController(
  snapshotVaultRetentionService
);

const snapshotVaultDeletionController = new SnapshotVaultDeletionController(
  snapshotVaultDeletionService
);

app.use(
  '/internal',
  requireOperatorRole,
  createSnapshotVaultRouter(snapshotVaultController),
  createSnapshotVaultAuditRouter(snapshotVaultAuditController),
  createSnapshotVaultRetentionRouter(snapshotVaultRetentionController),
  createSnapshotVaultDeletionRouter(snapshotVaultDeletionController)
);

// ─────────────────────────────────────────────────────────────
// HR API
// ─────────────────────────────────────────────────────────────

app.use('/api/hr', hrRoutes);

// ─────────────────────────────────────────────────────────────
// REPORTING API
// ─────────────────────────────────────────────────────────────

app.use('/api/reports', reportingRouter);

// ─────────────────────────────────────────────────────────────
// FINANCE PERIOD APIs (READ + COMMAND)
// ─────────────────────────────────────────────────────────────

app.use('/api/finance', financePeriodReadRoutes);
app.use('/api/finance', financePeriodCommandRoutes);

// ─────────────────────────────────────────────────────────────
// ACCOUNTS RECEIVABLE (READ-ONLY)
// ─────────────────────────────────────────────────────────────

app.use('/api/ar', arReadRoutes);

// ─────────────────────────────────────────────────────────────
// FINANCIAL SNAPSHOT READ API (IMMUTABLE)
// ─────────────────────────────────────────────────────────────

app.use('/api/finance/snapshots', createFinancialSnapshotReadRoutes());

// ─────────────────────────────────────────────────────────────
// LEDGER WRITE API
// ─────────────────────────────────────────────────────────────

app.use('/api/ledger', createLedgerRoutes());

// ─────────────────────────────────────────────────────────────
// LEDGER BALANCE API (READ-ONLY, PERIOD-AWARE)
// ─────────────────────────────────────────────────────────────

const ledgerBalanceProvider = createLedgerBalanceProvider();

app.use(
  '/api/ledger',
  createLedgerBalanceRoutes(
    ledgerBalanceProvider,
    ledgerBalanceProvider.financialPeriodReadModel
  )
);

// ─────────────────────────────────────────────────────────────
// LEDGER BALANCE API (READ-ONLY, SNAPSHOT-CONSISTENT)
// ─────────────────────────────────────────────────────────────

const ledgerAccountIndex = new LedgerAccountIndex(pool);
const ledgerBalanceRepository = new PostgresLedgerBalanceRepository(pool);

const snapshotLedgerReadPort = {
  async getBalance(params: { periodFrom?: Date; periodTo?: Date; asOf: Date }) {
    try {
      const accountRefs = await ledgerAccountIndex.listAccounts();
      const balances = [];

      for (const ref of accountRefs) {
        const balance = await ledgerBalanceRepository.getAccountBalance({
          accountId: ref.accountId,
          currency: ref.currency,
          asOf: params.asOf,
        });

        balances.push(balance);
      }

      return { balances };
    } catch {
      return {
        balances: [],
        warning: 'Ledger read unavailable (infrastructure error)',
      };
    }
  },
};

const ledgerBalanceSnapshotService = new LedgerBalanceSnapshotService(
  reportingSnapshotReaderAdapter,
  snapshotLedgerReadPort
);

const ledgerBalanceSnapshotController = new LedgerBalanceSnapshotController(
  ledgerBalanceSnapshotService
);

app.use('/api/ledger', ledgerBalanceSnapshotRoutes(ledgerBalanceSnapshotController));

// ─────────────────────────────────────────────────────────────
// TRIAL BALANCE API (READ-ONLY, PERIOD-AWARE) — CANONICAL
// ─────────────────────────────────────────────────────────────

const trialBalanceReadService = new PostgresTrialBalanceReadService(pool);
const trialBalanceController = new TrialBalanceController(trialBalanceReadService);

app.use('/api/ledger', createTrialBalanceRoutes(trialBalanceController));

// ─────────────────────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         BMS Enterprise Suite Server Started                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Server:   http://localhost:${PORT}                               ║`);
  console.log(`║  Health:   http://localhost:${PORT}/health                       ║`);
  console.log(`║  Ready:    http://localhost:${PORT}/ready                        ║`);
  console.log(`║  Metrics:  http://localhost:${PORT}/metrics                      ║`);
  console.log(`║  HR API:   http://localhost:${PORT}/api/hr                       ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
});

export { app };
