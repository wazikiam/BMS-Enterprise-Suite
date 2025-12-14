// packages/server/src/api/InvoiceRepositoryAdapter.ts

import {
  IInvoiceRepository,
  InvoiceSearchFilters,
} from '@bms/core/src/repositories/InvoiceRepository';
import { Invoice, InvoiceId } from '@bms/core/src/domain/Invoice';

/**
 * Server-side infrastructure adapter for InvoiceRepository.
 *
 * Current implementation is READ-ONLY and SAFE:
 * - search() returns an empty result set
 * - used for reporting snapshot generation
 *
 * This allows KPI generation to function deterministically
 * until invoice persistence is fully wired.
 */
export class InvoiceRepositoryAdapter implements IInvoiceRepository {
  async getById(_id: InvoiceId): Promise<Invoice | null> {
    return null;
  }

  async getByInvoiceNumber(_invoiceNumber: string): Promise<Invoice | null> {
    return null;
  }

  async save(_invoice: Invoice): Promise<void> {
    // No-op: persistence not wired yet
    return;
  }

  async search(
    _filters: InvoiceSearchFilters,
    _limit?: number,
    _offset?: number
  ): Promise<Invoice[]> {
    // Read-only stub.
    // No invoices => KPIs evaluate to zero.
    return [];
  }
}
