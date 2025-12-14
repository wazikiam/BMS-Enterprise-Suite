// packages/core/src/reporting/kpis/KPI.ts

/**
 * KPI is a read-only, point-in-time metric.
 * It represents an observed fact derived from immutable financial data.
 */
export interface KPI<T = number> {
  /** Stable machine-readable identifier (e.g. "ar.totalOutstanding") */
  key: string;

  /** Human-readable label for UI/reporting layers */
  label: string;

  /** Computed value at generation time */
  value: T;

  /** Timestamp when the KPI was generated */
  generatedAt: Date;
}
