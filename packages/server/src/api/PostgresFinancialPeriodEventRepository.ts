// packages/server/src/api/PostgresFinancialPeriodEventRepository.ts
// FINANCIAL PERIOD EVENT REPOSITORY (APPEND-ONLY)
//
// - Writes immutable period events
// - Reads full event streams by period or globally
// - NO updates, NO deletes

import { FinancialPeriodEventRecord } from '@bms/core/src/finance/FinancialPeriodGateway';

export interface SqlClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>;
}

export class PostgresFinancialPeriodEventRepository {
  constructor(private readonly db: SqlClient) {}

  async append(event: FinancialPeriodEventRecord): Promise<void> {
    const sql = `
      INSERT INTO public.financial_period_events (
        event_id,
        period_id,
        event_type,
        period_from,
        period_to,
        label,
        occurred_at,
        recorded_at,
        actor_id,
        actor_roles,
        reason,
        checksum
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      );
    `;

    const params = [
      event.eventId,
      event.periodId,
      event.eventType,
      event.periodFrom ?? null,
      event.periodTo ?? null,
      event.label ?? null,
      event.occurredAt.toISOString(),
      event.recordedAt.toISOString(),
      event.actorId,
      event.actorRoles,
      event.reason,
      event.checksum,
    ];

    await this.db.query(sql, params);
  }

  async listAll(): Promise<FinancialPeriodEventRecord[]> {
    const sql = `
      SELECT *
      FROM public.financial_period_events
      ORDER BY recorded_at ASC;
    `;

    const result = await this.db.query(sql);
    return result.rows.map(this.mapRow);
  }

  async listByPeriod(periodId: string): Promise<FinancialPeriodEventRecord[]> {
    const sql = `
      SELECT *
      FROM public.financial_period_events
      WHERE period_id = $1
      ORDER BY recorded_at ASC;
    `;

    const result = await this.db.query(sql, [periodId]);
    return result.rows.map(this.mapRow);
  }

  private mapRow(row: any): FinancialPeriodEventRecord {
    return {
      eventId: row.event_id,
      periodId: row.period_id,
      eventType: row.event_type,
      periodFrom: row.period_from ? new Date(row.period_from) : undefined,
      periodTo: row.period_to ? new Date(row.period_to) : undefined,
      label: row.label ?? undefined,
      occurredAt: new Date(row.occurred_at),
      recordedAt: new Date(row.recorded_at),
      actorId: row.actor_id,
      actorRoles: row.actor_roles,
      reason: row.reason,
      checksum: row.checksum,
    };
  }
}
