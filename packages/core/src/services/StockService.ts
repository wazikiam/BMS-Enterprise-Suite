/**
 * Stock Service
 * Business logic layer for Stock Management
 * 
 * BUSINESS RULES:
 * - Real-time stock tracking for 2000+ products
 * - Stock cannot go negative
 * - Low stock alerts system
 * - Stock movements audit trail
 * - Stock reservations for sales (Week 4)
 * 
 * DESIGN RULES:
 * - Transaction-safe operations
 * - Optimized for high-frequency updates
 * - Real-time validation support
 */
import { 
  StockMovement, 
  StockMovementType, 
  StockMovementStatus,
  StockLevel,
  StockAlert,
  StockReservation 
} from '../domain/StockMovement';
import { StockRepository } from '../repositories/StockRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { ValidationError, NotFoundError } from '../errors/ApplicationError';

export class StockService {
  private stockRepository: StockRepository;
  private productRepository: ProductRepository;

  constructor(
    stockRepository: StockRepository,
    productRepository: ProductRepository
  ) {
    this.stockRepository = stockRepository;
    this.productRepository = productRepository;
  }

  /**
   * Create stock movement with validation
   * BUSINESS RULES:
   * - Stock cannot go negative
   * - Product must exist
   * - Movement type must be valid
   */
  async createMovement(movementData: Omit<StockMovement, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockMovement> {
    // Validate product exists
    const product = await this.productRepository.getProductById(movementData.productId);
    if (!product) {
      throw NotFoundError.product(movementData.productId);
    }

    // Validate movement type
    if (!Object.values(StockMovementType).includes(movementData.movementType)) {
      throw new ValidationError(`Invalid movement type: ${movementData.movementType}`);
    }

    // Fix missing required properties
    const completeMovementData: Omit<StockMovement, 'id' | 'createdAt' | 'updatedAt'> = {
      productId: movementData.productId,
      variantId: movementData.variantId,
      movementType: movementData.movementType,
      status: StockMovementStatus.COMPLETED,
      quantityBefore: 0, // Will be set by repository
      quantityChange: movementData.quantityChange,
      quantityAfter: 0, // Will be set by repository
      referenceId: movementData.referenceId,
      referenceNumber: movementData.referenceNumber,
      locationId: movementData.locationId,
      destinationLocationId: movementData.destinationLocationId,
      unitCost: movementData.unitCost,
      totalValue: movementData.totalValue,
      userId: movementData.userId,
      notes: movementData.notes,
      movementDate: movementData.movementDate || new Date(),
      completedAt: new Date() // Will be set by repository
    };

    return await this.stockRepository.createMovement(completeMovementData);
  }

  /**
   * Get current stock level for product
   * BUSINESS RULES: Real-time stock query
   */
  async getStockLevel(productId: string, locationId: string = 'default'): Promise<StockLevel> {
    const stockLevel = await this.stockRepository.getStockLevel(productId, locationId);
    
    if (!stockLevel) {
      throw NotFoundError.stockLevel(productId, locationId);
    }

    return stockLevel;
  }

  /**
   * Get stock movements for product
   * BUSINESS RULES: Audit trail with pagination
   */
  async getProductMovements(productId: string, options: {
    startDate?: Date;
    endDate?: Date;
    movementType?: StockMovementType;
    skip?: number;
    take?: number;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    return await this.stockRepository.getProductMovements(productId, options);
  }

  /**
   * Adjust stock (increase or decrease)
   * BUSINESS RULES: Creates movement record, stock cannot go negative
   */
  async adjustStock(productId: string, quantityChange: number, options: {
    movementType?: StockMovementType;
    referenceId?: string;
    referenceNumber?: string;
    notes?: string;
    userId: string;
  }): Promise<StockMovement> {
    // Get product for cost price
    const product = await this.productRepository.getProductById(productId);
    if (!product) {
      throw NotFoundError.product(productId);
    }

    const movementData: Omit<StockMovement, 'id' | 'createdAt' | 'updatedAt'> = {
      productId,
      variantId: null,
      movementType: options.movementType || StockMovementType.STOCK_ADJUSTMENT,
      status: StockMovementStatus.COMPLETED,
      quantityBefore: 0,
      quantityChange,
      quantityAfter: 0,
      referenceId: options.referenceId || null,
      referenceNumber: options.referenceNumber || null,
      locationId: 'default',
      destinationLocationId: null,
      unitCost: product.costPrice,
      totalValue: Math.abs(quantityChange * product.costPrice),
      userId: options.userId,
      notes: options.notes || `Stock adjustment: ${quantityChange > 0 ? '+' : ''}${quantityChange}`,
      movementDate: new Date(),
      completedAt: new Date()
    };

    return await this.createMovement(movementData);
  }

  /**
   * Get active stock alerts
   * BUSINESS RULES: Low stock and out of stock alerts
   */
  async getActiveStockAlerts(): Promise<StockAlert[]> {
    return await this.stockRepository.getActiveStockAlerts();
  }

  /**
   * Acknowledge stock alert
   * BUSINESS RULES: Only active alerts can be acknowledged
   */
  async acknowledgeStockAlert(alertId: string, userId: string): Promise<StockAlert> {
    return await this.stockRepository.acknowledgeStockAlert(alertId, userId);
  }

  /**
   * Check and create low stock alerts
   * BUSINESS RULES: Run periodically to check stock levels
   */
  async checkLowStockAlerts(): Promise<StockAlert[]> {
    const lowStockProducts = await this.stockRepository.getLowStockProducts(0.3);
    const newAlerts: StockAlert[] = [];

    for (const product of lowStockProducts) {
      const alertData: Omit<StockAlert, 'id' | 'triggeredAt' | 'resolvedAt'> = {
        productId: product.productId,
        variantId: null,
        alertType: 'LOW_STOCK' as const,
        thresholdValue: product.minStockLevel,
        currentValue: product.currentStock,
        isActive: true,
        acknowledgedBy: null,
        acknowledgedAt: null
      };

      const alert = await this.stockRepository.createStockAlert(alertData);
      newAlerts.push(alert);
    }

    return newAlerts;
  }

  /**
   * Get inventory valuation
   * BUSINESS RULES: SUM(costPrice * currentStock)
   */
  async getInventoryValuation(): Promise<number> {
    return await this.stockRepository.getInventoryValuation();
  }

  /**
   * Reserve stock for sale (Week 4 preparation)
   * BUSINESS RULES: Prevents overselling, expires after 24h
   */
  async reserveStock(productId: string, quantity: number, saleOrderId: string): Promise<StockReservation> {
    const product = await this.productRepository.getProductById(productId);
    if (!product) {
      throw NotFoundError.product(productId);
    }

    const reservationData: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'> = {
      productId,
      variantId: null,
      saleOrderId,
      saleOrderLineId: null,
      quantity,
      status: 'RESERVED',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    return await this.stockRepository.reserveStock(reservationData);
  }

  /**
   * Release stock reservation
   */
  async releaseStockReservation(reservationId: string): Promise<StockReservation> {
    return await this.stockRepository.releaseStockReservation(reservationId);
  }

  /**
   * Get stock summary for dashboard
   */
  async getStockSummary(): Promise<{
    totalProducts: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    recentMovements: number;
  }> {
    const [alerts, valuation] = await Promise.all([
      this.getActiveStockAlerts(),
      this.getInventoryValuation()
    ]);

    const lowStockCount = alerts.filter(a => a.alertType === 'LOW_STOCK').length;
    const outOfStockCount = alerts.filter(a => a.alertType === 'OUT_OF_STOCK').length;

    // Get recent movements (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMovements = await this.stockRepository.getProductMovements('', {
      startDate: oneDayAgo,
      take: 1
    });

    return {
      totalProducts: 0, // Would need product count from repository
      totalStockValue: valuation,
      lowStockCount,
      outOfStockCount,
      recentMovements: recentMovements.total
    };
  }
}