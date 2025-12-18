// packages/server/src/api/FinancialPeriodStateReadModel.ts
// FINANCIAL PERIOD — CANONICAL READ MODEL (SERVER)
//
// Deterministic, projector-based read model used by:
// - Finance periods read APIs
// - Ledger write hard-gates (authoritative)
// - Financial snapshot governance
//
// Rules:
// - No writes
// - No side effects
// - Deterministic ordering
// - Tolerates unknown/partial sequences (ignored)

import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import { FinancialPeriodStateProjector } from './FinancialPeriodStateProjector';

export type FinancialPeriodState = ReturnType<
  typeof FinancialPeriodStateProjector.project
>;

export class FinancialPeriodStateReadModel {
  constructor(
    private readonly repo: PostgresFinancialPeriodEventRepository
  ) {}

  /**
   * List all projected financial periods.
   * Invalid/partial streams are tolerated (ignored).
   */
  async listAll(): Promise<FinancialPeriodState[]> {
    const events = await this.repo.listAll();

    const byPeriod = new Map<string, any[]>();
    for (const e of events) {
      const list = byPeriod.get(e.periodId) ?? [];
      list.push(e);
      byPeriod.set(e.periodId, list);
    }

    const periods: FinancialPeriodState[] = [];

    for (const [, evs] of byPeriod.entries()) {
      // Deterministic ordering (recorded_at primary, event_id tie-breaker)
      evs.sort((a, b) => {
        const t = a.recordedAt.getTime() - b.recordedAt.getTime();
        if (t !== 0) return t;
        return String(a.eventId).localeCompare(String(b.eventId));
      });

      try {
        periods.push(FinancialPeriodStateProjector.project(evs));
      } catch {
        // tolerate invalid sequences
      }
    }

    periods.sort((a, b) => a.periodFrom.getTime() - b.periodFrom.getTime());
    return periods;
  }

  /**
   * Resolve a financial period by its ID.
   * Returns null if the period does not exist or is invalid.
   */
  async getById(periodId: string): Promise<FinancialPeriodState | null> {
    const periods = await this.listAll();
    return periods.find(p => p.periodId === periodId) ?? null;
  }

  /**
   * Resolve the effective financial period for a given timestamp.
   *
   * Returns null if the timestamp is not governed by any period.
   * Throws if multiple periods overlap (governance data error).
   */
  async resolveByDate(
    occurredAt: Date
  ): Promise<FinancialPeriodState | null> {
    const periods = await this.listAll();

    const matches = periods.filter(
      (p) => occurredAt >= p.periodFrom && occurredAt <= p.periodTo
    );

    if (matches.length === 0) return null;

    // Governance must not allow overlapping periods
    if (matches.length > 1) {
      const ids = matches.map((m) => m.periodId).join(', ');
      throw new Error(
        `Ambiguous financial period resolution for ${occurredAt.toISOString()}: overlaps [${ids}]`
      );
    }

    return matches[0];
  }
}
