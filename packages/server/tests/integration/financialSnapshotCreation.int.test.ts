// packages/server/tests/integration/financialSnapshotCreation.int.test.ts
// INTEGRATION TEST — FINANCIAL SNAPSHOT CREATION GOVERNANCE
//
// Guarantees:
// 1. Snapshot creation is REJECTED for OPEN periods
// 2. Snapshot creation SUCCEEDS for CLOSED periods
// 3. Snapshot PAYLOAD is deterministic (snapshotId excluded by design)
//
// IMPORTANT:
// - snapshotId is an identity, NOT deterministic data
// - content determinism is asserted explicitly

import { describe, it, expect } from 'vitest';
import { getPostgresPool } from '../../src/db/PostgresClient';

import { FinancialSnapshotCreationService } from '../../src/api/financial-snapshots/FinancialSnapshotCreationService';
import { TrialBalanceReadService } from '../../src/api/TrialBalanceReadService';
import { PostgresTrialBalanceRepository } from '../../src/api/PostgresTrialBalanceRepository';
import { FinancialPeriodStateReadModel } from '../../src/api/FinancialPeriodStateReadModel';
import { PostgresFinancialPeriodEventRepository } from '../../src/api/PostgresFinancialPeriodEventRepository';

describe('FinancialSnapshotCreationService (integration)', () => {
  const pool = getPostgresPool();

  const trialBalanceRepo = new PostgresTrialBalanceRepository(pool);
  const trialBalanceRead = new TrialBalanceReadService(trialBalanceRepo);

  const periodEventRepo = new PostgresFinancialPeriodEventRepository(pool);
  const periodStateReadModel = new FinancialPeriodStateReadModel(
    periodEventRepo
  );

  const service = new FinancialSnapshotCreationService(
    trialBalanceRead,
    periodStateReadModel
  );

  const currency = 'EUR';

  it('REJECTS snapshot creation for OPEN periods', async () => {
    const periods = await periodStateReadModel.listAll();
    const open = periods.find(p => p.status === 'OPEN');

    expect(open).toBeDefined();

    await expect(
      service.createTrialBalanceSnapshot({
        periodId: open!.periodId,
        asOf: new Date(open!.periodFrom),
        currency,
      })
    ).rejects.toThrow(/not CLOSED/i);
  });

  it('CREATES snapshot for CLOSED periods deterministically (payload)', async () => {
    const periods = await periodStateReadModel.listAll();
    const closed = periods.find(p => p.status === 'CLOSED');

    expect(closed).toBeDefined();

    const asOf = new Date(closed!.periodTo);

    const snap1 = await service.createTrialBalanceSnapshot({
      periodId: closed!.periodId,
      asOf,
      currency,
    });

    const snap2 = await service.createTrialBalanceSnapshot({
      periodId: closed!.periodId,
      asOf,
      currency,
    });

    // snapshotId is intentionally NON-deterministic (identity)
    const { snapshotId: _, ...payload1 } = snap1;
    const { snapshotId: __, ...payload2 } = snap2;

    expect(payload1).toEqual(payload2);

    // Explicit contract assertions
    expect(payload1.kind).toBe('FINANCIAL_TRIAL_BALANCE_SNAPSHOT_V1');
    expect(payload1.currency).toBe(currency);
    expect(payload1.period.id).toBe(closed!.periodId);
    expect(payload1.period.from).toBe(closed!.periodFrom.toISOString());
    expect(payload1.period.to).toBe(closed!.periodTo.toISOString());
  });
});
