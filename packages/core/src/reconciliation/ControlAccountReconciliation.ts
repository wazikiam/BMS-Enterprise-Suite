// packages/core/src/reconciliation/ControlAccountReconciliation.ts
// CONTROL ACCOUNT RECONCILIATION (CORE CONTRACT)
//
// PHASE 9 — STEP 1
//
// Purpose:
// - Canonical, audit-grade contract for reconciling subledger exposure (AR/AP)
//   against the ledger control account balance.
// - Read models and services MUST output this shape exactly.
// - No persistence, no queries, no calculations here — contract only.
//
// Core principles:
// - Deterministic reporting shape (stable ordering, explicit numbers)
// - Currency-first (reconciliation is per currency)
// - Amounts expressed in MINOR units (integer) to avoid rounding ambiguity
// - Drift is explicit and sign-preserving
//
// Definitions:
// - ledgerControlNetMinor: Net balance of the control account for that currency,
//   expressed in minor units (integer). (Positive/negative meaning is domain-defined,
//   but drift must be computed consistently.)
// - subledgerNetMinor: Net exposure from the subledger (AR/AP) for that currency,
//   expressed in minor units (integer).
// - driftMinor = ledgerControlNetMinor - subledgerNetMinor
//   (If driftMinor === 0, it reconciles.)

export type ReconciliationScope = 'AR' | 'AP';

export type ReconciliationStatus =
  | 'MATCH'      // driftMinor === 0
  | 'MISMATCH'   // driftMinor !== 0
  | 'WARN';      // reconciles but has warnings (e.g., missing currency scale)

export type CurrencyCode = string;

/**
 * Minor unit amount (integer).
 * Example: cents for USD/EUR, centimes for MAD, etc.
 */
export type MoneyMinorAmount = number;

export type ReconciliationRunMeta = {
  /** ISO-8601 UTC timestamp when the reconciliation report was generated */
  generatedAt: string;

  /** Inclusive period start (YYYY-MM-DD) */
  periodFrom: string;

  /** Inclusive period end (YYYY-MM-DD) */
  periodTo: string;

  /** As-of date used for snapshots / point-in-time logic (YYYY-MM-DD) */
  asOf: string;

  /**
   * Optional snapshot id when this reconciliation is derived from an approved snapshot.
   * Null / undefined means live read models.
   */
  snapshotId?: string | null;
};

export type CurrencyReconciliationLine = {
  currency: CurrencyCode;

  /**
   * Ledger control account net balance (minor units).
   * Produced by the ledger read model (or snapshot) and converted into minor units
   * deterministically by an external currency scale policy.
   */
  ledgerControlNetMinor: MoneyMinorAmount;

  /**
   * Subledger net exposure (minor units).
   * - For AR: customer receivables net exposure for the period/asOf
   * - For AP: supplier payables net exposure for the period/asOf
   */
  subledgerNetMinor: MoneyMinorAmount;

  /** driftMinor = ledgerControlNetMinor - subledgerNetMinor */
  driftMinor: MoneyMinorAmount;

  /** Absolute drift (minor units). Useful for sorting and threshold rules. */
  absDriftMinor: MoneyMinorAmount;

  status: ReconciliationStatus;

  /**
   * Optional details for audit traceability.
   * Must remain deterministic (no random, no environment-specific fields).
   */
  notes?: readonly string[];
};

export type ControlAccountReconciliationReport = {
  scope: ReconciliationScope;

  /**
   * Account code used as the ledger control account for this reconciliation.
   * Example: "1100-AR" or "2100-AP" depending on your chart.
   */
  controlAccountCode: string;

  meta: ReconciliationRunMeta;

  /**
   * Currency lines MUST be sorted by currency ascending (lexicographic) for determinism.
   */
  lines: readonly CurrencyReconciliationLine[];

  /**
   * Overall reconciliation status:
   * - true when all currencies are MATCH or WARN (no MISMATCH)
   * - false if any currency is MISMATCH
   */
  reconciles: boolean;

  /**
   * High-level warnings that apply to the entire report (e.g., missing FX scales).
   * Must remain deterministic.
   */
  warnings?: readonly string[];
};
