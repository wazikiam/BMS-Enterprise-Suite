// packages/server/src/reconciliation/PostgresARSubledgerExposureProvider.ts
// AR SUBLEDGER EXPOSURE PROVIDER (PostgreSQL)
//
// PHASE 10 — STEP 5
//
// Purpose:
// - Provide authoritative AR exposure per currency in MINOR units
// - Derived ONLY from ar_ledger_settlement_events (append-only legal facts)
// - Deterministic and snapshot-compatible by contract (snapshotId is accepted but not used yet)
//
// Notes:
// - This provider is intentionally strict and simple.
// - It derives exposure from settlement journals, NOT from mutable invoice state.
// - We treat AR control account code as a configuration constant.
//   (Policy: settlement journals must include the AR control line using this code.)

import { Pool } from 'pg';

import type { MoneyMinorAmount } from '@bms/core/src/reconciliation/ControlAccountReconciliation';
import type { ARSubledgerExposureProvider } from './ARControlAccountReconciliationService';

type SettlementJournalLine = {
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  currency: string;
  memo?: string;
};

type DbRow = {
  event_type: string;
  occurred_at: Date;
  journal_json: unknown;
  reversal_journal_json: unknown | null;
};

function isYYYYMMDD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function startOfDayUtc(yyyyMmDd: string): Date {
  // deterministic UTC parsing
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function endOfDayUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T23:59:59.999Z`);
}

function normalizeMinor(x: unknown): number {
  if (typeof x !== 'number') return 0;
  if (!Number.isFinite(x)) return 0;
  return Math.trunc(x);
}

function safeLines(x: unknown): SettlementJournalLine[] {
  if (!Array.isArray(x)) return [];
  const out: SettlementJournalLine[] = [];
  for (const it of x) {
    if (!it || typeof it !== 'object') continue;
    const obj = it as any;

    const accountCode = String(obj.accountCode ?? '').trim();
    const direction = String(obj.direction ?? '').trim() as 'DEBIT' | 'CREDIT';
    const currency = String(obj.currency ?? '').trim();
    const amountMinor = normalizeMinor(obj.amountMinor);

    if (!accountCode) continue;
    if (direction !== 'DEBIT' && direction !== 'CREDIT') continue;
    if (!currency) continue;

    out.push({
      accountCode,
      direction,
      amountMinor,
      currency,
      memo: typeof obj.memo === 'string' ? obj.memo : undefined,
    });
  }
  return out;
}

export class PostgresARSubledgerExposureProvider implements ARSubledgerExposureProvider {
  /**
   * Policy: AR control account code must be stable and shared by settlement journals.
   * Default is 1100 (typical AR control).
   */
  private readonly arControlAccountCode: string;

  constructor(private readonly pool: Pool, opts?: { arControlAccountCode?: string }) {
    if (!pool) throw new Error('PostgresARSubledgerExposureProvider requires a database pool');

    const code = (opts?.arControlAccountCode ?? process.env.AR_CONTROL_ACCOUNT_CODE ?? '1100')
      .toString()
      .trim();

    if (!code) throw new Error('AR control account code must be non-empty');
    this.arControlAccountCode = code;
  }

  /**
   * Compute AR exposure per currency in minor units:
   * - Sum all settlement journal lines affecting AR control account code.
   * - DEBIT increases AR exposure, CREDIT decreases AR exposure.
   * - Reversal events apply their reversalJournal lines.
   *
   * Determinism:
   * - Read ordered by occurred_at ASC, event_id ASC
   * - Integer minor semantics enforced via truncation
   */
  async getARNetMinorByCurrency(input: {
    periodFrom: string;
    periodTo: string;
    asOf: string;
    snapshotId?: string | null;
  }): Promise<ReadonlyArray<{ currency: string; subledgerNetMinor: MoneyMinorAmount }>> {
    if (!isYYYYMMDD(input.periodFrom)) throw new Error('periodFrom must be YYYY-MM-DD');
    if (!isYYYYMMDD(input.periodTo)) throw new Error('periodTo must be YYYY-MM-DD');
    if (!isYYYYMMDD(input.asOf)) throw new Error('asOf must be YYYY-MM-DD');

    const periodFrom = startOfDayUtc(input.periodFrom);
    const periodTo = endOfDayUtc(input.periodTo);
    const asOf = endOfDayUtc(input.asOf);

    // effective upper bound is min(periodTo, asOf)
    const upper = asOf.getTime() < periodTo.getTime() ? asOf : periodTo;

    const sql = `
      SELECT
        event_type,
        occurred_at,
        journal_json,
        reversal_journal_json
      FROM public.ar_ledger_settlement_events
      WHERE occurred_at >= $1
        AND occurred_at <= $2
      ORDER BY occurred_at ASC, event_id ASC
    `;

    const res = await this.pool.query<DbRow>(sql, [periodFrom, upper]);

    const totals = new Map<string, number>(); // currency -> minor

    for (const row of res.rows) {
      const eventType = String(row.event_type ?? '').trim();

      const lines =
        eventType === 'AR_LEDGER_POSTING_REVERSED'
          ? safeLines(row.reversal_journal_json)
          : safeLines(row.journal_json);

      for (const ln of lines) {
        if (ln.accountCode !== this.arControlAccountCode) continue;

        const signed =
          ln.direction === 'DEBIT' ? normalizeMinor(ln.amountMinor) : -normalizeMinor(ln.amountMinor);

        const prev = totals.get(ln.currency) ?? 0;
        totals.set(ln.currency, prev + signed);
      }
    }

    const out = Array.from(totals.entries()).map(([currency, subledgerNetMinor]) => ({
      currency,
      subledgerNetMinor: Math.trunc(subledgerNetMinor),
    }));

    out.sort((a, b) => a.currency.localeCompare(b.currency));
    return out;
  }
}
