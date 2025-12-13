import { SaleOrder, SaleOrderStatus } from '../domain/SaleOrder';
import { Payment, PaymentStatus } from '../domain/Payment';
import { NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

/**
 * SaleOrderPaymentProjectionService
 * --------------------------------
 * SINGLE RESPONSIBILITY:
 * - Project Payment events onto SaleOrder financial state
 *
 * HARD RULES:
 * - Does NOT create or process payments
 * - Does NOT touch ledger / balances
 * - Does NOT enforce credit rules
 * - Does NOT change stock
 *
 * This service is the ONLY allowed writer of:
 * - SaleOrder.paidAmount
 * - SaleOrder.dueAmount
 * - SaleOrder.paymentStatus
 * - SaleOrder.status (payment-related transitions only)
 */
export class SaleOrderPaymentProjectionService {
  constructor(private saleOrderRepository: any) {}

  /* =====================================================
     APPLY PAYMENT
     ===================================================== */
  async applyPayment(payment: Payment): Promise<SaleOrder> {
    if (payment.status !== PaymentStatus.PENDING &&
        payment.status !== PaymentStatus.COMPLETED) {
      throw new BusinessRuleError(
        `Cannot project payment with status ${payment.status}`
      );
    }

    const order = await this.saleOrderRepository.findById(payment.saleOrderId);
    if (!order) {
      throw new NotFoundError('SaleOrder', payment.saleOrderId);
    }

    const previousPaid = order.paidAmount;
    const newPaid = previousPaid + payment.paidAmount;

    if (newPaid > order.totalAmount + 0.01) {
      throw new BusinessRuleError(
        'Projected payment exceeds sale order total',
        {
          resourceType: 'SaleOrder',
          resourceId: order.id
        }
      );
    }

    order.paidAmount = newPaid;
    order.dueAmount = order.totalAmount - order.paidAmount;

    if (order.paidAmount <= 0) {
      order.paymentStatus = 'pending';
    } else if (order.dueAmount > 0) {
      order.paymentStatus = 'partial';
      order.status = SaleOrderStatus.PARTIALLY_PAID;
    } else {
      order.paymentStatus = 'paid';
      order.status = SaleOrderStatus.FULLY_PAID;
    }

    return this.saleOrderRepository.update(order);
  }

  /* =====================================================
     APPLY REFUND
     ===================================================== */
  async applyRefund(payment: Payment, refundAmount: number): Promise<SaleOrder> {
    if (refundAmount <= 0) {
      throw new BusinessRuleError('Refund amount must be positive');
    }

    const order = await this.saleOrderRepository.findById(payment.saleOrderId);
    if (!order) {
      throw new NotFoundError('SaleOrder', payment.saleOrderId);
    }

    if (refundAmount > order.paidAmount) {
      throw new BusinessRuleError(
        'Refund exceeds paid amount on order',
        {
          resourceType: 'SaleOrder',
          resourceId: order.id
        }
      );
    }

    order.paidAmount -= refundAmount;
    order.dueAmount = order.totalAmount - order.paidAmount;

    if (order.paidAmount <= 0) {
      order.paymentStatus = 'pending';
      order.status = SaleOrderStatus.VALIDATED;
    } else {
      order.paymentStatus = 'partial';
      order.status = SaleOrderStatus.PARTIALLY_PAID;
    }

    return this.saleOrderRepository.update(order);
  }
}
