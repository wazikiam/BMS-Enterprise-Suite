// packages/core/src/ledger/LedgerEventTypeRegistry.ts
// AUTHORITATIVE LEDGER EVENT REGISTRY
// Bank-grade, append-only, audit-safe
// Unknown events are tolerated by readers but NEVER produced by writers

export enum LedgerEventType {
  // ─────────────────────────────────────────────────────────────
  // Journal Lifecycle
  // ─────────────────────────────────────────────────────────────
  JOURNAL_CREATED = 'JOURNAL_CREATED',
  JOURNAL_POSTED = 'JOURNAL_POSTED',
  JOURNAL_REVERSED = 'JOURNAL_REVERSED',

  // ─────────────────────────────────────────────────────────────
  // Line-Level Financial Movements
  // ─────────────────────────────────────────────────────────────
  LINE_DEBIT_APPLIED = 'LINE_DEBIT_APPLIED',
  LINE_CREDIT_APPLIED = 'LINE_CREDIT_APPLIED',

  // ─────────────────────────────────────────────────────────────
  // Period Governance
  // ─────────────────────────────────────────────────────────────
  PERIOD_OPENED = 'PERIOD_OPENED',
  PERIOD_CLOSED = 'PERIOD_CLOSED',
  PERIOD_REOPENED = 'PERIOD_REOPENED',

  // ─────────────────────────────────────────────────────────────
  // Adjustments & Corrections (Never Delete)
  // ─────────────────────────────────────────────────────────────
  ADJUSTMENT_APPLIED = 'ADJUSTMENT_APPLIED',

  // ─────────────────────────────────────────────────────────────
  // Snapshot Anchoring (Ledger → Snapshot)
  // ─────────────────────────────────────────────────────────────
  LEDGER_SNAPSHOT_ANCHORED = 'LEDGER_SNAPSHOT_ANCHORED'
}

/**
 * Exhaustive guard for switch safety.
 * MUST be used in all ledger event dispatchers.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled LedgerEventType: ${String(x)}`);
}

/**
 * Compile-time verified list of all allowed ledger event types.
 * Writers MUST validate against this registry.
 */
export const ALL_LEDGER_EVENT_TYPES: readonly LedgerEventType[] = Object.values(
  LedgerEventType
) as readonly LedgerEventType[];
