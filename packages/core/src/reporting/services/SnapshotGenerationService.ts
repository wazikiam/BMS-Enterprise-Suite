// packages/core/src/reporting/services/SnapshotGenerationService.ts

import { ReportingSnapshot } from '../dtos/ReportingSnapshot';
import { ReportingQuery } from '../queries/ReportingQuery';
import { IReportingSnapshotRepository } from '../repositories/ReportingSnapshotRepository';

/**
 * SnapshotGenerationService orchestrates the creation
 * of immutable reporting snapshots.
 *
 * This service contains NO business logic.
 * It only coordinates existing read models.
 */
export class SnapshotGenerationService {
  constructor(
    private readonly reportingQuery: ReportingQuery,
    private readonly snapshotRepository: IReportingSnapshotRepository
  ) {}

  async generate(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
    snapshotId: string;
    now?: Date;
  }): Promise<ReportingSnapshot> {
    const generatedAt = params.now ?? new Date();

    const sales = await this.reportingQuery.getSalesKPIs({
      from: params.periodFrom,
      to: params.periodTo,
    });

    const accountsReceivable = await this.reportingQuery.getARKPIs(params.asOf);

    const snapshot: ReportingSnapshot = {
      snapshotId: params.snapshotId,
      version: 1,
      period: {
        from: params.periodFrom,
        to: params.periodTo,
      },
      asOf: params.asOf,
      generatedAt,
      sales,
      accountsReceivable,
    };

    await this.snapshotRepository.append(snapshot);

    return snapshot;
  }
}
