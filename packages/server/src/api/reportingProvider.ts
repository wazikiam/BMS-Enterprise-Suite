// packages/server/src/api/reportingProvider.ts

import { ReportingQuery } from '@bms/core/src/reporting/queries/ReportingQuery';
import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';

/**
 * Composition root for ReportingQuery.
 * Server wires infrastructure here, not in routes.
 */
export function createReportingQuery(): ReportingQuery {
  const invoiceRepository = new InvoiceRepositoryAdapter();
  return new ReportingQueryImpl(invoiceRepository);
}
