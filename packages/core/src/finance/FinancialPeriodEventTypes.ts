// packages/core/src/finance/FinancialPeriodEventTypes.ts
// FINANCIAL PERIOD GOVERNANCE — CANONICAL EVENT TYPES
//
// Finance Core — Period Close & Locking
// Append-only event stream is authoritative.
// Unknown events must be tolerated by readers (ignored), but writers must only emit these.

export const FinancialPeriodEventTypes = {
  PERIOD_CREATED: 'PERIOD_CREATED',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  PERIOD_REOPENED: 'PERIOD_REOPENED',
  LEGAL_HOLD_SET: 'LEGAL_HOLD_SET',
  LEGAL_HOLD_CLEARED: 'LEGAL_HOLD_CLEARED',
} as const;

export type FinancialPeriodEventType =
  typeof FinancialPeriodEventTypes[keyof typeof FinancialPeriodEventTypes];
