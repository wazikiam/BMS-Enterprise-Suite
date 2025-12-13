import { Product } from '../domain/Product';
import { NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

export interface ProductAvailability {
  productId: string;
  product?: Product;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  incomingStock: number; // From pending purchase orders
  committedStock: number; // For confirmed but not yet shipped orders
  backorderQuantity: number;
  expectedRestockDate?: Date;
  availabilityStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued' | 'backordered';
  availabilityMessage: string;
  canSell: boolean;
  maxSellableQuantity: number;
  leadTimeDays?: number;
  supplierStock?: number; // Stock available at supplier
  nextShipmentDate?: Date;
  nextShipmentQuantity?: number;
}

export interface AvailabilityFilter {
  categoryId?: string;
  supplierId?: string;
  minAvailableStock?: number;
  maxAvailableStock?: number;
  availabilityStatus?: ProductAvailability['availabilityStatus'][];
  includeDiscontinued?: boolean;
  searchTerm?: string;
}

export interface BulkAvailabilityRequest {
  productIds: string[];
  quantities?: number[]; // Optional: Check availability for specific quantities
}

export interface BulkAvailabilityResult {
  [productId: string]: ProductAvailability;
}

export interface ProductSearchResult {
  product: Product;
  availability: ProductAvailability;
  relevanceScore: number;
}

export interface AvailabilityForecast {
  productId: string;
  product?: Product;
  date: Date;
  projectedStock: number;
  projectedAvailable: number;
  confidence: 'high' | 'medium' | 'low';
  factors: string[];
}

export interface RestockRecommendation {
  productId: string;
  product?: Product;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  averageDailySales: number;
  daysOfCoverage: number;
  recommendedOrderQuantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  expectedStockoutDate?: Date;
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    leadTimeDays: number;
    unitPrice: number;
    moq?: number; // Minimum Order Quantity
  }>;
}

export class ProductAvailabilityService {
  constructor(
    private productRepository: any,
    private categoryRepository: any,
    private stockRepository: any,
    private purchaseOrderRepository: any,
    private saleOrderRepository: any,
    private supplierRepository: any
  ) {}

  /**
   * Get comprehensive availability for a product
   */
  async getProductAvailability(productId: string): Promise<ProductAvailability> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    // Get current stock information
    const stockInfo = await this.getStockInfo(productId);
    
    // Get incoming stock from purchase orders
    const incomingStock = await this.getIncomingStock(productId);
    
    // Get committed stock from confirmed sale orders
    const committedStock = await this.getCommittedStock(productId);
    
    // Calculate backorder quantity
    const backorderQuantity = await this.getBackorderQuantity(productId);
    
    // Determine availability status
    const availabilityStatus = this.determineAvailabilityStatus(
      stockInfo.availableStock,
      product.minStockLevel || 0,
      product.isActive !== false
    );
    
    // Generate availability message
    const availabilityMessage = this.generateAvailabilityMessage(
      availabilityStatus,
      stockInfo.availableStock,
      product.minStockLevel || 0,
      incomingStock
    );
    
    // Determine if product can be sold
    const canSell = this.canSellProduct(product, stockInfo.availableStock);
    
    // Calculate maximum sellable quantity
    const maxSellableQuantity = this.calculateMaxSellableQuantity(
      stockInfo.availableStock,
      product,
      incomingStock
    );
    
    // Get lead time and supplier info
    const leadTimeInfo = await this.getLeadTimeInfo(productId);
    const supplierStockInfo = await this.getSupplierStockInfo(productId);

    return {
      productId: product.id!,
      product,
      physicalStock: stockInfo.physicalStock,
      reservedStock: stockInfo.reservedStock,
      availableStock: stockInfo.availableStock,
      incomingStock,
      committedStock,
      backorderQuantity,
      expectedRestockDate: this.calculateExpectedRestockDate(incomingStock, leadTimeInfo),
      availabilityStatus,
      availabilityMessage,
      canSell,
      maxSellableQuantity,
      leadTimeDays: leadTimeInfo.leadTimeDays,
      supplierStock: supplierStockInfo.availableStock,
      nextShipmentDate: supplierStockInfo.nextShipmentDate,
      nextShipmentQuantity: supplierStockInfo.nextShipmentQuantity
    };
  }

  /**
   * Get availability for multiple products in bulk
   */
  async getBulkAvailability(request: BulkAvailabilityRequest): Promise<BulkAvailabilityResult> {
    const result: BulkAvailabilityResult = {};
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < request.productIds.length; i += batchSize) {
      const batch = request.productIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (productId, index) => {
          try {
            const availability = await this.getProductAvailability(productId);
            result[productId] = availability;
          } catch (error) {
            // If product not found or error, create a minimal availability object
            result[productId] = {
              productId,
              physicalStock: 0,
              reservedStock: 0,
              availableStock: 0,
              incomingStock: 0,
              committedStock: 0,
              backorderQuantity: 0,
              availabilityStatus: 'out_of_stock',
              availabilityMessage: 'Product not available',
              canSell: false,
              maxSellableQuantity: 0
            };
          }
        })
      );
    }

    return result;
  }

  /**
   * Check if specific quantities are available
   */
  async checkQuantitiesAvailable(request: BulkAvailabilityRequest): Promise<{
    [productId: string]: {
      requested: number;
      available: number;
      isAvailable: boolean;
      shortage: number;
      canPartiallyFulfill: boolean;
      partialQuantity?: number;
    };
  }> {
    const result: {
      [productId: string]: {
        requested: number;
        available: number;
        isAvailable: boolean;
        shortage: number;
        canPartiallyFulfill: boolean;
        partialQuantity?: number;
      };
    } = {};

    const quantities = request.quantities || [];
    
    for (let i = 0; i < request.productIds.length; i++) {
      const productId = request.productIds[i];
      const requestedQuantity = quantities[i] || 1; // Default to 1 if no quantity specified
      
      try {
        const availability = await this.getProductAvailability(productId);
        
        const isAvailable = requestedQuantity <= availability.maxSellableQuantity;
        const shortage = isAvailable ? 0 : requestedQuantity - availability.maxSellableQuantity;
        const canPartiallyFulfill = !isAvailable && availability.maxSellableQuantity > 0;
        
        result[productId] = {
          requested: requestedQuantity,
          available: availability.maxSellableQuantity,
          isAvailable,
          shortage,
          canPartiallyFulfill,
          partialQuantity: canPartiallyFulfill ? availability.maxSellableQuantity : undefined
        };
      } catch (error) {
        result[productId] = {
          requested: requestedQuantity,
          available: 0,
          isAvailable: false,
          shortage: requestedQuantity,
          canPartiallyFulfill: false
        };
      }
    }

    return result;
  }

  /**
   * Search products with availability information
   */
  async searchProductsWithAvailability(
    searchTerm: string,
    filters: AvailabilityFilter = {},
    limit: number = 50
  ): Promise<ProductSearchResult[]> {
    // Search products
    const products = await this.productRepository.search({
      term: searchTerm,
      categoryId: filters.categoryId,
      includeInactive: filters.includeDiscontinued,
      limit
    });

    // Get availability for each product
    const results: ProductSearchResult[] = [];
    
    for (const product of products) {
      try {
        const availability = await this.getProductAvailability(product.id!);
        
        // Apply additional filters
        if (filters.minAvailableStock !== undefined && 
            availability.availableStock < filters.minAvailableStock) {
          continue;
        }
        
        if (filters.maxAvailableStock !== undefined && 
            availability.availableStock > filters.maxAvailableStock) {
          continue;
        }
        
        if (filters.availabilityStatus && 
            filters.availabilityStatus.length > 0 &&
            !filters.availabilityStatus.includes(availability.availabilityStatus)) {
          continue;
        }

        // Calculate relevance score (simplified)
        const relevanceScore = this.calculateRelevanceScore(product, searchTerm);

        results.push({
          product,
          availability,
          relevanceScore
        });
      } catch (error) {
        // Skip products with availability errors
        continue;
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results;
  }

  /**
   * Get products by availability status
   */
  async getProductsByAvailability(
    status: ProductAvailability['availabilityStatus'],
    filters: Omit<AvailabilityFilter, 'availabilityStatus'> = {}
  ): Promise<Array<{ product: Product; availability: ProductAvailability }>> {
    const products = await this.productRepository.findByFilters({
      categoryId: filters.categoryId,
      supplierId: filters.supplierId,
      includeInactive: filters.includeDiscontinued
    });

    const result: Array<{ product: Product; availability: ProductAvailability }> = [];
    
    for (const product of products) {
      try {
        const availability = await this.getProductAvailability(product.id!);
        
        if (availability.availabilityStatus === status) {
          // Apply additional filters
          if (filters.minAvailableStock !== undefined && 
              availability.availableStock < filters.minAvailableStock) {
            continue;
          }
          
          if (filters.maxAvailableStock !== undefined && 
              availability.availableStock > filters.maxAvailableStock) {
            continue;
          }
          
          result.push({ product, availability });
        }
      } catch (error) {
        // Skip products with errors
        continue;
      }
    }

    return result;
  }

  /**
   * Forecast availability for future dates
   */
  async forecastAvailability(
    productId: string,
    forecastDate: Date
  ): Promise<AvailabilityForecast> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    // Get current availability
    const currentAvailability = await this.getProductAvailability(productId);
    
    // Get historical sales data (simplified - would use actual sales data)
    const averageDailySales = await this.getAverageDailySales(productId);
    
    // Get expected incoming stock before forecast date
    const incomingBeforeDate = await this.getIncomingStockBeforeDate(productId, forecastDate);
    
    // Calculate days between now and forecast date
    const today = new Date();
    const days = Math.ceil((forecastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Project stock
    const projectedSales = averageDailySales * days;
    const projectedStock = Math.max(
      0,
      currentAvailability.physicalStock + incomingBeforeDate - projectedSales
    );
    
    // Project available stock (considering reservations)
    const projectedAvailable = Math.max(0, projectedStock - currentAvailability.reservedStock);
    
    // Determine confidence level
    const confidence = this.determineForecastConfidence(days, averageDailySales);
    
    // List factors affecting forecast
    const factors = this.getForecastFactors(
      days,
      averageDailySales,
      incomingBeforeDate,
      currentAvailability
    );

    return {
      productId: product.id!,
      product,
      date: forecastDate,
      projectedStock,
      projectedAvailable,
      confidence,
      factors
    };
  }

  /**
   * Generate restock recommendations
   */
  async generateRestockRecommendations(
    categoryId?: string,
    urgencyFilter?: RestockRecommendation['urgency'][]
  ): Promise<RestockRecommendation[]> {
    // Get products that need restocking
    const products = await this.productRepository.findByFilters({
      categoryId,
      includeInactive: false
    });

    const recommendations: RestockRecommendation[] = [];
    
    for (const product of products) {
      try {
        const availability = await this.getProductAvailability(product.id!);
        
        // Skip products that don't need restocking
        if (availability.availabilityStatus !== 'low_stock' && 
            availability.availabilityStatus !== 'out_of_stock') {
          continue;
        }

        const averageDailySales = await this.getAverageDailySales(product.id!);
        const daysOfCoverage = averageDailySales > 0 
          ? Math.floor(availability.availableStock / averageDailySales)
          : 999; // Infinite if no sales
        
        // Calculate recommended order quantity
        const recommendedOrderQuantity = this.calculateRecommendedOrderQuantity(
          availability.availableStock,
          product.minStockLevel || 0,
          product.maxStockLevel || 0,
          averageDailySales
        );
        
        // Determine urgency
        const urgency = this.determineRestockUrgency(
          availability.availableStock,
          product.minStockLevel || 0,
          daysOfCoverage,
          averageDailySales
        );
        
        // Apply urgency filter if provided
        if (urgencyFilter && !urgencyFilter.includes(urgency)) {
          continue;
        }
        
        // Get supplier information
        const suppliers = await this.getProductSuppliers(product.id!);
        
        // Calculate expected stockout date
        const expectedStockoutDate = averageDailySales > 0 && availability.availableStock > 0
          ? new Date(Date.now() + (daysOfCoverage * 24 * 60 * 60 * 1000))
          : undefined;

        recommendations.push({
          productId: product.id!,
          product,
          currentStock: availability.availableStock,
          minStockLevel: product.minStockLevel || 0,
          maxStockLevel: product.maxStockLevel || 0,
          averageDailySales,
          daysOfCoverage,
          recommendedOrderQuantity,
          urgency,
          expectedStockoutDate,
          suppliers
        });
      } catch (error) {
        // Skip products with errors
        continue;
      }
    }

    // Sort by urgency (critical first)
    const urgencyOrder: Record<RestockRecommendation['urgency'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };
    
    recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return recommendations;
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(thresholdPercentage: number = 20): Promise<Array<{
    product: Product;
    availability: ProductAvailability;
    currentPercentage: number;
    daysUntilStockout?: number;
  }>> {
    const products = await this.productRepository.findByFilters({
      includeInactive: false
    });

    const alerts: Array<{
      product: Product;
      availability: ProductAvailability;
      currentPercentage: number;
      daysUntilStockout?: number;
    }> = [];
    
    for (const product of products) {
      try {
        const availability = await this.getProductAvailability(product.id!);
        
        // Calculate current stock percentage of min stock level
        const minStock = product.minStockLevel || 1;
        const currentPercentage = (availability.availableStock / minStock) * 100;
        
        // Check if below threshold
        if (currentPercentage <= thresholdPercentage && availability.availableStock > 0) {
          // Calculate days until stockout
          const averageDailySales = await this.getAverageDailySales(product.id!);
          const daysUntilStockout = averageDailySales > 0
            ? Math.floor(availability.availableStock / averageDailySales)
            : undefined;
          
          alerts.push({
            product,
            availability,
            currentPercentage,
            daysUntilStockout
          });
        }
      } catch (error) {
        // Skip products with errors
        continue;
      }
    }

    // Sort by most critical (lowest percentage first)
    alerts.sort((a, b) => a.currentPercentage - b.currentPercentage);

    return alerts;
  }

  /**
   * Private helper: Get stock information
   */
  private async getStockInfo(productId: string): Promise<{
    physicalStock: number;
    reservedStock: number;
    availableStock: number;
  }> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const physicalStock = product.quantity || 0;
    const reservedStock = product.reservedStock || 0;
    const availableStock = Math.max(0, physicalStock - reservedStock);

    return { physicalStock, reservedStock, availableStock };
  }

  /**
   * Private helper: Get incoming stock from purchase orders
   */
  private async getIncomingStock(productId: string): Promise<number> {
    try {
      const pendingOrders = await this.purchaseOrderRepository.findPendingByProduct(productId);
      return pendingOrders.reduce((sum: number, order: any) => {
        return sum + (order.quantity || 0);
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Private helper: Get committed stock from confirmed sale orders
   */
  private async getCommittedStock(productId: string): Promise<number> {
    try {
      const confirmedOrders = await this.saleOrderRepository.findConfirmedByProduct(productId);
      return confirmedOrders.reduce((sum: number, order: any) => {
        const line = order.lines.find((l: any) => l.productId === productId);
        return sum + (line?.quantity || 0);
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Private helper: Get backorder quantity
   */
  private async getBackorderQuantity(productId: string): Promise<number> {
    try {
      const backorders = await this.saleOrderRepository.findBackordersByProduct(productId);
      return backorders.reduce((sum: number, order: any) => {
        const line = order.lines.find((l: any) => l.productId === productId);
        return sum + (line?.quantity || 0);
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Private helper: Determine availability status
   */
  private determineAvailabilityStatus(
    availableStock: number,
    minStockLevel: number,
    isActive: boolean
  ): ProductAvailability['availabilityStatus'] {
    if (!isActive) {
      return 'discontinued';
    }
    
    if (availableStock <= 0) {
      return 'out_of_stock';
    }
    
    if (availableStock <= minStockLevel) {
      return 'low_stock';
    }
    
    return 'in_stock';
  }

  /**
   * Private helper: Generate availability message
   */
  private generateAvailabilityMessage(
    status: ProductAvailability['availabilityStatus'],
    availableStock: number,
    minStockLevel: number,
    incomingStock: number
  ): string {
    switch (status) {
      case 'in_stock':
        return `${availableStock} units in stock`;
      
      case 'low_stock':
        return `Low stock: ${availableStock} units (min: ${minStockLevel})`;
      
      case 'out_of_stock':
        if (incomingStock > 0) {
          return `Out of stock. ${incomingStock} units expected soon`;
        }
        return 'Out of stock';
      
      case 'discontinued':
        return 'Product discontinued';
      
      case 'backordered':
        return 'Available for backorder';
      
      default:
        return 'Stock status unknown';
    }
  }

  /**
   * Private helper: Check if product can be sold
   */
  private canSellProduct(product: Product, availableStock: number): boolean {
    if (product.isActive === false) {
      return false;
    }
    
    if (availableStock <= 0) {
      return product.allowBackorders === true;
    }
    
    return true;
  }

  /**
   * Private helper: Calculate maximum sellable quantity
   */
  private calculateMaxSellableQuantity(
    availableStock: number,
    product: Product,
    incomingStock: number
  ): number {
    if (product.isActive === false) {
      return 0;
    }
    
    if (availableStock > 0) {
      return availableStock;
    }
    
    if (product.allowBackorders) {
      // For backorders, we could set a limit or return a high number
      return 1000; // Arbitrary limit for backorders
    }
    
    return 0;
  }

  /**
   * Private helper: Get lead time information
   */
  private async getLeadTimeInfo(productId: string): Promise<{
    leadTimeDays: number;
    supplierId?: string;
  }> {
    try {
      const suppliers = await this.supplierRepository.findByProduct(productId);
      if (suppliers.length > 0) {
        // Use the primary supplier's lead time
        return {
          leadTimeDays: suppliers[0].leadTimeDays || 7, // Default 7 days
          supplierId: suppliers[0].id
        };
      }
    } catch (error) {
      // Fall through to default
    }
    
    return { leadTimeDays: 7 }; // Default lead time
  }

  /**
   * Private helper: Get supplier stock information
   */
  private async getSupplierStockInfo(productId: string): Promise<{
    availableStock?: number;
    nextShipmentDate?: Date;
    nextShipmentQuantity?: number;
  }> {
    try {
      const suppliers = await this.supplierRepository.findByProduct(productId);
      if (suppliers.length > 0) {
        const primarySupplier = suppliers[0];
        return {
          availableStock: primarySupplier.stockOnHand,
          nextShipmentDate: primarySupplier.nextShipmentDate,
          nextShipmentQuantity: primarySupplier.nextShipmentQuantity
        };
      }
    } catch (error) {
      // Return empty info if unavailable
    }
    
    return {};
  }

  /**
   * Private helper: Calculate expected restock date
   */
  private calculateExpectedRestockDate(
    incomingStock: number,
    leadTimeInfo: { leadTimeDays: number }
  ): Date | undefined {
    if (incomingStock > 0) {
      const date = new Date();
      date.setDate(date.getDate() + leadTimeInfo.leadTimeDays);
      return date;
    }
    
    return undefined;
  }

  /**
   * Private helper: Calculate relevance score for search
   */
  private calculateRelevanceScore(product: Product, searchTerm: string): number {
    let score = 0;
    const term = searchTerm.toLowerCase();
    
    // Name match
    if (product.name.toLowerCase().includes(term)) {
      score += 3;
    }
    
    // Code match
    if (product.code.toLowerCase().includes(term)) {
      score += 2;
    }
    
    // Description match
    if (product.description && product.description.toLowerCase().includes(term)) {
      score += 1;
    }
    
    // Boost for in-stock items
    if (product.quantity && product.quantity > 0) {
      score += 0.5;
    }
    
    return score;
  }

  /**
   * Private helper: Get average daily sales
   */
  private async getAverageDailySales(productId: string): Promise<number> {
    try {
      // This would query historical sales data
      // For now, return a placeholder
      return 5; // Default average
    } catch (error) {
      return 0;
    }
  }

  /**
   * Private helper: Get incoming stock before a specific date
   */
  private async getIncomingStockBeforeDate(productId: string, date: Date): Promise<number> {
    try {
      const incomingOrders = await this.purchaseOrderRepository.findByProductAndDate(
        productId,
        date
      );
      return incomingOrders.reduce((sum: number, order: any) => {
        return sum + (order.quantity || 0);
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Private helper: Determine forecast confidence
   */
  private determineForecastConfidence(days: number, averageDailySales: number): 'high' | 'medium' | 'low' {
    if (days <= 7 && averageDailySales > 0) {
      return 'high';
    } else if (days <= 30) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Private helper: Get forecast factors
   */
  private getForecastFactors(
    days: number,
    averageDailySales: number,
    incomingStock: number,
    availability: ProductAvailability
  ): string[] {
    const factors: string[] = [];
    
    if (days > 30) {
      factors.push('Long-term forecast (lower accuracy)');
    }
    
    if (averageDailySales === 0) {
      factors.push('No historical sales data');
    }
    
    if (incomingStock > 0) {
      factors.push(`Incoming stock: ${incomingStock} units`);
    }
    
    if (availability.availabilityStatus === 'low_stock') {
      factors.push('Currently low on stock');
    }
    
    return factors;
  }

  /**
   * Private helper: Calculate recommended order quantity
   */
  private calculateRecommendedOrderQuantity(
    currentStock: number,
    minStockLevel: number,
    maxStockLevel: number,
    averageDailySales: number
  ): number {
    if (maxStockLevel <= minStockLevel) {
      return minStockLevel * 2; // Default to 2x min stock
    }
    
    const targetStock = maxStockLevel;
    const neededStock = Math.max(0, targetStock - currentStock);
    
    // Add buffer based on average daily sales
    const buffer = averageDailySales * 7; // One week buffer
    return Math.ceil(neededStock + buffer);
  }

  /**
   * Private helper: Determine restock urgency
   */
  private determineRestockUrgency(
    currentStock: number,
    minStockLevel: number,
    daysOfCoverage: number,
    averageDailySales: number
  ): RestockRecommendation['urgency'] {
    if (currentStock <= 0) {
      return 'critical';
    }
    
    if (currentStock <= minStockLevel) {
      return 'high';
    }
    
    if (daysOfCoverage <= 7 && averageDailySales > 0) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Private helper: Get product suppliers
   */
  private async getProductSuppliers(productId: string): Promise<RestockRecommendation['suppliers']> {
    try {
      const suppliers = await this.supplierRepository.findByProduct(productId);
      return suppliers.map((supplier: any) => ({
        supplierId: supplier.id,
        supplierName: supplier.name,
        leadTimeDays: supplier.leadTimeDays || 7,
        unitPrice: supplier.unitPrice || 0,
        moq: supplier.minimumOrderQuantity
      }));
    } catch (error) {
      return [];
    }
  }
}