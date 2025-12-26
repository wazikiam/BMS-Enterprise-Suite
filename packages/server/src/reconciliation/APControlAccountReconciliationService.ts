// packages/server/src/reconciliation/APControlAccountReconciliationService.ts
// AP CONTROL ACCOUNT RECONCILIATION (SERVER)
//
// PHASE 9 — STEP 2
//
// Role:
// - Compute AP subledger vs Ledger control account reconciliation per currency
// - Snapshot-aware and period-aware
// - Deterministic output contract defined in core
//
// Scope limits (this step):
// - NO SQL here
// - NO routes / UI
// - NO DB migrations
// - Uses injected providers (ledger + subledger) to keep the service pure and testable

import {
  ControlAccountReconciliationReport,
  CurrencyReconciliationLine,
  MoneyMinorAmount,
  ReconciliationRunMeta,
  ReconciliationStatus,
} from '@bms/core/src/reconciliation/ControlAccountReconciliation';

export type APReconciliationInput = {
  controlAccountCode: string;

  periodFrom: string; // YYYY-MM-DD (inclusive)
  periodTo: string;   // YYYY-MM-DD (inclusive)
  asOf: string;       // YYYY-MM-DD

  snapshotId?: string | null;
};

/**
 * Provider for authoritative ledger control account balances per currency,
 * already expressed in MINOR units (integer).
 *
 * IMPORTANT:
 * - If the ledger stores major units, the provider MUST apply a deterministic
 *   currency scale policy before returning minor units.
 */
export type LedgerControlAccountProvider = {
  getControlAccountNetMinorByCurrency(input: {
    controlAccountCode: string;
    periodFrom: string;
    periodTo: string;
    asOf: string;
    snapshotId?: string | null;
  }): Promise<ReadonlyArray<{ currency: string; ledgerControlNetMinor: MoneyMinorAmount }>>;
};

/**
 * Provider for authoritative AP subledger exposure per currency,
 * already expressed in MINOR units (integer).
 *
 * IMPORTANT:
 * - Exposure must be computed from AP events/read models only.
 * - Snapshot-aware if snapshotId is provided.
 */
export type APSubledgerExposureProvider = {
  getAPNetMinorByCurrency(input: {
    periodFrom: string;
    periodTo: string;
    asOf: string;
    snapshotId?: string | null;
  }): Promise<ReadonlyArray<{ currency: string; subledgerNetMinor: MoneyMinorAmount }>>;
};

export class APControlAccountReconciliationService {
  constructor(
    private readonly ledger: LedgerControlAccountProvider,
    private readonly ap: APSubledgerExposureProvider
  ) {
    if (!ledger) throw new Error('APControlAccountReconciliationService requires ledger provider');
    if (!ap) throw new Error('APControlAccountReconciliationService requires AP exposure provider');
  }

  /**
   * Generate an audit-grade reconciliation report (deterministic).
   */
  async reconcile(input: APReconciliationInput): Promise<ControlAccountReconciliationReport> {
    const generatedAt = new Date().toISOString();

    const meta: ReconciliationRunMeta = {
      generatedAt,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      asOf: input.asOf,
      snapshotId: input.snapshotId ?? null,
    };

    const [ledgerRows, apRows] = await Promise.all([
      this.ledger.getControlAccountNetMinorByCurrency({
        controlAccountCode: input.controlAccountCode,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        asOf: input.asOf,
        snapshotId: input.snapshotId ?? null,
      }),
      this.ap.getAPNetMinorByCurrency({
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        asOf: input.asOf,
        snapshotId: input.snapshotId ?? null,
      }),
    ]);

    const warnings: string[] = [];

    // Build union currency set
    const ledgerMap = new Map<string, MoneyMinorAmount>();
    for (const r of ledgerRows) {
      if (!r.currency || r.currency.trim().length === 0) {
        warnings.push('Ledger provider returned empty currency code (ignored).');
        continue;
      }
      ledgerMap.set(r.currency, normalizeMinor(r.ledgerControlNetMinor));
    }

    const apMap = new Map<string, MoneyMinorAmount>();
    for (const r of apRows) {
      if (!r.currency || r.currency.trim().length === 0) {
        warnings.push('AP provider returned empty currency code (ignored).');
        continue;
      }
      apMap.set(r.currency, normalizeMinor(r.subledgerNetMinor));
    }

    const currencies = new Set<string>([...ledgerMap.keys(), ...apMap.keys()]);

    const lines: CurrencyReconciliationLine[] = [];
    for (const currency of currencies) {
      const ledgerControlNetMinor = ledgerMap.get(currency) ?? 0;
      const subledgerNetMinor = apMap.get(currency) ?? 0;

      const driftMinor = ledgerControlNetMinor - subledgerNetMinor;
      const absDriftMinor = Math.abs(driftMinor);

      const notes: string[] = [];

      if (!ledgerMap.has(currency)) {
        notes.push('Ledger control balance missing for this currency; treated as 0.');
      }
      if (!apMap.has(currency)) {
        notes.push('AP subledger exposure missing for this currency; treated as 0.');
      }

      const status: ReconciliationStatus = driftMinor === 0 ? 'MATCH' : 'MISMATCH';

      lines.push({
        currency,
        ledgerControlNetMinor,
        subledgerNetMinor,
        driftMinor,
        absDriftMinor,
        status,
        notes: notes.length > 0 ? Object.freeze([...notes]) : undefined,
      });
    }

    // Deterministic ordering by currency (lexicographic)
    lines.sort((a, b) => a.currency.localeCompare(b.currency));

    const reconciles = lines.every((l) => l.status !== 'MISMATCH');

    const report: ControlAccountReconciliationReport = {
      scope: 'AP',
      controlAccountCode: input.controlAccountCode,
      meta,
      lines: Object.freeze(lines),
      reconciles,
      warnings: warnings.length > 0 ? Object.freeze(stableUnique(warnings)) : undefined,
    };

    return report;
  }
}

function normalizeMinor(x: MoneyMinorAmount): MoneyMinorAmount {
  if (!Number.isFinite(x)) return 0;
  // Ensure deterministic integer semantics even if an upstream mistakenly passes floats
  return Math.trunc(x);
}

function stableUnique(items: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(i);
  }
  return out;
}
