// packages/core/src/domain/payment/PaymentStatus.ts

/**
 * PaymentStatus
 * -------------
 * Canonical lifecycle states for a Payment.
 *
 * Lifecycle:
 * - PENDING   → created but not yet posted
 * - POSTED    → applied to receivables / invoices
 * - REVERSED  → negated by a reversal entry (never deleted)
 *
 * Rules:
 * - Payments are immutable once POSTED
 * - Reversals create new entries
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED'
}
