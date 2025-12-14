import crypto from 'crypto';
import { Pool } from 'pg';

import { FinancialPeriod } from '@bms/core/src/domain/financial-period/FinancialPeriod';
import { FinancialPeriodState } from '@bms/core/src/domain/financial-period/FinancialPeriodState';

/**
 * Command service for financial period lifecycle.
 *
 * - Executes OPEN / CLOSE / REOPEN commands
 * - Persists transitions as append-only facts
 * - No updates, no deletes
 */
export class FinancialPeriodCommandService {
  constructor(private readonly pool: Pool) {}

  async openPeriod(params: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    const period = FinancialPeriod.open(params);

    await this.persist(period);
  }

  async closePeriod(current: FinancialPeriod): Promise<void> {
    const closed = current.close();

    await this.persist(closed);
  }

  async reopenPeriod(current: FinancialPeriod): Promise<void> {
    const reopened = current.reopen();

    await this.persist(reopened);
  }

  private async persist(period: FinancialPeriod): Promise<void> {
    const payload = {
      id: period.id,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      state: period.state,
    };

    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload), 'utf8')
      .digest('hex');

    const sql = `
      INSERT INTO financial_periods (
        id,
        period_start,
        period_end,
        state,
        checksum
      )
      VALUES ($1, $2, $3, $4, $5)
    `;

    await this.pool.query(sql, [
      period.id,
      period.periodStart,
      period.periodEnd,
      period.state,
      checksum,
    ]);
  }
}
