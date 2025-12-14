import crypto from 'crypto';
import { Pool } from 'pg';

import {
  IReportingSnapshotRepository,
  ReportingSnapshotListFilter,
} from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';

import {
  ReportingSnapshot,
  ReportingSnapshotType,
} from '@bms/core/src/reporting/dtos/ReportingSnapshot';

/**
 * PostgreSQL-backed snapshot repository.
 *
 * Constraints:
 * - Append-only persistence (DB also forbids UPDATE/DELETE).
 * - No infrastructure leakage into core.
 * - Deterministic checksum for audit integrity.
 * - Parameterized SQL only.
 */
export class PostgresReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  constructor(private readonly pool: Pool) {}

  async append(snapshot: ReportingSnapshot): Promise<void> {
    const id = snapshot.id ?? crypto.randomUUID();

    const checksum =
      snapshot.checksum ??
      this.computeChecksum({
        id,
        snapshotType: snapshot.snapshotType,
        snapshotVersion: snapshot.snapshotVersion,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        payload: snapshot.payload,
      });

    const sql = `
      INSERT INTO reporting_snapshots
        (id, snapshot_type, snapshot_version, period_start, period_end, payload, checksum, created_at, superseded_by)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), NULL)
    `;

    const params = [
      id,
      snapshot.snapshotType,
      snapshot.snapshotVersion,
      snapshot.periodStart,
      snapshot.periodEnd,
      JSON.stringify(snapshot.payload),
      checksum,
    ];

    await this.pool.query(sql, params);
  }

  async getById(id: string): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT
        id,
        snapshot_type,
        snapshot_version,
        period_start,
        period_end,
        payload,
        checksum,
        created_at
      FROM reporting_snapshots
      WHERE id = $1
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [id]);
    if (res.rowCount === 0) return null;

    return this.mapRowToSnapshot(res.rows[0]);
  }

  async getLatest(
    snapshotType: ReportingSnapshotType
  ): Promise<ReportingSnapshot | null> {
    const sql = `
      SELECT
        id,
        snapshot_type,
        snapshot_version,
        period_start,
        period_end,
        payload,
        checksum,
        created_at
      FROM reporting_snapshots
      WHERE snapshot_type = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [snapshotType]);
    if (res.rowCount === 0) return null;

    return this.mapRowToSnapshot(res.rows[0]);
  }

  async list(
    filter: ReportingSnapshotListFilter
  ): Promise<ReportingSnapshot[]> {
    const limit = this.normalizeLimit(filter?.limit);

    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (filter?.snapshotType) {
      clauses.push(`snapshot_type = $${i++}`);
      params.push(filter.snapshotType);
    }

    if (filter?.periodStartFrom) {
      clauses.push(`period_start >= $${i++}`);
      params.push(filter.periodStartFrom);
    }

    if (filter?.periodEndTo) {
      clauses.push(`period_end <= $${i++}`);
      params.push(filter.periodEndTo);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT
        id,
        snapshot_type,
        snapshot_version,
        period_start,
        period_end,
        payload,
        checksum,
        created_at
      FROM reporting_snapshots
      ${where}
      ORDER BY created_at DESC
      LIMIT $${i++}
    `;

    params.push(limit);

    const res = await this.pool.query(sql, params);
    return res.rows.map((r) => this.mapRowToSnapshot(r));
  }

  private normalizeLimit(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(Math.floor(n), 500);
  }

  private computeChecksum(input: {
    id: string;
    snapshotType: ReportingSnapshotType;
    snapshotVersion: number;
    periodStart: string;
    periodEnd: string;
    payload: unknown;
  }): string {
    const material = JSON.stringify({
      id: input.id,
      snapshotType: input.snapshotType,
      snapshotVersion: input.snapshotVersion,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payload: input.payload,
    });

    return crypto
      .createHash('sha256')
      .update(material, 'utf8')
      .digest('hex');
  }

  private mapRowToSnapshot(row: any): ReportingSnapshot {
    return {
      id: row.id,
      snapshotType: row.snapshot_type as ReportingSnapshotType,
      snapshotVersion: Number(row.snapshot_version),
      periodStart: this.toIsoDate(row.period_start),
      periodEnd: this.toIsoDate(row.period_end),
      payload: row.payload,
      checksum: String(row.checksum),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private toIsoDate(value: any): string {
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }
}
