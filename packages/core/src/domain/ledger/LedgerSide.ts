// packages/core/src/domain/ledger/LedgerSide.ts

/**
 * LedgerSide
 *
 * Represents the accounting side of a ledger entry.
 * This is NOT debit/credit semantics yet — only direction.
 *
 * Semantics will be enforced later by posting rules.
 */
export enum LedgerSide {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
