import { SaleOrder, SaleOrderStatus, PaymentType, DocumentType } from '../domain/SaleOrder';
import { SaleOrderLine } from '../domain/SaleOrderLine';
import { NotFoundError, BusinessRuleError } from '../errors/ApplicationError';
import { CreditLimitEnforcementService } from './CreditLimitEnforcementService';
import { UserRole } from '../domain/User';

/**
 * SaleOrderService — FINAL & LOCKED
 *
 * Responsibilities:
 * - Sale order lifecycle
 * - Stock reservation & release
 * - Credit policy enforcement (via CreditLimitEnforcementService)
 *
 * Explicitly does NOT:
 * - Handle payments
 * - Mutate balances
 * - Post ledger entries
 */
export class SaleOrderService {
  constructor(
    private saleOrderRepository: any,
    private customerRepository: any,
    private productRepository: any,
    private stockRepository: any,
    private creditEnforcementService: CreditLimitEnforcementService,
    private userRepository: any
  ) {}

  /* =====================================================
     CREATE
     ===================================================== */
  async createSaleOrder(dto: {
    customerId: string;
    orderDate: Date;
    deliveryDate?: Date;
    paymentType: PaymentType;
    notes?: string;
    paymentTerms?: string;
    shippingAddress?: string;
    billingAddress?: string;
    documentType: DocumentType;
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discountPercentage?: number;
      taxPercentage?: number;
      notes?: string;
    }>;
    createdById: string;
  }): Promise<SaleOrder> {
    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) throw NotFoundError.factory('Customer', dto.customerId);

    const creator = await this.userRepository.findById(dto.createdById);
    if (!creator) throw NotFoundError.factory('User', dto.createdById);

    await this.validateStock(dto.lines);

    const lines: SaleOrderLine[] = [];
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (const l of dto.lines) {
      const product = await this.productRepository.findById(l.productId);
      if (!product) throw NotFoundError.factory('Product', l.productId);

      const line = new SaleOrderLine({
        saleOrderId: '',
        productId: product.id!,
        product,
        productName: product.name,
        productCode: product.code,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercentage: l.discountPercentage || 0,
        taxPercentage: l.taxPercentage || 0,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        notes: l.notes
      });

      line.recalculateTotals();
      lines.push(line);

      subtotal += line.subtotal;
      taxAmount += line.taxAmount;
      discountAmount += l.quantity * l.unitPrice * (l.discountPercentage || 0) / 100;
    }

    const totalAmount = subtotal + taxAmount - discountAmount;

    const order = new SaleOrder({
      orderNumber: this.generateOrderNumber(),
      customerId: customer.id!,
      customer,
      orderDate: dto.orderDate,
      deliveryDate: dto.deliveryDate,
      status: SaleOrderStatus.DRAFT,
      paymentType: dto.paymentType,
      paymentStatus: 'pending',
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paidAmount: 0,
      dueAmount: totalAmount,
      notes: dto.notes,
      createdById: creator.id!,
      createdBy: creator,
      paymentTerms: dto.paymentTerms,
      shippingAddress: dto.shippingAddress || customer.shippingAddress,
      billingAddress: dto.billingAddress || customer.billingAddress,
      documentType: dto.documentType,
      lines,
      payments: []
    });

    if ([DocumentType.INVOICE, DocumentType.DELIVERY_NOTE].includes(dto.documentType)) {
      await this.reserveStock(order);
    }

    const saved = await this.saleOrderRepository.create(order);

    return saved;
  }

  /* =====================================================
   VALIDATE
   ===================================================== */
async validateSaleOrder(orderId: string, validatedById: string): Promise<SaleOrder> {
  const order = await this.saleOrderRepository.findById(orderId);
  if (!order) throw NotFoundError.factory('SaleOrder', orderId);

  const validator = await this.userRepository.findById(validatedById);
  if (!validator) throw NotFoundError.factory('User', validatedById);

  await this.validateStock(
    order.lines.map((l: SaleOrderLine) => ({
      productId: l.productId,
      quantity: l.quantity
    }))
  );

  if (order.paymentType === PaymentType.CREDIT) {
    const creditCheck = await this.creditEnforcementService.checkCreditLimit(
      order.customerId,
      order.totalAmount
    );

    if (!creditCheck.isAllowed) {
      order.updateStatus(SaleOrderStatus.CREDIT_HOLD);
      await this.saleOrderRepository.update(order);

      throw new BusinessRuleError(
        creditCheck.message || 'Credit limit exceeded',
        {
          ruleCode: 'CREDIT_LIMIT_EXCEEDED',
          resourceType: 'SaleOrder',
          resourceId: orderId,
          details: {
            requiresOverride: creditCheck.requiresOverride,
            overrideLevel: creditCheck.overrideLevel,
            suggestedActions: creditCheck.suggestedActions
          }
        }
      );
    }
  }

  order.updateStatus(SaleOrderStatus.VALIDATED, validatedById);
  return await this.saleOrderRepository.update(order);
}

  /* =====================================================
     CANCEL
     ===================================================== */
  async cancelSaleOrder(id: string, reason?: string): Promise<SaleOrder> {
    const order = await this.saleOrderRepository.findById(id);
    if (!order) throw NotFoundError.factory('SaleOrder', id);

    if (order.status === SaleOrderStatus.COMPLETED) {
      throw new BusinessRuleError('Cannot cancel completed order');
    }

    await this.releaseStock(order);

    order.updateStatus(SaleOrderStatus.CANCELLED);
    if (reason) {
      order.notes = order.notes ? `${order.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
    }

    return await this.saleOrderRepository.update(order);
  }

  /* =====================================================
     VALIDATIONS
     ===================================================== */
  private async validateStock(
    lines: Array<{ productId: string; quantity: number }>
  ): Promise<void> {
    for (const l of lines) {
      const product = await this.productRepository.findById(l.productId);
      if (!product || l.quantity > product.availableStock) {
        throw new BusinessRuleError('Insufficient stock', {
  ruleCode: 'INSUFFICIENT_STOCK',
  resourceType: 'Product',
  resourceId: l.productId,
  details: {
    requested: l.quantity,
    available: product?.availableStock || 0
  }
});
      }
    }
  }

  /* =====================================================
     STOCK
     ===================================================== */
  private async reserveStock(order: SaleOrder): Promise<void> {
    for (const line of order.lines) {
      await this.stockRepository.reserveStock(
        line.productId,
        line.quantity,
        order.id!,
        'SALE_ORDER'
      );
      line.reserveStock(line.quantity);
    }
  }

  private async releaseStock(order: SaleOrder): Promise<void> {
    for (const line of order.lines) {
      if (line.reservedStock && line.reservedStock > 0) {
        await this.stockRepository.releaseStock(
          line.productId,
          line.reservedStock,
          order.id!
        );
      }
    }
  }

  /* =====================================================
     HELPERS
     ===================================================== */
  private generateOrderNumber(): string {
    const ts = Date.now().toString().slice(-8);
    const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SO-${ts}-${rnd}`;
  }
}
