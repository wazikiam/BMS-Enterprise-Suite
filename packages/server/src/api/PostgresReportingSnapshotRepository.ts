import crypto from 'crypto';
import { Pool } from 'pg';

import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';
import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';

/**
 * Persistence projection for reporting snapshots.
 * This is NOT the domain model.
 */
type PersistedReportingSnapshot = {
  id: string;
  snapshotType: string;
  snapshotVersion: number;
  periodStart: string;
  periodEnd: string;
  payload: unknown;
  checksum: string;
  createdAt?: string;
};

export class PostgresReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  constructor(private readonly pool: Pool) {}

  async append(snapshot: ReportingSnapshot): Promise<void> {
    const id = crypto.randomUUID();

    const persisted: PersistedReportingSnapshot = {
      id,
      snapshotType: 'SALES_KPI',
      snapshotVersion: snapshot.version,
      periodStart: snapshot.period.from.toISOString().slice(0, 10),
      periodEnd: snapshot.period.to.toISOString().slice(0, 10),
      payload: snapshot,
      checksum: this.computeChecksum(snapshot),
    };

    const sql = `
      INSERT INTO reporting_snapshots
        (id, snapshot_type, snapshot_version, period_start, period_end, payload, checksum, created_at, superseded_by)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), NULL)
    `;

    const params = [
      persisted.id,
      persisted.snapshotType,
      persisted.snapshotVersion,
      persisted.periodStart,
      persisted.periodEnd,
      JSON.stringify(persisted.payload),
      persisted.checksum,
    ];

    await this.pool.query(sql, params);
  }

  async getLatest(_snapshotType: string): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql);
    if (res.rowCount === 0) return null;

    return res.rows[0].payload as ReportingSnapshot;
  }

  async getById(id: string): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE id = $1
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [id]);
    if (res.rowCount === 0) return null;

    return res.rows[0].payload as ReportingSnapshot;
  }

  async list(): Promise<ReportingSnapshot[]> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const res = await this.pool.query(sql);
    return res.rows.map((r) => r.payload as ReportingSnapshot);
  }

  private computeChecksum(snapshot: ReportingSnapshot): string {
    const material = JSON.stringify(snapshot);
    return crypto
      .createHash('sha256')
      .update(material, 'utf8')
      .digest('hex');
  }
}
