/**
 * Stock Repository
 * Database operations for Stock Management
 * 
 * BUSINESS RULES:
 * - Real-time stock tracking for 2000+ products
 * - Stock movements audit trail (immutable)
 * - Low stock alerts system
 * - Stock reservations for sales (Week 4)
 * 
 * DESIGN RULES:
 * - Transaction-safe operations
 * - Optimized for high-frequency updates
 * - Supports real-time validation
 */
import { PrismaClient } from '@prisma/client';
import { 
  StockMovement, 
  StockMovementType, 
  StockMovementStatus,
  StockLevel,
  StockAlert,
  StockReservation 
} from '../domain/StockMovement';
import { NotFoundError, ValidationError } from '../errors/ApplicationError';

export class StockRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create stock movement
   * BUSINESS RULES: Stock cannot go negative
   */
  async createMovement(movementData: Omit<StockMovement, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockMovement> {
    return await this.prisma.$transaction(async (tx: any) => {
      // Get current stock level
      const stockLevel = await tx.stockLevel.findUnique({
        where: { 
          productId_locationId: {
            productId: movementData.productId,
            locationId: movementData.locationId
          }
        }
      });

      if (!stockLevel) {
        throw NotFoundError.stockLevel(movementData.productId, movementData.locationId);
      }

      // Calculate new stock
      const quantityBefore = stockLevel.currentStock;
      const quantityAfter = quantityBefore + movementData.quantityChange;

      // Validate stock cannot go negative
      if (quantityAfter < 0) {
        throw new ValidationError(
          `Insufficient stock for product ${movementData.productId}. ` +
          `Current: ${quantityBefore}, Requested: ${-movementData.quantityChange}`
        );
      }

      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          productId: movementData.productId,
          variantId: movementData.variantId,
          movementType: movementData.movementType,
          status: StockMovementStatus.COMPLETED,
          quantityBefore,
          quantityChange: movementData.quantityChange,
          quantityAfter,
          referenceId: movementData.referenceId,
          referenceNumber: movementData.referenceNumber,
          locationId: movementData.locationId,
          destinationLocationId: movementData.destinationLocationId,
          unitCost: movementData.unitCost,
          totalValue: movementData.totalValue,
          userId: movementData.userId,
          notes: movementData.notes,
          movementDate: movementData.movementDate || new Date(),
          completedAt: new Date()
        }
      });

      // Update stock level
      await tx.stockLevel.update({
        where: { 
          productId_locationId: {
            productId: movementData.productId,
            locationId: movementData.locationId
          }
        },
        data: {
          currentStock: quantityAfter,
          lastMovementId: movement.id,
          lastUpdated: new Date()
        }
      });

      // Check for low stock alert
      await this.checkLowStockAlert(tx, movementData.productId, quantityAfter);

      return this.mapMovementToDomain(movement);
    });
  }

  /**
   * Get stock level for product
   * BUSINESS RULES: Real-time stock query
   */
  async getStockLevel(productId: string, locationId: string = 'default'): Promise<StockLevel | null> {
    const stockLevel = await this.prisma.stockLevel.findUnique({
      where: { 
        productId_locationId: {
          productId,
          locationId
        }
      },
      include: {
        product: true,
        lastMovement: true
      }
    });

    if (!stockLevel) return null;
    return this.mapStockLevelToDomain(stockLevel);
  }

  /**
   * Get stock movements for product
   * DESIGN RULES: Paginated for performance
   */
  async getProductMovements(productId: string, options: {
    startDate?: Date;
    endDate?: Date;
    movementType?: StockMovementType;
    skip?: number;
    take?: number;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    const where: any = { productId };

    if (options.startDate || options.endDate) {
      where.movementDate = {};
      if (options.startDate) where.movementDate.gte = options.startDate;
      if (options.endDate) where.movementDate.lte = options.endDate;
    }

    if (options.movementType) {
      where.movementType = options.movementType;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: true,
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { movementDate: 'desc' },
        skip: options.skip || 0,
        take: options.take || 50
      }),
      this.prisma.stockMovement.count({ where })
    ]);

    return {
      movements: movements.map((m: any) => this.mapMovementToDomain(m)),
      total
    };
  }

  /**
   * Get current stock alerts
   * BUSINESS RULES: Active low stock alerts only
   */
  async getActiveStockAlerts(): Promise<StockAlert[]> {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { isActive: true },
      include: {
        product: {
          include: {
            category: true,
            supplier: true
          }
        }
      },
      orderBy: [
        { alertType: 'asc' },
        { triggeredAt: 'desc' }
      ]
    });

    return alerts.map((a: any) => this.mapAlertToDomain(a));
  }

  /**
   * Create stock alert
   * BUSINESS RULES: One active alert per product per type
   */
  async createStockAlert(alertData: Omit<StockAlert, 'id' | 'triggeredAt' | 'resolvedAt'>): Promise<StockAlert> {
    // Check for existing active alert of same type
    const existingAlert = await this.prisma.stockAlert.findFirst({
      where: {
        productId: alertData.productId,
        variantId: alertData.variantId,
        alertType: alertData.alertType,
        isActive: true
      }
    });

    if (existingAlert) {
      // Update existing alert instead of creating new one
      const updated = await this.prisma.stockAlert.update({
        where: { id: existingAlert.id },
        data: {
          currentValue: alertData.currentValue,
          triggeredAt: new Date(),
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null
        }
      });

      return this.mapAlertToDomain(updated);
    }

    // Create new alert
    const alert = await this.prisma.stockAlert.create({
      data: {
        productId: alertData.productId,
        variantId: alertData.variantId,
        alertType: alertData.alertType,
        thresholdValue: alertData.thresholdValue,
        currentValue: alertData.currentValue,
        isActive: true,
        triggeredAt: new Date()
      }
    });

    return this.mapAlertToDomain(alert);
  }

  /**
   * Acknowledge stock alert
   * BUSINESS RULES: Only active alerts can be acknowledged
   */
  async acknowledgeStockAlert(alertId: string, userId: string): Promise<StockAlert> {
    const alert = await this.prisma.stockAlert.update({
      where: { 
        id: alertId,
        isActive: true 
      },
      data: {
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      }
    });

    return this.mapAlertToDomain(alert);
  }

  /**
   * Resolve stock alert
   * BUSINESS RULES: Alert resolved when stock is replenished
   */
  async resolveStockAlert(alertId: string): Promise<StockAlert> {
    const alert = await this.prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isActive: false,
        resolvedAt: new Date()
      }
    });

    return this.mapAlertToDomain(alert);
  }

  /**
   * Reserve stock for sale (Week 4 preparation)
   * BUSINESS RULES: Prevents overselling
   */
  async reserveStock(reservationData: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockReservation> {
    return await this.prisma.$transaction(async (tx: any) => {
      // Check available stock
      const stockLevel = await tx.stockLevel.findUnique({
        where: { 
          productId_locationId: {
            productId: reservationData.productId,
            locationId: 'default'
          }
        }
      });

      if (!stockLevel) {
        throw NotFoundError.stockLevel(reservationData.productId, 'default');
      }

      const availableStock = stockLevel.currentStock - stockLevel.reservedStock;

      if (availableStock < reservationData.quantity) {
        throw new ValidationError(
          `Insufficient available stock for reservation. ` +
          `Available: ${availableStock}, Requested: ${reservationData.quantity}`
        );
      }

      // Create reservation
      const reservation = await tx.stockReservation.create({
        data: {
          productId: reservationData.productId,
          variantId: reservationData.variantId,
          saleOrderId: reservationData.saleOrderId,
          saleOrderLineId: reservationData.saleOrderLineId,
          quantity: reservationData.quantity,
          status: 'RESERVED',
          expiresAt: reservationData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      // Update reserved stock
      await tx.stockLevel.update({
        where: { 
          productId_locationId: {
            productId: reservationData.productId,
            locationId: 'default'
          }
        },
        data: {
          reservedStock: stockLevel.reservedStock + reservationData.quantity,
          lastUpdated: new Date()
        }
      });

      return this.mapReservationToDomain(reservation);
    });
  }

  /**
   * Release stock reservation
   */
  async releaseStockReservation(reservationId: string): Promise<StockReservation> {
    return await this.prisma.$transaction(async (tx: any) => {
      const reservation = await tx.stockReservation.findUnique({
        where: { id: reservationId }
      });

      if (!reservation) {
        throw NotFoundError.stockReservation(reservationId);
      }

      if (reservation.status !== 'RESERVED') {
        throw new ValidationError(`Reservation ${reservationId} is not in RESERVED state`);
      }

      // Update reservation
      const updatedReservation = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: 'RELEASED', updatedAt: new Date() }
      });

      // Update reserved stock
      const stockLevel = await tx.stockLevel.findUnique({
        where: { 
          productId_locationId: {
            productId: reservation.productId,
            locationId: 'default'
          }
        }
      });

      if (stockLevel) {
        await tx.stockLevel.update({
          where: { 
            productId_locationId: {
              productId: reservation.productId,
              locationId: 'default'
            }
          },
          data: {
            reservedStock: Math.max(0, stockLevel.reservedStock - reservation.quantity),
            lastUpdated: new Date()
          }
        });
      }

      return this.mapReservationToDomain(updatedReservation);
    });
  }

  /**
   * Get inventory valuation
   * BUSINESS RULES: SUM(costPrice * currentStock)
   */
  async getInventoryValuation(): Promise<number> {
    const result = await this.prisma.stockLevel.aggregate({
      _sum: {
        stockValue: true // Assuming computed field or need calculation
      }
    });

    return result._sum.stockValue || 0;
  }

  /**
   * Get low stock products
   * BUSINESS RULES: Products below min stock level
   */
  async getLowStockProducts(thresholdPercent: number = 0.2): Promise<Array<{
    productId: string;
    productName: string;
    currentStock: number;
    minStockLevel: number;
    percentage: number;
  }>> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { lte: { minStockLevel: true } }
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
        minStockLevel: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } }
      },
      orderBy: [
        { currentStock: 'asc' },
        { name: 'asc' }
      ]
    });

    return products.map((p: any) => ({
      productId: p.id,
      productName: p.name,
      currentStock: p.currentStock,
      minStockLevel: p.minStockLevel,
      percentage: p.minStockLevel > 0 ? (p.currentStock / p.minStockLevel) : 0
    }));
  }

  /**
   * Check for low stock alert
   * PRIVATE: Internal method for alert checking
   */
  private async checkLowStockAlert(tx: any, productId: string, currentStock: number): Promise<void> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { minStockLevel: true, name: true }
    });

    if (!product) return;

    if (currentStock <= product.minStockLevel) {
      await tx.stockAlert.create({
        data: {
          productId,
          alertType: 'LOW_STOCK',
          thresholdValue: product.minStockLevel,
          currentValue: currentStock,
          isActive: true,
          triggeredAt: new Date()
        }
      });
    }

    if (currentStock === 0) {
      await tx.stockAlert.create({
        data: {
          productId,
          alertType: 'OUT_OF_STOCK',
          thresholdValue: 0,
          currentValue: 0,
          isActive: true,
          triggeredAt: new Date()
        }
      });
    }
  }

  /**
   * Mapping methods
   */
  private mapMovementToDomain(data: any): StockMovement {
    return {
      id: data.id,
      productId: data.productId,
      variantId: data.variantId,
      movementType: data.movementType as StockMovementType,
      status: data.status as StockMovementStatus,
      quantityBefore: data.quantityBefore,
      quantityChange: data.quantityChange,
      quantityAfter: data.quantityAfter,
      referenceId: data.referenceId,
      referenceNumber: data.referenceNumber,
      locationId: data.locationId,
      destinationLocationId: data.destinationLocationId,
      unitCost: data.unitCost,
      totalValue: data.totalValue,
      userId: data.userId,
      notes: data.notes,
      movementDate: data.movementDate,
      completedAt: data.completedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private mapStockLevelToDomain(data: any): StockLevel {
    return {
      id: data.id,
      productId: data.productId,
      variantId: data.variantId,
      locationId: data.locationId,
      currentStock: data.currentStock,
      reservedStock: data.reservedStock || 0,
      availableStock: data.availableStock || data.currentStock,
      lastMovementId: data.lastMovementId,
      lastUpdated: data.lastUpdated
    };
  }

  private mapAlertToDomain(data: any): StockAlert {
    return {
      id: data.id,
      productId: data.productId,
      variantId: data.variantId,
      alertType: data.alertType as 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON',
      thresholdValue: data.thresholdValue,
      currentValue: data.currentValue,
      isActive: data.isActive,
      acknowledgedBy: data.acknowledgedBy,
      acknowledgedAt: data.acknowledgedAt,
      triggeredAt: data.triggeredAt,
      resolvedAt: data.resolvedAt
    };
  }

  private mapReservationToDomain(data: any): StockReservation {
    return {
      id: data.id,
      productId: data.productId,
      variantId: data.variantId,
      saleOrderId: data.saleOrderId,
      saleOrderLineId: data.saleOrderLineId,
      quantity: data.quantity,
      status: data.status as 'RESERVED' | 'RELEASED' | 'CONSUMED',
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}