// packages/core/src/repositories/InvoiceRepository.ts

import { Invoice, InvoiceId } from '../domain/Invoice';

export interface InvoiceSearchFilters {
  customerId?: string;
  status?: string;
  issuedFrom?: Date;
  issuedTo?: Date;
  invoiceNumber?: string;
  saleOrderId?: string;
}

export interface IInvoiceRepository {
  getById(id: InvoiceId): Promise<Invoice | null>;
  getByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null>;

  save(invoice: Invoice): Promise<void>;

  /**
   * Used by list projections or admin queries (repo implementation decides storage/indexing).
   * If you already have read models, keep heavy list queries out of the domain repo.
   */
  search(filters: InvoiceSearchFilters, limit?: number, offset?: number): Promise<Invoice[]>;
}
