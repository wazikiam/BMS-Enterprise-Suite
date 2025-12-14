import crypto from 'crypto';
import { Pool } from 'pg';

import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';
import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';

/**
 * PostgreSQL-backed implementation of IReportingSnapshotRepository.
 *
 * HARD GUARANTEES:
 * - Append-only persistence (no UPDATE / DELETE)
 * - Supersession handled via insert-time linkage
 * - Deterministic ordering on ALL reads
 * - Visibility is explicit (effective vs all)
 * - Retention is query-level only
 */
export class PostgresReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  private static readonly MAX_LIST_LIMIT = 500;
  private static readonly DEFAULT_LIST_LIMIT = 50;

  constructor(private readonly pool: Pool) {}

  /* =========================
     WRITE PATH (APPEND-ONLY)
     ========================= */

  async append(snapshot: ReportingSnapshot): Promise<void> {
    const sql = `
      INSERT INTO reporting_snapshots
        (
          id,
          snapshot_type,
          snapshot_version,
          period_start,
          period_end,
          payload,
          checksum,
          created_at,
          superseded_by
        )
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), NULL)
    `;

    const payloadJson = JSON.stringify(snapshot);
    const checksum = this.computeChecksum(payloadJson);

    await this.pool.query(sql, [
      snapshot.snapshotId,
      'REPORTING',
      snapshot.version,
      snapshot.period.from,
      snapshot.period.to,
      payloadJson,
      checksum,
    ]);
  }

  /* =========================
     DIRECT ACCESS (BY ID)
     ========================= */

  async getById(snapshotId: string): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE id = $1
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [snapshotId]);
    return res.rowCount ? (res.rows[0].payload as ReportingSnapshot) : null;
  }

  /* =========================
     EFFECTIVE SNAPSHOT
     ========================= */

  async getLatest(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE period_start = $1
        AND period_end   = $2
        AND created_at <= $3
        AND superseded_by IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [
      params.periodFrom,
      params.periodTo,
      params.asOf,
    ]);

    return res.rowCount ? (res.rows[0].payload as ReportingSnapshot) : null;
  }

  /* =========================
     EFFECTIVE + RETENTION
     ========================= */

  async listEffectiveWithRetention(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
    maxCount?: number;
    maxAgeDays?: number;
  }): Promise<ReportingSnapshot[]> {
    const limit = this.normalizeLimit(params.maxCount);

    let minCreatedAt: Date | null = null;
    if (params.maxAgeDays !== undefined) {
      if (!Number.isFinite(params.maxAgeDays) || params.maxAgeDays <= 0) {
        throw new Error('maxAgeDays must be a positive finite number');
      }
      minCreatedAt = new Date(
        params.asOf.getTime() -
          Math.floor(params.maxAgeDays * 24 * 60 * 60 * 1000)
      );
    }

    const clauses: string[] = [
      'period_start = $1',
      'period_end = $2',
      'created_at <= $3',
      'superseded_by IS NULL',
    ];

    const values: any[] = [
      params.periodFrom,
      params.periodTo,
      params.asOf,
    ];

    if (minCreatedAt) {
      clauses.push(`created_at >= $${values.length + 1}`);
      values.push(minCreatedAt);
    }

    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;

    const res = await this.pool.query(sql, values);
    return res.rows.map((r) => r.payload as ReportingSnapshot);
  }

  /* =========================
     RAW LISTING (ALL SNAPSHOTS)
     ========================= */

  async list(params?: {
    fromGeneratedAt?: Date;
    toGeneratedAt?: Date;
    limit?: number;
  }): Promise<ReportingSnapshot[]> {
    const limit = this.normalizeLimit(params?.limit);

    const clauses: string[] = [];
    const values: any[] = [];

    if (params?.fromGeneratedAt) {
      clauses.push(`created_at >= $${values.length + 1}`);
      values.push(params.fromGeneratedAt);
    }

    if (params?.toGeneratedAt) {
      clauses.push(`created_at <= $${values.length + 1}`);
      values.push(params.toGeneratedAt);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT payload
      FROM reporting_snapshots
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;

    const res = await this.pool.query(sql, values);
    return res.rows.map((r) => r.payload as ReportingSnapshot);
  }

  /* =========================
     INTERNAL GUARDS
     ========================= */

  private normalizeLimit(requested?: number): number {
    const limit =
      requested ?? PostgresReportingSnapshotRepository.DEFAULT_LIST_LIMIT;

    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error('limit must be a positive finite number');
    }

    return Math.min(
      limit,
      PostgresReportingSnapshotRepository.MAX_LIST_LIMIT
    );
  }

  private computeChecksum(payloadJson: string): string {
    return crypto
      .createHash('sha256')
      .update(payloadJson, 'utf8')
      .digest('hex');
  }
}
