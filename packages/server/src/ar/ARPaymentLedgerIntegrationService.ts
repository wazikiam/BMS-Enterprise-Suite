// packages/server/src/ar/ARPaymentLedgerIntegrationService.ts
// AR PAYMENT → LEDGER INTEGRATION
//
// - Deterministic
// - Append-only
// - Actor-propagated
// - Period-gated (ledger enforces this)
// - No business logic, no balances

import { LedgerEventType } from '@bms/core/src/ledger/LedgerEventTypeRegistry';
import {
  LedgerWriteActor,
  LedgerWriteCommand,
} from '@bms/core/src/ledger/LedgerWriteGateway';

import { PostgresLedgerEventRepository } from '../api/PostgresLedgerEventRepository';

export interface ARPaymentReceivedEvent {
  type: 'AR_PAYMENT_RECEIVED';
  paymentId: string;
  invoiceId: string;
  occurredAt: Date;
  amount: number;
  currency: string;
}

export class ARPaymentLedgerIntegrationService {
  constructor(
    private readonly ledgerRepo: PostgresLedgerEventRepository
  ) {}

  async onPaymentReceived(
    event: ARPaymentReceivedEvent,
    actor: LedgerWriteActor
  ): Promise<void> {
    const debitCash: LedgerWriteCommand = {
      eventId: `${event.paymentId}-debit`,
      journalId: event.paymentId,
      eventType: LedgerEventType.LINE_DEBIT_APPLIED,
      occurredAt: event.occurredAt,

      accountCode: 'CASH',
      debitAmount: event.amount,
      currency: event.currency,

      reason: `AR payment received for invoice ${event.invoiceId}`,
    };

    const creditAR: LedgerWriteCommand = {
      eventId: `${event.paymentId}-credit`,
      journalId: event.paymentId,
      eventType: LedgerEventType.LINE_CREDIT_APPLIED,
      occurredAt: event.occurredAt,

      accountCode: 'ACCOUNTS_RECEIVABLE',
      creditAmount: event.amount,
      currency: event.currency,

      reason: `AR payment settlement for invoice ${event.invoiceId}`,
    };

    await this.ledgerRepo.append(debitCash, actor);
    await this.ledgerRepo.append(creditAR, actor);
  }
}
