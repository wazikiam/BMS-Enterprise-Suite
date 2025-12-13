// packages/core/src/services/InvoiceReceivablesService.ts

import { Customer } from '../domain/Customer';
import { CreditLimit } from '../domain/CreditLimit';
import { CustomerBalance } from '../domain/CustomerBalance';
import { InvoiceStatus } from '../domain/Invoice';

/**
 * InvoiceReceivablesService (READ-ONLY)
 * ------------------------------------
 * Invoice-based Accounts Receivable read model.
 *
 * HARD RULES:
 * - NO state mutation
 * - NO repository writes
 * - NO side effects
 */
export class InvoiceReceivablesService {
  constructor(
    private invoiceRepository: any,
    private customerRepository: any,
    private balanceRepository: any,
    private creditLimitRepository: any
  ) {}

  async getCustomerReceivable(customerId: string): Promise<CustomerReceivableSnapshot> {
    const customer: Customer | null = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const invoices = await this.findOpenInvoicesByCustomerId(customerId);

    const balance: CustomerBalance | null =
      await this.balanceRepository.findByCustomerId(customerId);

    const creditLimit: CreditLimit | null =
      await this.creditLimitRepository.findActiveByCustomerId(customerId);

    const aging = this.calculateAgingBuckets(invoices);

    const totalOutstanding = aging.totalOutstanding;
    const creditExposure = balance?.currentBalance ?? totalOutstanding;

    return {
      customerId,
      customerName: customer.name,
      totalOutstanding,
      aging,
      credit: {
        limit: creditLimit?.amount ?? 0,
        available: creditLimit?.availableCredit ?? 0,
        exposure: creditExposure,
        overLimit: creditLimit ? creditExposure > creditLimit.amount : false
      }
    };
  }

  async getAllReceivables(): Promise<ReceivablesOverview> {
    const customers: Customer[] = await this.customerRepository.findAllActive();

    const rows: CustomerReceivableSnapshot[] = [];

    for (const customer of customers) {
      const snapshot = await this.getCustomerReceivable(customer.id);
      if (snapshot.totalOutstanding > 0) {
        rows.push(snapshot);
      }
    }

    return {
      customers: rows,
      totals: this.aggregateTotals(rows)
    };
  }

  private async findOpenInvoicesByCustomerId(customerId: string): Promise<any[]> {
    if (typeof this.invoiceRepository.findOpenByCustomerId === 'function') {
      return await this.invoiceRepository.findOpenByCustomerId(customerId);
    }

    if (typeof this.invoiceRepository.search === 'function') {
      return await this.invoiceRepository.search(
        { customerId, status: InvoiceStatus.ISSUED },
        1000,
        0
      );
    }

    throw new Error('Invoice repository does not support search/findOpenByCustomerId');
  }

  private calculateAgingBuckets(invoices: any[]): AgingBuckets {
    const now = new Date();

    const buckets: AgingBuckets = {
      current: 0,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
      totalOutstanding: 0
    };

    for (const inv of invoices) {
      const p = typeof inv?.toJSON === 'function' ? inv.toJSON() : inv;
      if (!p || p.status !== InvoiceStatus.ISSUED) continue;

      const due = p?.totals?.amountDue?.amount ?? 0;
      if (due <= 0) continue;

      const baseDate = p.issuedAt ? new Date(p.issuedAt) : new Date(p.createdAt);
      const ageInDays = this.daysBetween(baseDate, now);

      if (ageInDays <= 30) buckets.current += due;
      else if (ageInDays <= 60) buckets.days31to60 += due;
      else if (ageInDays <= 90) buckets.days61to90 += due;
      else buckets.days90plus += due;

      buckets.totalOutstanding += due;
    }

    return buckets;
  }

  private aggregateTotals(rows: CustomerReceivableSnapshot[]): ReceivablesTotals {
    return rows.reduce(
      (acc, r) => {
        acc.totalOutstanding += r.totalOutstanding;
        acc.current += r.aging.current;
        acc.days31to60 += r.aging.days31to60;
        acc.days61to90 += r.aging.days61to90;
        acc.days90plus += r.aging.days90plus;
        acc.overLimitCustomers += r.credit.overLimit ? 1 : 0;
        return acc;
      },
      {
        totalOutstanding: 0,
        current: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        overLimitCustomers: 0
      }
    );
  }

  private daysBetween(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }
}

export interface AgingBuckets {
  current: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  totalOutstanding: number;
}

export interface CustomerReceivableSnapshot {
  customerId: string;
  customerName: string;
  totalOutstanding: number;
  aging: AgingBuckets;
  credit: {
    limit: number;
    available: number;
    exposure: number;
    overLimit: boolean;
  };
}

export interface ReceivablesTotals {
  totalOutstanding: number;
  current: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  overLimitCustomers: number;
}

export interface ReceivablesOverview {
  customers: CustomerReceivableSnapshot[];
  totals: ReceivablesTotals;
}
