// packages/server/src/ar/ARLedgerIntegrationService.ts
// ACCOUNTS RECEIVABLE → LEDGER INTEGRATION (PHASE 2)
//
// Internal-only integration service.
// Explicit, deterministic, audit-safe.

import { Pool } from 'pg';

import {
  ARInvoiceEvent,
} from '@bms/core/src/ar/AccountsReceivable';

import {
  LedgerWriteGateway,
  LedgerWriteActor,
  LedgerWriteCommand,
} from '@bms/core/src/ledger/LedgerWriteGateway';

import {
  assertAccountExists,
} from '@bms/core/src/ledger/ChartOfAccounts';

import {
  LedgerEventType,
} from '@bms/core/src/ledger/LedgerEventTypeRegistry';

import { PostgresLedgerEventRepository } from '../api/PostgresLedgerEventRepository';

export class ARLedgerIntegrationService {
  constructor(
    private readonly pool: Pool
  ) {}

  /**
   * Apply AR domain event to the ledger.
   *
   * Financial context MUST be provided explicitly.
   */
  async applyIssuedInvoice(
    event: Extract<ARInvoiceEvent, { type: 'AR_INVOICE_ISSUED' }>,
    context: {
      totalAmount: string;
      currency: string;
    },
    actor: LedgerWriteActor
  ): Promise<void> {
    // ─────────────────────────────────────────────────────────
    // Chart of Accounts validation
    // ─────────────────────────────────────────────────────────

    const receivableAccount = assertAccountExists('1100'); // AR
    const revenueAccount = assertAccountExists('4000'); // Revenue

    if (receivableAccount.normalBalance !== 'DEBIT') {
      throw new Error('Accounts Receivable must have DEBIT normal balance');
    }

    if (revenueAccount.normalBalance !== 'CREDIT') {
      throw new Error('Revenue must have CREDIT normal balance');
    }

    // ─────────────────────────────────────────────────────────
    // Ledger repository
    // ─────────────────────────────────────────────────────────

    const ledgerRepo = new PostgresLedgerEventRepository(this.pool);

    const journalId = `AR-INVOICE-${event.invoiceId}`;
    const amount = Number(context.totalAmount);

    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error('Invalid invoice amount');
    }

    // ─────────────────────────────────────────────────────────
    // Debit: Accounts Receivable
    // ─────────────────────────────────────────────────────────

    const debitCmd: LedgerWriteCommand = {
      eventId: `${journalId}-DEBIT`,
      journalId,
      eventType: LedgerEventType.LINE_DEBIT_APPLIED,
      occurredAt: event.issuedAt,

      accountCode: receivableAccount.code,
      debitAmount: amount,
      currency: context.currency,

      reason: 'Accounts Receivable recognized for issued invoice',
    };

    // ─────────────────────────────────────────────────────────
    // Credit: Revenue
    // ─────────────────────────────────────────────────────────

    const creditCmd: LedgerWriteCommand = {
      eventId: `${journalId}-CREDIT`,
      journalId,
      eventType: LedgerEventType.LINE_CREDIT_APPLIED,
      occurredAt: event.issuedAt,

      accountCode: revenueAccount.code,
      creditAmount: amount,
      currency: context.currency,

      reason: 'Revenue recognized for issued invoice',
    };

    // ─────────────────────────────────────────────────────────
    // Append events (append-only, governed)
    // ─────────────────────────────────────────────────────────

    await ledgerRepo.append(debitCmd, actor);
    await ledgerRepo.append(creditCmd, actor);
  }
}
