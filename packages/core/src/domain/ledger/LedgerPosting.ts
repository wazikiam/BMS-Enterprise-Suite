// packages/core/src/domain/ledger/LedgerPosting.ts

import { LedgerEntry } from './LedgerEntry';
import { LedgerSide } from './LedgerSide';
import { LedgerPostingError } from './LedgerPostingError';

/**
 * LedgerPosting
 *
 * Immutable double-entry accounting fact.
 *
 * A posting is the SMALLEST valid accounting unit:
 * - Must contain at least one DEBIT and one CREDIT
 * - Sum(DEBIT) === Sum(CREDIT)
 * - Currency must be consistent across entries
 * - Period must be consistent across entries
 *
 * If these invariants do not hold, the posting CANNOT exist.
 */
export class LedgerPosting {
  public readonly id: string;
  public readonly entries: readonly LedgerEntry[];
  public readonly occurredAt: Date;

  constructor(params: {
    id: string;
    entries: LedgerEntry[];
    occurredAt: Date;
  }) {
    if (params.entries.length < 2) {
      throw new LedgerPostingError(
        'Ledger posting must contain at least two entries'
      );
    }

    const debitTotal = params.entries
      .filter((e) => e.side === LedgerSide.DEBIT)
      .reduce((sum, e) => sum + e.amount, 0);

    const creditTotal = params.entries
      .filter((e) => e.side === LedgerSide.CREDIT)
      .reduce((sum, e) => sum + e.amount, 0);

    if (debitTotal !== creditTotal) {
      throw new LedgerPostingError(
        `Ledger posting is unbalanced: DEBIT=${debitTotal}, CREDIT=${creditTotal}`
      );
    }

    const currencies = new Set(params.entries.map((e) => e.currency));
    if (currencies.size !== 1) {
      throw new LedgerPostingError(
        'Ledger posting entries must share the same currency'
      );
    }

    const periodKeys = new Set(
      params.entries.map(
        (e) => `${e.periodStart.toISOString()}::${e.periodEnd.toISOString()}`
      )
    );

    if (periodKeys.size !== 1) {
      throw new LedgerPostingError(
        'Ledger posting entries must share the same financial period'
      );
    }

    const hasDebit = params.entries.some(
      (e) => e.side === LedgerSide.DEBIT
    );
    const hasCredit = params.entries.some(
      (e) => e.side === LedgerSide.CREDIT
    );

    if (!hasDebit || !hasCredit) {
      throw new LedgerPostingError(
        'Ledger posting must include both DEBIT and CREDIT entries'
      );
    }

    this.id = params.id;
    this.entries = Object.freeze([...params.entries]);
    this.occurredAt = params.occurredAt;
  }
}
