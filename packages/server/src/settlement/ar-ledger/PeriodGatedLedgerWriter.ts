// packages/server/src/settlement/ar-ledger/PeriodGatedLedgerWriter.ts
// PERIOD-GATED LEDGER WRITER (SERVER) — AR
//
// PHASE 8 — STEP 2 (SYMMETRY)
//
// Role:
// - Defense-in-depth guard for AR ledger writes
// - Ensures no AR settlement-driven ledger write can occur when the period is closed / on legal hold
//
// Notes:
// - Wrapper around a concrete LedgerWriter used by ARLedgerSettlementPostingEngine
// - AR uses accountingDate directly (NOT occurredAt)
// - Does NOT widen or weaken downstream contracts
//
// Non-negotiables:
// - NO DB changes
// - NO routes
// - NO silent behavior: if period is blocked, throw

import type { LedgerWriter } from './ARLedgerSettlementPostingEngine';

export type PeriodGate = {
  /**
   * Must throw if posting is not allowed:
   * - period not found
   * - period closed
   * - legal hold active
   */
  assertPostingAllowed(input: {
    accountingDate: string; // YYYY-MM-DD
    actorId: string;
    actorRoles: readonly string[];
    reason: string;
  }): Promise<void>;
};

type AppendBatchInput = Parameters<LedgerWriter['appendBatch']>[0];

export class PeriodGatedLedgerWriter implements LedgerWriter {
  constructor(
    private readonly inner: LedgerWriter,
    private readonly periodGate: PeriodGate,
    private readonly gateMeta: {
      actorId: string;
      actorRoles: readonly string[];
      reason: string;
    }
  ) {
    if (!inner) throw new Error('PeriodGatedLedgerWriter requires an inner LedgerWriter');
    if (!periodGate) throw new Error('PeriodGatedLedgerWriter requires a PeriodGate');
    if (!gateMeta?.actorId) throw new Error('PeriodGatedLedgerWriter requires gateMeta.actorId');
    if (!gateMeta?.reason) throw new Error('PeriodGatedLedgerWriter requires gateMeta.reason');
  }

  async hasBatch(ledgerBatchId: string): Promise<boolean> {
    return this.inner.hasBatch(ledgerBatchId);
  }

  async appendBatch(input: AppendBatchInput): Promise<void> {
    // AR posting is gated by accountingDate explicitly
    await this.periodGate.assertPostingAllowed({
      accountingDate: input.accountingDate,
      actorId: this.gateMeta.actorId,
      actorRoles: this.gateMeta.actorRoles,
      reason: this.gateMeta.reason,
    });

    // Forward WITHOUT altering or widening types
    await this.inner.appendBatch(input);
  }
}
