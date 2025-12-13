import { Request, Response } from 'express';
import { SaleOrderService, CreateSaleOrderDTO, UpdateSaleOrderDTO, AddPaymentDTO } from '../../../core/services/SaleOrderService';
import { SaleOrderStatus, PaymentType, DocumentType } from '../../../core/domain/SaleOrder';
import { PaymentMethod } from '../../../core/domain/Payment';
import { NotFoundError, ValidationError, BusinessRuleError } from '../../../core/errors/ApplicationError';
import { validateSaleOrderCreate, validateSaleOrderUpdate, validatePaymentCreate } from './sales.validator';

export class SalesController {
  constructor(private saleOrderService: SaleOrderService) {}

  /**
   * Create a new sale order
   */
  async createSaleOrder(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validationResult = validateSaleOrderCreate(req.body);
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const dto: CreateSaleOrderDTO = {
        customerId: req.body.customerId,
        orderDate: new Date(req.body.orderDate),
        deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : undefined,
        paymentType: req.body.paymentType as PaymentType,
        notes: req.body.notes,
        paymentTerms: req.body.paymentTerms,
        shippingAddress: req.body.shippingAddress,
        billingAddress: req.body.billingAddress,
        documentType: req.body.documentType as DocumentType,
        lines: req.body.lines.map((line: any) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercentage: line.discountPercentage || 0,
          taxPercentage: line.taxPercentage || 0,
          notes: line.notes
        })),
        createdById: req.user?.id || 'system' // Assuming user is attached by auth middleware
      };

      const saleOrder = await this.saleOrderService.createSaleOrder(dto);

      res.status(201).json({
        success: true,
        data: saleOrder.toJSON(),
        message: 'Sale order created successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof BusinessRuleError) {
        res.status(400).json({
          success: false,
          error: error.message,
          details: error.details
        });
      } else if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error creating sale order:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get sale order by ID
   */
  async getSaleOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const saleOrder = await this.saleOrderService.getSaleOrderById(id);

      res.status(200).json({
        success: true,
        data: saleOrder.toJSON()
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error getting sale order:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Update sale order
   */
  async updateSaleOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate request body
      const validationResult = validateSaleOrderUpdate(req.body);
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const dto: UpdateSaleOrderDTO = {
        deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : undefined,
        notes: req.body.notes,
        paymentTerms: req.body.paymentTerms,
        shippingAddress: req.body.shippingAddress,
        billingAddress: req.body.billingAddress
      };

      const saleOrder = await this.saleOrderService.updateSaleOrder(id, dto);

      res.status(200).json({
        success: true,
        data: saleOrder.toJSON(),
        message: 'Sale order updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof BusinessRuleError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error updating sale order:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Validate sale order (move to validated status)
   */
  async validateSaleOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedById = req.user?.id || 'system';

      const saleOrder = await this.saleOrderService.validateSaleOrder(id, validatedById);

      res.status(200).json({
        success: true,
        data: saleOrder.toJSON(),
        message: 'Sale order validated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof BusinessRuleError) {
        res.status(400).json({
          success: false,
          error: error.message,
          details: error.details
        });
      } else {
        console.error('Error validating sale order:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Cancel sale order
   */
  async cancelSaleOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const saleOrder = await this.saleOrderService.cancelSaleOrder(id, reason);

      res.status(200).json({
        success: true,
        data: saleOrder.toJSON(),
        message: 'Sale order cancelled successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof BusinessRuleError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error cancelling sale order:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Add payment to sale order
   */
  async addPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate request body
      const validationResult = validatePaymentCreate(req.body);
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
        return;
      }

      const dto: AddPaymentDTO = {
        saleOrderId: id,
        amount: req.body.amount,
        method: req.body.method as PaymentMethod,
        paymentDate: new Date(req.body.paymentDate),
        reference: req.body.reference,
        notes: req.body.notes,
        collectedById: req.user?.id || 'system',
        bankName: req.body.bankName,
        checkNumber: req.body.checkNumber,
        transactionId: req.body.transactionId
      };

      const payment = await this.saleOrderService.addPayment(dto);

      res.status(201).json({
        success: true,
        data: payment.toJSON(),
        message: 'Payment added successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof BusinessRuleError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error adding payment:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Process payment (record actual payment collection)
   */
  async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { paidAmount, validatedById } = req.body;

      if (typeof paidAmount !== 'number' || paidAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid paidAmount is required'
        });
        return;
      }

      const payment = await this.saleOrderService.processPayment(
        paymentId,
        paidAmount,
        validatedById || req.user?.id
      );

      res.status(200).json({
        success: true,
        data: payment.toJSON(),
        message: 'Payment processed successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof BusinessRuleError || error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error processing payment:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get sale orders by customer
   */
  async getOrdersByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { status } = req.query;

      const orders = await this.saleOrderService.getOrdersByCustomer(
        customerId,
        status as SaleOrderStatus
      );

      res.status(200).json({
        success: true,
        data: orders.map(order => order.toJSON())
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error getting customer orders:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get sale orders by date range
   */
  async getOrdersByDateRange(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const orders = await this.saleOrderService.getOrdersByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        success: true,
        data: orders.map(order => order.toJSON()),
        count: orders.length
      });
    } catch (error) {
      console.error('Error getting orders by date range:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get sales report
   */
  async getSalesReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const report = await this.saleOrderService.getSalesReport(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error getting sales report:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Validate stock for sale order lines
   */
  async validateStock(req: Request, res: Response): Promise<void> {
    try {
      const { lines } = req.body;

      if (!Array.isArray(lines)) {
        res.status(400).json({
          success: false,
          error: 'lines array is required'
        });
        return;
      }

      const validationResult = await this.saleOrderService.validateStock(lines);

      res.status(200).json({
        success: true,
        data: validationResult
      });
    } catch (error) {
      console.error('Error validating stock:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Validate credit limit for customer
   */
  async validateCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { lines } = req.body;

      if (!Array.isArray(lines)) {
        res.status(400).json({
          success: false,
          error: 'lines array is required'
        });
        return;
      }

      const validationResult = await this.saleOrderService.validateCreditLimit(customerId, lines);

      res.status(200).json({
        success: true,
        data: validationResult
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Error validating credit limit:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * List all sale orders with pagination
   */
  async listSaleOrders(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, status, customerId, startDate, endDate } = req.query;
      
      // Note: In a real implementation, you would have a repository method for paginated listing
      // For now, we'll return a placeholder response
      res.status(200).json({
        success: true,
        data: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0,
          data: []
        },
        message: 'List endpoint - implementation pending'
      });
    } catch (error) {
      console.error('Error listing sale orders:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

// Factory function to create controller instance
export function createSalesController(
  saleOrderService: SaleOrderService
): SalesController {
  return new SalesController(saleOrderService);
} 
