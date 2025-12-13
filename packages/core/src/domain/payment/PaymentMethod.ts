// packages/core/src/domain/payment/PaymentMethod.ts

/**
 * PaymentMethod
 * -------------
 * Canonical payment method definition.
 *
 * Rules:
 * - Stable enum (do not rename existing values)
 * - Extend only by adding new methods
 * - Used across Payments, AR, Reporting, UI
 */
export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
  CARD = 'CARD',
  WALLET = 'WALLET'
}
