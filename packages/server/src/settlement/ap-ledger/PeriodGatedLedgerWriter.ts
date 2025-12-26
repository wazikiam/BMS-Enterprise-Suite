// packages/server/src/settlement/ap-ledger/PeriodGatedLedgerWriter.ts
// PERIOD-GATED LEDGER WRITER (SERVER)
//
// PHASE 8 — STEP 1
//
// Role:
// - Defense-in-depth guard for ledger writes
// - Ensures no settlement-driven ledger write can occur when the period is closed / on legal hold
//
// Notes:
// - Wrapper around a concrete LedgerWriter (e.g., PostgresAPLedgerWriter)
// - Does NOT widen or weaken downstream contracts
//
// Non-negotiables:
// - NO DB changes
// - NO routes
// - NO silent behavior: if period is blocked, throw

import type { LedgerWriter } from './APLedgerSettlementPostingEngine';
import type {
  APLedgerSettlementEventType,
} from '@bms/core/src/settlement/ap-ledger/APLedgerSettlementEvent';

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

  async appendBatch(input: {
    ledgerBatchId: string;
    meta: {
      sourceType: 'AP_LEDGER_SETTLEMENT';
      settlementEventId: string;
      settlementId: string;
      eventType: APLedgerSettlementEventType;
    };
    journal: readonly {
      accountCode: string;
      direction: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      currency: string;
      memo?: string;
    }[];
    occurredAt: string;
  }): Promise<void> {
    const accountingDate = toYYYYMMDDUTC(input.occurredAt);

    await this.periodGate.assertPostingAllowed({
      accountingDate,
      actorId: this.gateMeta.actorId,
      actorRoles: this.gateMeta.actorRoles,
      reason: this.gateMeta.reason,
    });

    // Forward WITHOUT altering or widening types
    await this.inner.appendBatch(input);
  }
}

function toYYYYMMDDUTC(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid occurredAt ISO timestamp: ${isoUtc}`);
  }

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
