// packages/server/src/api/InvoiceRepositoryAdapter.ts

import { IInvoiceRepository, InvoiceSearchFilters } from '@bms/core/src/repositories/InvoiceRepository';
import { Invoice, InvoiceId } from '@bms/core/src/domain/Invoice';

/**
 * Server-side infrastructure adapter for InvoiceRepository.
 * This is a thin wrapper around the existing persistence mechanism.
 *
 * NOTE:
 * Replace method bodies with actual DB access when wiring persistence.
 */
export class InvoiceRepositoryAdapter implements IInvoiceRepository {
  async getById(_id: InvoiceId): Promise<Invoice | null> {
    throw new Error('InvoiceRepositoryAdapter.getById not implemented');
  }

  async getByInvoiceNumber(_invoiceNumber: string): Promise<Invoice | null> {
    throw new Error('InvoiceRepositoryAdapter.getByInvoiceNumber not implemented');
  }

  async save(_invoice: Invoice): Promise<void> {
    throw new Error('InvoiceRepositoryAdapter.save not implemented');
  }

  async search(
    _filters: InvoiceSearchFilters,
    _limit?: number,
    _offset?: number
  ): Promise<Invoice[]> {
    throw new Error('InvoiceRepositoryAdapter.search not implemented');
  }
}
