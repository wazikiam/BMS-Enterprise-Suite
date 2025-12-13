// packages/core/src/domain/Invoice.ts

export type InvoiceId = string;

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export type CurrencyCode = 'MAD' | string;

export interface Money {
  amount: number; // minor-units policy is NOT assumed; you can switch later
  currency: CurrencyCode;
}

export interface InvoiceLine {
  lineId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  taxRate: number; // 0.0 -> 1.0
}

export interface InvoiceParties {
  customerId: string;
  customerName?: string;
  customerTaxId?: string;
}

export interface InvoiceTotals {
  subtotal: Money;
  taxTotal: Money;
  total: Money;
  paidTotal: Money;
  amountDue: Money;
}

export interface InvoiceSourceRefs {
  saleOrderId?: string;
}

export interface InvoiceProps {
  id: InvoiceId;
  invoiceNumber?: string; // assigned when issued
  status: InvoiceStatus;

  issuedAt?: Date;
  dueAt?: Date;
  cancelledAt?: Date;

  parties: InvoiceParties;
  currency: CurrencyCode;

  lines: InvoiceLine[];
  totals: InvoiceTotals;

  notes?: string;
  sourceRefs?: InvoiceSourceRefs;

  createdAt: Date;
  updatedAt: Date;
}

export class InvoiceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceInvariantError';
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvoiceInvariantError(message);
}

function round2(n: number): number {
  // If you later move to minor units, replace this.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(amount: number, currency: CurrencyCode): Money {
  return { amount: round2(amount), currency };
}

function sumMoney(items: Money[], currency: CurrencyCode): Money {
  const total = items.reduce((acc, m) => {
    assert(m.currency === currency, `Currency mismatch: expected ${currency}, got ${m.currency}`);
    return acc + m.amount;
  }, 0);
  return money(total, currency);
}

export class Invoice {
  private props: InvoiceProps;

  private constructor(props: InvoiceProps) {
    this.props = props;
    this.validate();
  }

  static createDraft(input: {
    id: InvoiceId;
    parties: InvoiceParties;
    currency?: CurrencyCode;
    lines?: InvoiceLine[];
    dueAt?: Date;
    notes?: string;
    sourceRefs?: InvoiceSourceRefs;
    now?: Date;
  }): Invoice {
    const now = input.now ?? new Date();
    const currency = input.currency ?? 'MAD';
    const lines = input.lines ?? [];

    const totals = Invoice.computeTotals({
      currency,
      lines,
      paidTotal: money(0, currency),
    });

    return new Invoice({
      id: input.id,
      status: InvoiceStatus.DRAFT,
      parties: input.parties,
      currency,
      lines,
      totals,
      dueAt: input.dueAt,
      notes: input.notes,
      sourceRefs: input.sourceRefs,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: InvoiceProps): Invoice {
    return new Invoice(props);
  }

  toJSON(): InvoiceProps {
    return { ...this.props };
  }

  get id(): InvoiceId {
    return this.props.id;
  }

  get status(): InvoiceStatus {
    return this.props.status;
  }

  get invoiceNumber(): string | undefined {
    return this.props.invoiceNumber;
  }

  get totals(): InvoiceTotals {
    return this.props.totals;
  }

  addLine(line: InvoiceLine, now: Date = new Date()): void {
    assert(this.props.status === InvoiceStatus.DRAFT, 'Can only edit lines while DRAFT');
    Invoice.validateLine(line, this.props.currency);
    this.props.lines = [...this.props.lines, line];
    this.recalculateTotals(now);
  }

  replaceLines(lines: InvoiceLine[], now: Date = new Date()): void {
    assert(this.props.status === InvoiceStatus.DRAFT, 'Can only replace lines while DRAFT');
    lines.forEach((l) => Invoice.validateLine(l, this.props.currency));
    this.props.lines = [...lines];
    this.recalculateTotals(now);
  }

  setDueAt(dueAt: Date, now: Date = new Date()): void {
    assert(this.props.status === InvoiceStatus.DRAFT, 'Can only set due date while DRAFT');
    this.props.dueAt = dueAt;
    this.touch(now);
  }

  issue(input: { invoiceNumber: string; issuedAt?: Date; now?: Date }): void {
    assert(this.props.status === InvoiceStatus.DRAFT, 'Only DRAFT invoices can be issued');
    assert(this.props.lines.length > 0, 'Cannot issue an invoice with no lines');
    assert(input.invoiceNumber && input.invoiceNumber.trim().length > 0, 'invoiceNumber is required');

    const now = input.now ?? new Date();
    this.props.invoiceNumber = input.invoiceNumber.trim();
    this.props.issuedAt = input.issuedAt ?? now;
    this.props.status = InvoiceStatus.ISSUED;
    this.touch(now);
  }

  cancel(reason?: string, now: Date = new Date()): void {
    assert(this.props.status !== InvoiceStatus.PAID, 'Cannot cancel a PAID invoice');
    assert(this.props.status !== InvoiceStatus.CANCELLED, 'Invoice already cancelled');

    this.props.status = InvoiceStatus.CANCELLED;
    this.props.cancelledAt = now;
    if (reason) {
      this.props.notes = this.props.notes ? `${this.props.notes}\nCANCEL: ${reason}` : `CANCEL: ${reason}`;
    }
    this.touch(now);
  }

  /**
   * Apply a payment allocation to this invoice. This is a domain-level total update.
   * The source of truth (Payment aggregate) stays in Payments module; invoice just tracks paid/amountDue.
   */
  applyPayment(amount: Money, now: Date = new Date()): void {
    assert(this.props.status === InvoiceStatus.ISSUED || this.props.status === InvoiceStatus.PAID, 'Invoice must be ISSUED/PAID to apply payment');
    assert(amount.currency === this.props.currency, 'Payment currency mismatch');
    assert(amount.amount > 0, 'Payment amount must be > 0');

    const currentPaid = this.props.totals.paidTotal.amount;
    const newPaid = round2(currentPaid + amount.amount);

    const total = this.props.totals.total.amount;
    const cappedPaid = newPaid > total ? total : newPaid;

    const paidTotal = money(cappedPaid, this.props.currency);
    const updatedTotals = Invoice.computeTotals({
      currency: this.props.currency,
      lines: this.props.lines,
      paidTotal,
    });

    this.props.totals = updatedTotals;
    this.props.status = updatedTotals.amountDue.amount === 0 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED;
    this.touch(now);
  }

  private recalculateTotals(now: Date): void {
    this.props.totals = Invoice.computeTotals({
      currency: this.props.currency,
      lines: this.props.lines,
      paidTotal: this.props.totals.paidTotal,
    });
    this.touch(now);
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }

  private validate(): void {
    assert(this.props.id && this.props.id.trim().length > 0, 'Invoice id is required');
    assert(this.props.parties?.customerId && this.props.parties.customerId.trim().length > 0, 'customerId is required');
    assert(this.props.currency && this.props.currency.trim().length > 0, 'currency is required');

    if (this.props.invoiceNumber) {
      assert(this.props.status !== InvoiceStatus.DRAFT, 'invoiceNumber should not exist while DRAFT');
    }
    if (this.props.status === InvoiceStatus.ISSUED || this.props.status === InvoiceStatus.PAID) {
      assert(!!this.props.issuedAt, 'issuedAt is required when ISSUED/PAID');
      assert(!!this.props.invoiceNumber, 'invoiceNumber is required when ISSUED/PAID');
    }
    if (this.props.status === InvoiceStatus.CANCELLED) {
      assert(!!this.props.cancelledAt, 'cancelledAt is required when CANCELLED');
    }

    this.props.lines.forEach((l) => Invoice.validateLine(l, this.props.currency));

    // totals consistency
    const computed = Invoice.computeTotals({
      currency: this.props.currency,
      lines: this.props.lines,
      paidTotal: this.props.totals.paidTotal,
    });

    const a = this.props.totals;
    assert(a.subtotal.currency === computed.subtotal.currency, 'totals currency mismatch');
    // We compare by amount with rounding tolerance
    const eq = (x: number, y: number) => Math.abs(round2(x) - round2(y)) < 0.0001;

    assert(eq(a.subtotal.amount, computed.subtotal.amount), 'subtotal mismatch');
    assert(eq(a.taxTotal.amount, computed.taxTotal.amount), 'taxTotal mismatch');
    assert(eq(a.total.amount, computed.total.amount), 'total mismatch');
    assert(eq(a.paidTotal.amount, computed.paidTotal.amount), 'paidTotal mismatch');
    assert(eq(a.amountDue.amount, computed.amountDue.amount), 'amountDue mismatch');
  }

  static validateLine(line: InvoiceLine, currency: CurrencyCode): void {
    assert(line.lineId && line.lineId.trim().length > 0, 'lineId is required');
    assert(line.description && line.description.trim().length > 0, 'line.description is required');
    assert(line.quantity > 0, 'line.quantity must be > 0');
    assert(line.unitPrice.currency === currency, 'line.unitPrice currency mismatch');
    assert(line.unitPrice.amount >= 0, 'line.unitPrice must be >= 0');
    assert(line.taxRate >= 0 && line.taxRate <= 1, 'line.taxRate must be between 0 and 1');
  }

  static computeTotals(input: { currency: CurrencyCode; lines: InvoiceLine[]; paidTotal: Money }): InvoiceTotals {
    const currency = input.currency;

    const lineSubtotals = input.lines.map((l) => money(l.quantity * l.unitPrice.amount, currency));
    const subtotal = sumMoney(lineSubtotals, currency);

    const lineTaxes = input.lines.map((l) => {
      const base = l.quantity * l.unitPrice.amount;
      return money(base * l.taxRate, currency);
    });
    const taxTotal = sumMoney(lineTaxes, currency);

    const total = money(subtotal.amount + taxTotal.amount, currency);

    assert(input.paidTotal.currency === currency, 'paidTotal currency mismatch');
    const paid = input.paidTotal.amount > total.amount ? total.amount : input.paidTotal.amount;
    const paidTotal = money(paid, currency);

    const amountDue = money(total.amount - paidTotal.amount, currency);

    return {
      subtotal,
      taxTotal,
      total,
      paidTotal,
      amountDue,
    };
  }
}
