import crypto from 'crypto';
import { Pool } from 'pg';

import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';
import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';

/**
 * PostgreSQL-backed implementation of IReportingSnapshotRepository.
 *
 * This repository is:
 * - append-only
 * - period-based
 * - generation-order deterministic
 *
 * It persists the FULL domain snapshot as JSONB.
 */
export class PostgresReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  constructor(private readonly pool: Pool) {}

  async append(snapshot: ReportingSnapshot): Promise<void> {
    const sql = `
      INSERT INTO reporting_snapshots
        (id, snapshot_type, snapshot_version, period_start, period_end, payload, checksum, created_at, superseded_by)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), NULL)
    `;

    const payloadJson = JSON.stringify(snapshot);
    const checksum = this.computeChecksum(payloadJson);

    const params = [
      snapshot.snapshotId,
      'REPORTING',
      snapshot.version,
      snapshot.period.from,
      snapshot.period.to,
      payloadJson,
      checksum,
    ];

    await this.pool.query(sql, params);
  }

  async getById(snapshotId: string): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE id = $1
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [snapshotId]);
    if (res.rowCount === 0) return null;

    return res.rows[0].payload as ReportingSnapshot;
  }

  async getLatest(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE period_start = $1
        AND period_end = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [
      params.periodFrom,
      params.periodTo,
    ]);

    if (res.rowCount === 0) return null;

    return res.rows[0].payload as ReportingSnapshot;
  }

  async list(params?: {
    fromGeneratedAt?: Date;
    toGeneratedAt?: Date;
    limit?: number;
  }): Promise<ReportingSnapshot[]> {
    const limit = Math.min(params?.limit ?? 50, 500);

    const clauses: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (params?.fromGeneratedAt) {
      clauses.push(`created_at >= $${i++}`);
      values.push(params.fromGeneratedAt);
    }

    if (params?.toGeneratedAt) {
      clauses.push(`created_at <= $${i++}`);
      values.push(params.toGeneratedAt);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT payload
      FROM reporting_snapshots
      ${where}
      ORDER BY created_at DESC
      LIMIT $${i}
    `;

    values.push(limit);

    const res = await this.pool.query(sql, values);
    return res.rows.map((r) => r.payload as ReportingSnapshot);
  }

  private computeChecksum(payloadJson: string): string {
    return crypto
      .createHash('sha256')
      .update(payloadJson, 'utf8')
      .digest('hex');
  }
}
