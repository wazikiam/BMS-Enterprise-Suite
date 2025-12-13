// packages/core/src/events/handlers/PaymentPostedHandler.ts

import { PaymentPosted } from '../payments/PaymentPosted';
import { SettlementService } from '../../services/settlement/SettlementService';

/**
 * PaymentPostedHandler
 * --------------------
 * Bridges PaymentPosted events to AR settlement.
 *
 * Notes:
 * - Synchronous, in-process
 * - Infrastructure can replace this later
 */
export class PaymentPostedHandler {
  constructor(private settlementService: SettlementService) {}

  handle(event: PaymentPosted): void {
    this.settlementService.settlePayment(event.payment);
  }
}
