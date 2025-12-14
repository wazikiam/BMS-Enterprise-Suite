// packages/core/src/reporting/queries/ReportingQueryImpl.ts

import { ReportingQuery } from './ReportingQuery';
import { SalesKPIs } from '../dtos/SalesKPIs';
import { ARKPIs } from '../dtos/ARKPIs';
import { IInvoiceRepository } from '../../repositories/InvoiceRepository';
import { Invoice } from '../../domain/Invoice';

/**
 * ReportingQueryImpl provides read-only reporting and analytics.
 * It must never mutate state or depend on command-side services.
 */
export class ReportingQueryImpl implements ReportingQuery {
  constructor(
    private readonly invoiceRepository: IInvoiceRepository
  ) {}

  async getSalesKPIs(params: {
    from: Date;
    to: Date;
  }): Promise<SalesKPIs> {
    const invoices: Invoice[] = await this.invoiceRepository.search({
      issuedFrom: params.from,
      issuedTo: params.to,
    });

    const totalInvoices: number = invoices.length;

    const totalSalesAmount: number = invoices.reduce(
      (sum: number, invoice: Invoice) =>
        sum + invoice.totals.total.amount,
      0
    );

    const paidInvoices: number = invoices.filter(
      (invoice: Invoice) => invoice.status === 'PAID'
    ).length;

    const unpaidInvoices: number = totalInvoices - paidInvoices;

    const averageInvoiceValue: number =
      totalInvoices === 0 ? 0 : totalSalesAmount / totalInvoices;

    return {
      totalSalesAmount,
      totalInvoices,
      averageInvoiceValue,
      paidInvoices,
      unpaidInvoices,
    };
  }

  async getARKPIs(_asOf: Date): Promise<ARKPIs> {
    throw new Error('Not implemented');
  }
}
