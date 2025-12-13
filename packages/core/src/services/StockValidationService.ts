import { Product } from '../domain/Product';
import { SaleOrderLine } from '../domain/SaleOrderLine';
import { NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

export interface StockValidationRequest {
  productId: string;
  quantity: number;
  orderId?: string;
  orderLineId?: string;
  ignoreReservations?: boolean;
}

export interface StockValidationResult {
  productId: string;
  product?: Product;
  requested: number;
  available: number;
  physical: number;
  reserved: number;
  incoming: number;
  isValid: boolean;
  shortage: number;
  warningLevel?: 'none' | 'low' | 'critical';
  suggestions?: string[];
  canPartiallyFulfill?: boolean;
  partialQuantity?: number;
}

export interface BatchStockValidationRequest {
  items: StockValidationRequest[];
  orderId?: string;
  validateAllOrNone?: boolean;
}

export interface BatchStockValidationResult {
  allValid: boolean;
  results: StockValidationResult[];
  summary: {
    totalRequested: number;
    totalAvailable: number;
    totalShortage: number;
    validItems: number;
    invalidItems: number;
    lowStockItems: number;
    criticalStockItems: number;
  };
}

export interface StockWarningLevels {
  lowThreshold: number; // Percentage or absolute value
  criticalThreshold: number; // Percentage or absolute value
  usePercentage: boolean;
}

export interface RealtimeStockUpdate {
  productId: string;
  availableStock: number;
  reservedStock: number;
  physicalStock: number;
  lastUpdated: Date;
  warnings: string[];
}

export class StockValidationService {
  private defaultWarningLevels: StockWarningLevels = {
    lowThreshold: 20, // 20% or 20 units
    criticalThreshold: 5, // 5% or 5 units
    usePercentage: true
  };

  constructor(
    private productRepository: any,
    private stockRepository: any,
    private reservationService: any,
    private stockAlertService?: any
  ) {}

  /**
   * Validate stock for a single product
   */
  async validateStock(request: StockValidationRequest): Promise<StockValidationResult> {
    // Get product details
    const product = await this.productRepository.findById(request.productId);
    if (!product) {
      throw new NotFoundError('Product', request.productId);
    }

    // Get current stock information
    const stockInfo = await this.getCurrentStockInfo(request.productId, request.ignoreReservations);

    // Calculate available stock
    const availableStock = request.ignoreReservations 
      ? stockInfo.physicalStock
      : stockInfo.availableStock;

    // Check if requested quantity is available
    const isValid = request.quantity <= availableStock;
    const shortage = isValid ? 0 : request.quantity - availableStock;

    // Determine warning level
    const warningLevel = this.determineWarningLevel(
      stockInfo.physicalStock,
      product.minStockLevel || 0,
      request.quantity
    );

    // Generate suggestions
    const suggestions = this.generateSuggestions(
      product,
      request.quantity,
      availableStock,
      stockInfo.physicalStock,
      warningLevel
    );

    // Check if partial fulfillment is possible
    const canPartiallyFulfill = !isValid && availableStock > 0;
    const partialQuantity = canPartiallyFulfill ? availableStock : undefined;

    // Trigger alerts if needed
    await this.triggerStockAlerts(product, request.quantity, availableStock, warningLevel);

    return {
      productId: product.id!,
      product,
      requested: request.quantity,
      available: availableStock,
      physical: stockInfo.physicalStock,
      reserved: stockInfo.reservedStock,
      incoming: stockInfo.incomingStock,
      isValid,
      shortage,
      warningLevel,
      suggestions,
      canPartiallyFulfill,
      partialQuantity
    };
  }

  /**
   * Validate stock for multiple products in batch
   */
  async validateStockBatch(request: BatchStockValidationRequest): Promise<BatchStockValidationResult> {
    const results: StockValidationResult[] = [];
    let allValid = true;

    for (const item of request.items) {
      try {
        const result = await this.validateStock({
          ...item,
          orderId: request.orderId || item.orderId
        });
        results.push(result);

        if (!result.isValid) {
          allValid = false;
          
          // If validateAllOrNone is true and we found an invalid item, we can stop early
          if (request.validateAllOrNone) {
            // Skip remaining validations for performance
            const remainingItems = request.items.slice(request.items.indexOf(item) + 1);
            for (const remainingItem of remainingItems) {
              results.push({
                productId: remainingItem.productId,
                requested: remainingItem.quantity,
                available: 0,
                physical: 0,
                reserved: 0,
                incoming: 0,
                isValid: false,
                shortage: remainingItem.quantity,
                warningLevel: 'critical'
              });
            }
            break;
          }
        }
      } catch (error) {
        // If product not found or other error, mark as invalid
        results.push({
          productId: item.productId,
          requested: item.quantity,
          available: 0,
          physical: 0,
          reserved: 0,
          incoming: 0,
          isValid: false,
          shortage: item.quantity,
          warningLevel: 'critical',
          suggestions: ['Product not found or error during validation']
        });
        allValid = false;
      }
    }

    // Calculate summary
    const summary = this.calculateBatchSummary(results);

    return {
      allValid: request.validateAllOrNone ? allValid : true, // If not allOrNone, batch is always "valid"
      results,
      summary
    };
  }

  /**
   * Validate stock for sale order lines
   */
  async validateStockForOrderLines(
    lines: SaleOrderLine[] | Array<{ productId: string; quantity: number }>,
    orderId?: string,
    ignoreReservations?: boolean
  ): Promise<BatchStockValidationResult> {
    const items: StockValidationRequest[] = lines.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      orderId,
      ignoreReservations
    }));

    return await this.validateStockBatch({
      items,
      orderId,
      validateAllOrNone: true
    });
  }

  /**
   * Real-time stock check with instant feedback
   */
  async realtimeStockCheck(productId: string, quantity: number): Promise<{
    isAvailable: boolean;
    availableNow: number;
    message: string;
    warning?: string;
    alternatives?: Array<{
      productId: string;
      name: string;
      available: number;
      price: number;
    }>;
  }> {
    try {
      const validation = await this.validateStock({
        productId,
        quantity,
        ignoreReservations: false
      });

      let message = '';
      let warning = '';

      if (validation.isValid) {
        message = `${quantity} units available for immediate sale`;
        
        if (validation.warningLevel === 'low') {
          warning = `Low stock warning: Only ${validation.physical} units in physical stock`;
        } else if (validation.warningLevel === 'critical') {
          warning = `Critical stock level: Only ${validation.physical} units in physical stock`;
        }
      } else {
        if (validation.canPartiallyFulfill && validation.partialQuantity) {
          message = `Only ${validation.partialQuantity} units available (shortage: ${validation.shortage})`;
        } else {
          message = `Insufficient stock. Available: ${validation.available}, Requested: ${quantity}`;
        }
      }

      // Find alternatives if stock is insufficient
      let alternatives;
      if (!validation.isValid && validation.product) {
        alternatives = await this.findAlternativeProducts(
          validation.product,
          quantity
        );
      }

      return {
        isAvailable: validation.isValid,
        availableNow: validation.available,
        message,
        warning: warning || undefined,
        alternatives
      };
    } catch (error) {
      return {
        isAvailable: false,
        availableNow: 0,
        message: 'Error checking stock availability',
        warning: 'Product may not exist or stock data unavailable'
      };
    }
  }

  /**
   * Reserve stock if available (atomic operation)
   */
  async reserveStockIfAvailable(
    productId: string,
    quantity: number,
    orderId: string,
    orderLineId?: string
  ): Promise<{
    success: boolean;
    reserved: boolean;
    reservedQuantity: number;
    validation: StockValidationResult;
    reservationId?: string;
  }> {
    // First, validate stock
    const validation = await this.validateStock({
      productId,
      quantity,
      orderId
    });

    if (!validation.isValid) {
      return {
        success: false,
        reserved: false,
        reservedQuantity: 0,
        validation
      };
    }

    try {
      // Attempt to reserve stock
      const reservation = await this.reservationService.reserveStock({
        productId,
        quantity,
        orderId,
        orderLineId,
        reservationType: 'sale_order',
        notes: `Reserved via validation service for order ${orderId}`
      });

      // Update validation with reserved info
      validation.reserved += quantity;
      validation.available -= quantity;

      return {
        success: true,
        reserved: true,
        reservedQuantity: quantity,
        validation,
        reservationId: reservation.id
      };
    } catch (error) {
      // Reservation failed (possibly due to race condition)
      return {
        success: false,
        reserved: false,
        reservedQuantity: 0,
        validation: await this.validateStock({
          productId,
          quantity,
          orderId,
          ignoreReservations: false
        })
      };
    }
  }

  /**
   * Get current stock levels for dashboard/monitoring
   */
  async getStockLevels(products?: string[]): Promise<RealtimeStockUpdate[]> {
    const productIds = products || await this.getAllProductIds();
    const updates: RealtimeStockUpdate[] = [];

    for (const productId of productIds) {
      try {
        const product = await this.productRepository.findById(productId);
        if (!product) continue;

        const stockInfo = await this.getCurrentStockInfo(productId, false);
        const warningLevel = this.determineWarningLevel(
          stockInfo.physicalStock,
          product.minStockLevel || 0,
          0
        );

        const warnings: string[] = [];
        if (warningLevel === 'low') {
          warnings.push('Low stock level');
        } else if (warningLevel === 'critical') {
          warnings.push('Critical stock level');
        }

        if (stockInfo.availableStock <= 0) {
          warnings.push('Out of stock');
        }

        updates.push({
          productId: product.id!,
          availableStock: stockInfo.availableStock,
          reservedStock: stockInfo.reservedStock,
          physicalStock: stockInfo.physicalStock,
          lastUpdated: new Date(),
          warnings
        });
      } catch (error) {
        // Skip products with errors
        console.error(`Error getting stock level for product ${productId}:`, error);
      }
    }

    return updates;
  }

  /**
   * Check stock availability for a list of products (optimized for UI)
   */
  async quickStockCheck(items: Array<{ productId: string; quantity: number }>): Promise<{
    [productId: string]: {
      available: number;
      canSell: boolean;
      warning?: 'none' | 'low' | 'critical' | 'out_of_stock';
    };
  }> {
    const result: {
      [productId: string]: {
        available: number;
        canSell: boolean;
        warning?: 'none' | 'low' | 'critical' | 'out_of_stock';
      };
    } = {};

    // Get all product data at once for efficiency
    const productIds = items.map(item => item.productId);
    const products = await this.productRepository.findByIds(productIds);

    for (const item of items) {
      const product = products.find((p: Product) => p.id === item.productId);
      
      if (!product) {
        result[item.productId] = {
          available: 0,
          canSell: false,
          warning: 'out_of_stock'
        };
        continue;
      }

      const stockInfo = await this.getCurrentStockInfo(item.productId, false);
      const canSell = item.quantity <= stockInfo.availableStock;

      let warning: 'none' | 'low' | 'critical' | 'out_of_stock' = 'none';
      
      if (stockInfo.availableStock <= 0) {
        warning = 'out_of_stock';
      } else {
        const warningLevel = this.determineWarningLevel(
          stockInfo.physicalStock,
          product.minStockLevel || 0,
          item.quantity
        );
        warning = warningLevel;
      }

      result[item.productId] = {
        available: stockInfo.availableStock,
        canSell,
        warning
      };
    }

    return result;
  }

  /**
   * Set custom warning levels for stock alerts
   */
  setWarningLevels(levels: Partial<StockWarningLevels>): void {
    this.defaultWarningLevels = {
      ...this.defaultWarningLevels,
      ...levels
    };
  }

  /**
   * Get current stock warning levels
   */
  getWarningLevels(): StockWarningLevels {
    return { ...this.defaultWarningLevels };
  }

  /**
   * Private helper: Get current stock information
   */
  private async getCurrentStockInfo(
    productId: string,
    ignoreReservations: boolean = false
  ): Promise<{
    physicalStock: number;
    reservedStock: number;
    availableStock: number;
    incomingStock: number;
  }> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const physicalStock = product.quantity || 0;
    const reservedStock = ignoreReservations ? 0 : product.reservedStock || 0;
    const availableStock = Math.max(0, physicalStock - reservedStock);
    
    // In a real implementation, incomingStock would come from purchase orders
    const incomingStock = 0; // Placeholder

    return {
      physicalStock,
      reservedStock,
      availableStock,
      incomingStock
    };
  }

  /**
   * Private helper: Determine warning level
   */
  private determineWarningLevel(
    physicalStock: number,
    minStockLevel: number,
    requestedQuantity: number
  ): 'none' | 'low' | 'critical' {
    if (physicalStock <= 0) {
      return 'critical';
    }

    if (this.defaultWarningLevels.usePercentage) {
      const stockPercentage = (physicalStock / Math.max(minStockLevel, 1)) * 100;
      
      if (stockPercentage <= this.defaultWarningLevels.criticalThreshold) {
        return 'critical';
      } else if (stockPercentage <= this.defaultWarningLevels.lowThreshold) {
        return 'low';
      }
    } else {
      if (physicalStock <= this.defaultWarningLevels.criticalThreshold) {
        return 'critical';
      } else if (physicalStock <= this.defaultWarningLevels.lowThreshold) {
        return 'low';
      }
    }

    // Also check if requested quantity would bring stock below minimum
    if (minStockLevel > 0 && (physicalStock - requestedQuantity) < minStockLevel) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Private helper: Generate suggestions based on stock situation
   */
  private generateSuggestions(
    product: Product,
    requestedQuantity: number,
    availableStock: number,
    physicalStock: number,
    warningLevel: 'none' | 'low' | 'critical'
  ): string[] {
    const suggestions: string[] = [];

    if (!product) return suggestions;

    if (availableStock < requestedQuantity) {
      const shortage = requestedQuantity - availableStock;
      suggestions.push(`Insufficient stock. Shortage: ${shortage} units`);
      
      if (availableStock > 0) {
        suggestions.push(`Consider partial fulfillment: ${availableStock} units available`);
      }
      
      if (product.minStockLevel && physicalStock < product.minStockLevel) {
        suggestions.push(`Stock is below minimum level (${product.minStockLevel})`);
      }
    }

    if (warningLevel === 'low') {
      suggestions.push('Stock level is low. Consider restocking soon.');
    } else if (warningLevel === 'critical') {
      suggestions.push('CRITICAL: Stock level is very low. Immediate restocking required.');
    }

    if (product.minStockLevel && physicalStock <= product.minStockLevel) {
      suggestions.push(`Reorder point reached. Minimum stock level: ${product.minStockLevel}`);
    }

    // Suggest alternatives if this is a popular item
    if (availableStock < requestedQuantity) {
      suggestions.push('Check for alternative products or suppliers');
    }

    return suggestions;
  }

  /**
   * Private helper: Trigger stock alerts if service is available
   */
  private async triggerStockAlerts(
    product: Product,
    requestedQuantity: number,
    availableStock: number,
    warningLevel: 'none' | 'low' | 'critical'
  ): Promise<void> {
    if (!this.stockAlertService) return;

    try {
      // Trigger low stock alert
      if (warningLevel === 'low' || warningLevel === 'critical') {
        await this.stockAlertService.triggerLowStockAlert({
          productId: product.id!,
          productName: product.name,
          currentStock: availableStock,
          minStockLevel: product.minStockLevel || 0,
          warningLevel
        });
      }

      // Trigger out of stock alert if applicable
      if (availableStock <= 0) {
        await this.stockAlertService.triggerOutOfStockAlert({
          productId: product.id!,
          productName: product.name,
          lastStock: availableStock
        });
      }

      // Trigger potential stockout alert if sale would bring stock below minimum
      if (product.minStockLevel && (availableStock - requestedQuantity) < product.minStockLevel) {
        await this.stockAlertService.triggerPotentialStockoutAlert({
          productId: product.id!,
          productName: product.name,
          currentStock: availableStock,
          requestedQuantity,
          wouldBeStock: availableStock - requestedQuantity,
          minStockLevel: product.minStockLevel
        });
      }
    } catch (error) {
      // Don't throw if alert service fails - stock validation should continue
      console.error('Error triggering stock alerts:', error);
    }
  }

  /**
   * Private helper: Calculate batch validation summary
   */
  private calculateBatchSummary(results: StockValidationResult[]) {
    const summary = {
      totalRequested: 0,
      totalAvailable: 0,
      totalShortage: 0,
      validItems: 0,
      invalidItems: 0,
      lowStockItems: 0,
      criticalStockItems: 0
    };

    for (const result of results) {
      summary.totalRequested += result.requested;
      summary.totalAvailable += result.available;
      summary.totalShortage += result.shortage;

      if (result.isValid) {
        summary.validItems++;
      } else {
        summary.invalidItems++;
      }

      if (result.warningLevel === 'low') {
        summary.lowStockItems++;
      } else if (result.warningLevel === 'critical') {
        summary.criticalStockItems++;
      }
    }

    return summary;
  }

  /**
   * Private helper: Find alternative products
   */
  private async findAlternativeProducts(
    originalProduct: Product,
    requestedQuantity: number
  ): Promise<Array<{
    productId: string;
    name: string;
    available: number;
    price: number;
  }>> {
    try {
      // Find products in same category
      const alternatives = await this.productRepository.findByCategory(
        originalProduct.categoryId || '',
        { excludeId: originalProduct.id }
      );

      // Filter to products with sufficient stock
      const availableAlternatives = [];

      for (const altProduct of alternatives) {
        const stockInfo = await this.getCurrentStockInfo(altProduct.id!, false);
        if (stockInfo.availableStock >= requestedQuantity) {
          availableAlternatives.push({
            productId: altProduct.id!,
            name: altProduct.name,
            available: stockInfo.availableStock,
            price: altProduct.unitPrice || 0
          });

          // Limit to top 3 alternatives
          if (availableAlternatives.length >= 3) {
            break;
          }
        }
      }

      return availableAlternatives;
    } catch (error) {
      return [];
    }
  }

  /**
   * Private helper: Get all product IDs
   */
  private async getAllProductIds(): Promise<string[]> {
    try {
      const products = await this.productRepository.findAll({ limit: 1000 });
      return products.map((p: Product) => p.id!).filter(Boolean);
    } catch (error) {
      return [];
    }
  }
} 
