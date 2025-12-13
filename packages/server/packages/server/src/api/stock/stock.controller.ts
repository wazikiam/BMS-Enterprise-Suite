/**
 * Stock API Controller
 * REST API endpoints for Stock Management
 * 
 * BUSINESS RULES:
 * - Real-time stock tracking
 * - Stock movements audit trail
 * - Low stock alerts system
 * - Stock reservations for sales
 * 
 * DESIGN RULES:
 * - Express.js controller pattern
 * - TypeScript strict mode
 * - Role-based access control
 */
import { Request, Response, NextFunction } from 'express';
import { StockService } from '../../../core/src/services/StockService';
import { StockMovementType } from '../../../core/src/domain/StockMovement';
import { ValidationError, NotFoundError } from '../../../core/src/errors/ApplicationError';
import { authenticate, authorize } from '../auth/auth.middleware';

export class StockController {
  private stockService: StockService;

  constructor(stockService: StockService) {
    this.stockService = stockService;
  }

  /**
   * Get stock level for product
   * ACCESS: All authenticated users
   */
  getStockLevel = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { productId } = req.params;
        const { locationId = 'default' } = req.query;
        
        const stockLevel = await this.stockService.getStockLevel(
          productId, 
          locationId as string
        );
        
        res.status(200).json({
          success: true,
          data: stockLevel
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return res.status(404).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Create stock movement
   * ACCESS: Admin, Manager
   */
  createMovement = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const movementData = req.body;
        
        // Validation
        if (!movementData.productId || movementData.quantityChange === undefined) {
          return res.status(400).json({
            success: false,
            error: 'productId and quantityChange are required'
          });
        }

        const movement = await this.stockService.createMovement({
          ...movementData,
          userId: req.user?.id || 'system'
        });
        
        res.status(201).json({
          success: true,
          data: movement,
          message: 'Stock movement created successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get product stock movements
   * ACCESS: All authenticated users
   */
  getProductMovements = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { productId } = req.params;
        const {
          startDate,
          endDate,
          movementType,
          page = '1',
          limit = '50'
        } = req.query;

        // Parse dates
        let parsedStartDate: Date | undefined;
        let parsedEndDate: Date | undefined;
        
        if (startDate) {
          parsedStartDate = new Date(startDate as string);
          if (isNaN(parsedStartDate.getTime())) {
            return res.status(400).json({
              success: false,
              error: 'Invalid startDate format'
            });
          }
        }
        
        if (endDate) {
          parsedEndDate = new Date(endDate as string);
          if (isNaN(parsedEndDate.getTime())) {
            return res.status(400).json({
              success: false,
              error: 'Invalid endDate format'
            });
          }
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const take = parseInt(limit as string);

        const result = await this.stockService.getProductMovements(productId, {
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          movementType: movementType as StockMovementType,
          skip,
          take
        });

        res.status(200).json({
          success: true,
          data: result.movements,
          pagination: {
            page: parseInt(page as string),
            limit: take,
            total: result.total,
            pages: Math.ceil(result.total / take)
          }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Adjust stock quantity
   * ACCESS: Admin, Manager
   */
  adjustStock = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { productId } = req.params;
        const { quantity, reason, movementType } = req.body;
        
        if (quantity === undefined || typeof quantity !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Quantity is required and must be a number'
          });
        }

        const movement = await this.stockService.adjustStock(productId, quantity, {
          movementType,
          userId: req.user?.id || 'system',
          notes: reason
        });
        
        res.status(200).json({
          success: true,
          data: movement,
          message: `Stock adjusted by ${quantity > 0 ? '+' : ''}${quantity}`
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get active stock alerts
   * ACCESS: Admin, Manager
   */
  getActiveAlerts = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const alerts = await this.stockService.getActiveStockAlerts();
        
        res.status(200).json({
          success: true,
          data: alerts,
          count: alerts.length
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Acknowledge stock alert
   * ACCESS: Admin, Manager
   */
  acknowledgeAlert = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { alertId } = req.params;
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }

        const alert = await this.stockService.acknowledgeStockAlert(alertId, userId);
        
        res.status(200).json({
          success: true,
          data: alert,
          message: 'Alert acknowledged successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Check low stock alerts (manual trigger)
   * ACCESS: Admin only
   */
  checkLowStock = [
    authenticate,
    authorize(['admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const newAlerts = await this.stockService.checkLowStockAlerts();
        
        res.status(200).json({
          success: true,
          data: newAlerts,
          message: `Created ${newAlerts.length} new low stock alerts`
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get inventory valuation
   * ACCESS: Admin, Manager
   */
  getInventoryValue = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const value = await this.stockService.getInventoryValuation();
        
        res.status(200).json({
          success: true,
          data: {
            value,
            currency: 'MAD'
          }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get stock summary for dashboard
   * ACCESS: Admin, Manager
   */
  getStockSummary = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const summary = await this.stockService.getStockSummary();
        
        res.status(200).json({
          success: true,
          data: summary
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Reserve stock for sale (Week 4 preparation)
   * ACCESS: Admin, Manager, Seller
   */
  reserveStock = [
    authenticate,
    authorize(['admin', 'manager', 'seller']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { productId } = req.params;
        const { quantity, saleOrderId } = req.body;
        
        if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Valid quantity is required'
          });
        }

        if (!saleOrderId) {
          return res.status(400).json({
            success: false,
            error: 'saleOrderId is required'
          });
        }

        const reservation = await this.stockService.reserveStock(
          productId,
          quantity,
          saleOrderId
        );
        
        res.status(201).json({
          success: true,
          data: reservation,
          message: `Stock reserved: ${quantity} units`
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Release stock reservation
   * ACCESS: Admin, Manager, Seller
   */
  releaseReservation = [
    authenticate,
    authorize(['admin', 'manager', 'seller']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reservationId } = req.params;
        const reservation = await this.stockService.releaseStockReservation(reservationId);
        
        res.status(200).json({
          success: true,
          data: reservation,
          message: 'Stock reservation released'
        });
      } catch (error) {
        next(error);
      }
    }
  ];
}

export default StockController; 
