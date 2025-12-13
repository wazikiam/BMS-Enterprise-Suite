// packages/core/src/services/SalesSummaryService.ts

import { SaleOrder, SaleOrderStatus, PaymentType } from '../domain/SaleOrder';

/**
 * SalesSummaryService (READ-ONLY)
 * --------------------------------
 * Reporting read model for sales performance.
 *
 * Responsibilities:
 * - Sales totals by date range
 * - Paid vs unpaid split
 * - Cash vs credit split
 * - Order counts + average order value
 *
 * HARD RULES:
 * - NO state mutation
 * - NO repository writes
 * - NO side effects
 *
 * Notes:
 * - Repositories are typed as `any` intentionally to keep core compile-safe
 *   while you evolve persistence adapters.
 */
export class SalesSummaryService {
  constructor(private saleOrderRepository: any) {}

  /**
   * Daily summary for a specific date (local time).
   */
  async getDailySummary(date: Date): Promise<SalesSummary> {
    const { start, end } = this.getDayRange(date);
    return this.getSummaryForRange(start, end);
  }

  /**
   * Monthly summary for a given year + month (1-12).
   */
  async getMonthlySummary(year: number, month: number): Promise<SalesSummary> {
    const { start, end } = this.getMonthRange(year, month);
    return this.getSummaryForRange(start, end);
  }

  /**
   * Generic summary for any [start, end) range.
   * - start inclusive
   * - end exclusive
   */
  async getSummaryForRange(start: Date, end: Date): Promise<SalesSummary> {
    const orders = await this.fetchOrdersForRange(start, end);

    const included = orders.filter(o => this.isReportableOrder(o));

    const totals: SalesSummary = {
      range: { start, end },
      currency: 'MAD',
      orderCount: included.length,
      grossSales: 0,
      netSales: 0,
      taxTotal: 0,
      discountTotal: 0,
      paidTotal: 0,
      dueTotal: 0,
      averageOrderValue: 0,
      byPaymentType: {
        cash: { orderCount: 0, netSales: 0, paidTotal: 0, dueTotal: 0 },
        credit: { orderCount: 0, netSales: 0, paidTotal: 0, dueTotal: 0 },
        other: { orderCount: 0, netSales: 0, paidTotal: 0, dueTotal: 0 }
      },
      byPaymentStatus: {
        pending: { orderCount: 0, dueTotal: 0 },
        partial: { orderCount: 0, dueTotal: 0 },
        paid: { orderCount: 0, dueTotal: 0 },
        overdue: { orderCount: 0, dueTotal: 0 }
      }
    };

    for (const o of included) {
      const subtotal = this.n(o.subtotal);
      const tax = this.n(o.taxAmount);
      const discount = this.n(o.discountAmount);
      const total = this.n(o.totalAmount);
      const paid = this.n(o.paidAmount);
      const due = this.n(o.dueAmount);

      // Gross sales: subtotal + tax (before discount)
      totals.grossSales += subtotal + tax;
      // Net sales: what customer owes total (after discount)
      totals.netSales += total;

      totals.taxTotal += tax;
      totals.discountTotal += discount;
      totals.paidTotal += paid;
      totals.dueTotal += due;

      // Payment type split (cash vs credit vs other)
      const bucket = this.mapPaymentTypeToBucket(o.paymentType);
      totals.byPaymentType[bucket].orderCount += 1;
      totals.byPaymentType[bucket].netSales += total;
      totals.byPaymentType[bucket].paidTotal += paid;
      totals.byPaymentType[bucket].dueTotal += due;

      // Payment status split
      const ps = this.normalizePaymentStatus((o as any).paymentStatus);
      totals.byPaymentStatus[ps].orderCount += 1;
      totals.byPaymentStatus[ps].dueTotal += due;
    }

    totals.averageOrderValue =
      totals.orderCount > 0 ? totals.netSales / totals.orderCount : 0;

    // Round to 2 decimals for stability in UI/exports
    return this.roundSummary(totals);
  }

  /* =====================================================
     FETCH / FILTER
     ===================================================== */

  private async fetchOrdersForRange(start: Date, end: Date): Promise<SaleOrder[]> {
    // Preferred repository method signatures (adapters can implement any of these):
    // - findByDateRange(start, end)
    // - findByOrderDateRange(start, end)
    // - findBetweenDates(start, end)
    // - listAll() + filtering (fallback)
    const repo = this.saleOrderRepository;

    if (repo?.findByDateRange) return repo.findByDateRange(start, end);
    if (repo?.findByOrderDateRange) return repo.findByOrderDateRange(start, end);
    if (repo?.findBetweenDates) return repo.findBetweenDates(start, end);

    const all: SaleOrder[] = repo?.listAll ? await repo.listAll() : [];
    return all.filter(o => {
      const d = new Date(o.orderDate);
      return d >= start && d < end;
    });
  }

  /**
   * Reportable orders:
   * - exclude CANCELLED
   * - exclude DRAFT (not a real sale yet)
   * - keep CONFIRMED/VALIDATED/PARTIALLY_PAID/FULLY_PAID/COMPLETED/CREDIT_HOLD
   */
  private isReportableOrder(order: SaleOrder): boolean {
    if (order.status === SaleOrderStatus.CANCELLED) return false;
    if (order.status === SaleOrderStatus.DRAFT) return false;
    return true;
  }

  /* =====================================================
     DATE RANGES
     ===================================================== */

  private getDayRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  }

  private getMonthRange(year: number, month: number): { start: Date; end: Date } {
    // month is 1-12 for caller ergonomics
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);
    return { start, end };
  }

  /* =====================================================
     HELPERS
     ===================================================== */

  private mapPaymentTypeToBucket(
    pt: PaymentType
  ): keyof SalesSummary['byPaymentType'] {
    if (pt === PaymentType.CASH) return 'cash';
    if (pt === PaymentType.CREDIT) return 'credit';
    return 'other';
  }

  private normalizePaymentStatus(
    status: any
  ): keyof SalesSummary['byPaymentStatus'] {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'partial':
        return 'partial';
      case 'paid':
        return 'paid';
      case 'overdue':
        return 'overdue';
      default:
        // Safe default: if unknown, treat as pending
        return 'pending';
    }
  }

  private n(v: any): number {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  private r2(v: number): number {
    return Math.round(v * 100) / 100;
  }

  private roundSummary(s: SalesSummary): SalesSummary {
    return {
      ...s,
      grossSales: this.r2(s.grossSales),
      netSales: this.r2(s.netSales),
      taxTotal: this.r2(s.taxTotal),
      discountTotal: this.r2(s.discountTotal),
      paidTotal: this.r2(s.paidTotal),
      dueTotal: this.r2(s.dueTotal),
      averageOrderValue: this.r2(s.averageOrderValue),
      byPaymentType: {
        cash: {
          orderCount: s.byPaymentType.cash.orderCount,
          netSales: this.r2(s.byPaymentType.cash.netSales),
          paidTotal: this.r2(s.byPaymentType.cash.paidTotal),
          dueTotal: this.r2(s.byPaymentType.cash.dueTotal)
        },
        credit: {
          orderCount: s.byPaymentType.credit.orderCount,
          netSales: this.r2(s.byPaymentType.credit.netSales),
          paidTotal: this.r2(s.byPaymentType.credit.paidTotal),
          dueTotal: this.r2(s.byPaymentType.credit.dueTotal)
        },
        other: {
          orderCount: s.byPaymentType.other.orderCount,
          netSales: this.r2(s.byPaymentType.other.netSales),
          paidTotal: this.r2(s.byPaymentType.other.paidTotal),
          dueTotal: this.r2(s.byPaymentType.other.dueTotal)
        }
      },
      byPaymentStatus: {
        pending: {
          orderCount: s.byPaymentStatus.pending.orderCount,
          dueTotal: this.r2(s.byPaymentStatus.pending.dueTotal)
        },
        partial: {
          orderCount: s.byPaymentStatus.partial.orderCount,
          dueTotal: this.r2(s.byPaymentStatus.partial.dueTotal)
        },
        paid: {
          orderCount: s.byPaymentStatus.paid.orderCount,
          dueTotal: this.r2(s.byPaymentStatus.paid.dueTotal)
        },
        overdue: {
          orderCount: s.byPaymentStatus.overdue.orderCount,
          dueTotal: this.r2(s.byPaymentStatus.overdue.dueTotal)
        }
      }
    };
  }
}

/* =====================================================
   TYPES
   ===================================================== */

export interface SalesSummary {
  range: { start: Date; end: Date };
  currency: string;

  orderCount: number;

  // Gross = subtotal + tax (before discount)
  grossSales: number;

  // Net = totalAmount (after discount)
  netSales: number;

  taxTotal: number;
  discountTotal: number;

  // These are derived from the SaleOrder projection fields
  paidTotal: number;
  dueTotal: number;

  averageOrderValue: number;

  byPaymentType: {
    cash: SalesBucket;
    credit: SalesBucket;
    other: SalesBucket;
  };

  byPaymentStatus: {
    pending: StatusBucket;
    partial: StatusBucket;
    paid: StatusBucket;
    overdue: StatusBucket;
  };
}

export interface SalesBucket {
  orderCount: number;
  netSales: number;
  paidTotal: number;
  dueTotal: number;
}

export interface StatusBucket {
  orderCount: number;
  dueTotal: number;
}
