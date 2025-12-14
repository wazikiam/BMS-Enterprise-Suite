// packages/core/src/domain/ledger/LedgerEntry.ts

import { LedgerSide } from './LedgerSide';
import { LedgerEntryError } from './LedgerEntryError';

/**
 * LedgerEntry
 *
 * Immutable accounting fact.
 *
 * This represents ONE side of a double-entry posting.
 * Balance and pairing rules are enforced later.
 */
export class LedgerEntry {
  public readonly id: string;
  public readonly accountCode: string;
  public readonly side: LedgerSide;
  public readonly amount: number;
  public readonly currency: string;
  public readonly occurredAt: Date;
  public readonly periodStart: Date;
  public readonly periodEnd: Date;
  public readonly referenceType: string;
  public readonly referenceId: string;

  constructor(params: {
    id: string;
    accountCode: string;
    side: LedgerSide;
    amount: number;
    currency: string;
    occurredAt: Date;
    periodStart: Date;
    periodEnd: Date;
    referenceType: string;
    referenceId: string;
  }) {
    if (params.amount <= 0) {
      throw new LedgerEntryError('Ledger entry amount must be positive');
    }

    if (params.periodStart >= params.periodEnd) {
      throw new LedgerEntryError(
        'Ledger entry period start must be before period end'
      );
    }

    this.id = params.id;
    this.accountCode = params.accountCode;
    this.side = params.side;
    this.amount = params.amount;
    this.currency = params.currency;
    this.occurredAt = params.occurredAt;
    this.periodStart = params.periodStart;
    this.periodEnd = params.periodEnd;
    this.referenceType = params.referenceType;
    this.referenceId = params.referenceId;
  }
}
