import crypto from 'crypto';
import { Pool } from 'pg';

import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';
import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';

/**
 * PostgreSQL-backed implementation of IReportingSnapshotRepository.
 *
 * Invariants:
 * - Append-only persistence (no UPDATE / DELETE)
 * - Supersession is expressed via insert-time linkage (superseded_by)
 * - Reads must be deterministic and auditable
 *
 * Retention:
 * - Retention is query-level visibility control ONLY
 * - Data is never deleted or mutated
 */
export class PostgresReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  constructor(private readonly pool: Pool) {}

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

  /**
   * Resolves the latest EFFECTIVE snapshot.
   *
   * Deterministic rules:
   * - Must not be superseded
   * - Must be generated at or before `asOf`
   * - Ordered by generation time, then ID as tie-breaker
   *
   * This method NEVER traverses supersession chains.
   * Supersession correctness is enforced at write-time.
   */
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
      ORDER BY
        created_at DESC,
        id DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [
      params.periodFrom,
      params.periodTo,
      params.asOf,
    ]);

    if (res.rowCount === 0) return null;

    return res.rows[0].payload as ReportingSnapshot;
  }

  /**
   * Retention-aware listing of EFFECTIVE snapshots only.
   *
   * Semantics:
   * - Visibility control only (NO deletion, NO mutation)
   * - Only effective snapshots participate: superseded_by IS NULL
   * - Bounded by asOf: created_at <= asOf
   * - Optional time retention: created_at >= minCreatedAt
   * - Optional count retention: LIMIT maxCount (capped)
   * - Deterministic ordering: created_at DESC, id DESC
   *
   * Not part of core contract yet; intentionally repository-specific for Week 13.
   */
  async listEffectiveWithRetention(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
    maxCount?: number; // count-based retention (visibility)
    maxAgeDays?: number; // time-based retention (visibility), relative to asOf
  }): Promise<ReportingSnapshot[]> {
    const maxCount = Math.min(params.maxCount ?? 50, 500);

    // Compute threshold in application code for deterministic behavior across DB configs/timezones.
    let minCreatedAt: Date | null = null;
    if (params.maxAgeDays !== undefined && params.maxAgeDays !== null) {
      if (!Number.isFinite(params.maxAgeDays) || params.maxAgeDays <= 0) {
        throw new Error('maxAgeDays must be a positive finite number when provided');
      }
      const ms = Math.floor(params.maxAgeDays * 24 * 60 * 60 * 1000);
      minCreatedAt = new Date(params.asOf.getTime() - ms);
    }

    const clauses: string[] = [];
    const values: any[] = [];
    let i = 1;

    clauses.push(`period_start = $${i++}`);
    values.push(params.periodFrom);

    clauses.push(`period_end = $${i++}`);
    values.push(params.periodTo);

    clauses.push(`created_at <= $${i++}`);
    values.push(params.asOf);

    clauses.push(`superseded_by IS NULL`);

    if (minCreatedAt) {
      clauses.push(`created_at >= $${i++}`);
      values.push(minCreatedAt);
    }

    const sql = `
      SELECT payload
      FROM reporting_snapshots
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT $${i}
    `;

    values.push(maxCount);

    const res = await this.pool.query(sql, values);
    return res.rows.map((r) => r.payload as ReportingSnapshot);
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
      ORDER BY created_at DESC, id DESC
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
