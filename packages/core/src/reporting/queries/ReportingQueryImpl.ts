// packages/core/src/reporting/queries/ReportingQueryImpl.ts

import { ReportingQuery } from './ReportingQuery';
import { SalesKPIs } from '../dtos/SalesKPIs';
import { ARKPIs } from '../dtos/ARKPIs';
import { IInvoiceRepository } from '../../repositories/InvoiceRepository';
import { Invoice, InvoiceStatus } from '../../domain/Invoice';

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

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
      (invoice: Invoice) => invoice.status === InvoiceStatus.PAID
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

  async getARKPIs(asOf: Date): Promise<ARKPIs> {
    const invoices: Invoice[] = await this.invoiceRepository.search({});

    const openInvoices = invoices.filter((invoice) =>
      invoice.status === InvoiceStatus.ISSUED &&
      invoice.totals.amountDue.amount > 0
    );

    const totalOutstanding: number = openInvoices.reduce(
      (sum: number, invoice: Invoice) =>
        sum + invoice.totals.amountDue.amount,
      0
    );

    const overdueInvoices = openInvoices.filter((invoice) => {
      const dueAt = invoice.toJSON().dueAt;
      return dueAt !== undefined && dueAt.getTime() < asOf.getTime();
    });

    const overdueAmount: number = overdueInvoices.reduce(
      (sum: number, invoice: Invoice) =>
        sum + invoice.totals.amountDue.amount,
      0
    );

    const customersOverdue: number = new Set(
      overdueInvoices.map(i => i.toJSON().parties.customerId)
    ).size;

    const averageDaysOutstanding: number =
      openInvoices.length === 0
        ? 0
        : Math.round(
            openInvoices.reduce((sum: number, invoice: Invoice) => {
              const issuedAt = invoice.toJSON().issuedAt;
              if (!issuedAt) return sum;
              return sum + daysBetween(issuedAt, asOf);
            }, 0) / openInvoices.length
          );

    return {
      totalOutstanding,
      overdueAmount,
      customersOverdue,
      averageDaysOutstanding,
    };
  }
}
