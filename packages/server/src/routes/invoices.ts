// packages/server/src/routes/invoices.ts

import { Router } from 'express';

type InvoiceRoutesDeps = {
  invoiceService: {
    createDraft(input: any): Promise<any>;
    issue(invoiceId: string): Promise<any>;
    cancel(invoiceId: string, reason?: string): Promise<any>;
  };
  invoiceQuery: {
    list(filters: any): Promise<any[]>;
    get(id: string): Promise<any | null>;
  };
  idGen: {
    newId(): string;
  };
};

export function buildInvoiceRouter(deps: InvoiceRoutesDeps): Router {
  const r = Router();

  // Create draft invoice
  r.post('/', async (req, res) => {
    try {
      const id = deps.idGen.newId();

      const {
        customerId,
        customerName,
        currency,
        lines,
        dueAt,
        notes,
        saleOrderId,
      } = req.body ?? {};

      if (!customerId) return res.status(400).json({ error: 'customerId is required' });

      const invoice = await deps.invoiceService.createDraft({
        id,
        customerId,
        customerName,
        currency,
        lines,
        dueAt: dueAt ? new Date(dueAt) : undefined,
        notes,
        saleOrderId,
      });

      return res.status(201).json(invoice);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? 'Failed to create invoice' });
    }
  });

  // Issue invoice (assign number)
  r.post('/:id/issue', async (req, res) => {
    try {
      const invoice = await deps.invoiceService.issue(req.params.id);
      return res.status(200).json(invoice);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? 'Failed to issue invoice' });
    }
  });

  // Cancel invoice
  r.post('/:id/cancel', async (req, res) => {
    try {
      const reason = req.body?.reason;
      const invoice = await deps.invoiceService.cancel(req.params.id, reason);
      return res.status(200).json(invoice);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? 'Failed to cancel invoice' });
    }
  });

  // List invoices (read model)
  r.get('/', async (req, res) => {
    try {
      const filters = {
        customerId: req.query.customerId,
        status: req.query.status,
        issuedFrom: req.query.issuedFrom,
        issuedTo: req.query.issuedTo,
        invoiceNumber: req.query.invoiceNumber,
        saleOrderId: req.query.saleOrderId,
      };
      const rows = await deps.invoiceQuery.list(filters);
      return res.status(200).json(rows);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? 'Failed to list invoices' });
    }
  });

  // Invoice detail (read model)
  r.get('/:id', async (req, res) => {
    try {
      const row = await deps.invoiceQuery.get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Invoice not found' });
      return res.status(200).json(row);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? 'Failed to load invoice' });
    }
  });

  return r;
}
