// packages/core/src/events/handlers/PaymentReversedHandler.ts

import { PaymentReversed } from '../payments/PaymentReversed';
import { SettlementService } from '../../services/settlement/SettlementService';

/**
 * PaymentReversedHandler
 * ---------------------
 * Bridges PaymentReversed events to AR rollback logic.
 *
 * Characteristics:
 * - Synchronous
 * - In-process
 * - Infrastructure-agnostic
 */
export class PaymentReversedHandler {
  constructor(private settlementService: SettlementService) {}

  handle(event: PaymentReversed): void {
    this.settlementService.rollbackPayment(event.payment);
  }
}
