/**
 * Product Domain Model
 * Represents a product in the inventory system
 * 
 * BUSINESS RULES:
 * - SKU must be unique
 * - Barcode is optional but must be unique if provided
 * - Cost price must be less than or equal to selling price
 * - Current stock cannot be negative
 * 
 * DESIGN RULES:
 * - Follows TypeScript strict mode
 * - Uses consistent naming conventions
 */
export interface Product {
  id: string;
  sku: string;                    // Stock Keeping Unit (unique)
  code: string;                   // ADDED: Alternative product code
  name: string;
  description: string | null;
  barcode: string | null;         // Optional, but unique if provided
  costPrice: number;              // Purchase cost (in MAD)
  sellingPrice: number;           // Retail price (in MAD)
  categoryId: string;
  currentStock: number;           // Real-time stock level (physical stock)
  reservedStock: number;          // Stock reserved for orders
  availableStock: number;         // Calculated: currentStock - reservedStock
  minStockLevel: number;          // Alert threshold
  reorderPoint: number;           // When to reorder
  supplierId: string | null;      // Link to supplier (Week 6)
  taxRateId: string | null;       // Link to tax configuration (Week 9)
  weight: number | null;          // In kilograms
  dimensions: string | null;      // Format: "LxWxH" in cm
  allowBackorders: boolean;       // Whether to allow sales when out of stock
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // ADDED: Additional properties for service compatibility
  quantity?: number;              // ADDED: For ProductAvailabilityService.ts
}

/**
 * Product variant for different sizes/colors of same product
 * DESIGN RULES: Follows Odoo-style variant system
 */
export interface ProductVariant {
  id: string;
  productId: string;
  variantCode: string;           // e.g., "RED-L", "BLUE-M"
  attributeName: string;         // e.g., "Color", "Size"
  attributeValue: string;        // e.g., "Red", "Large"
  skuSuffix: string;             // e.g., "-RED", "-L"
  additionalCost: number;        // Additional cost for this variant
  additionalPrice: number;       // Additional price for this variant
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  isActive: boolean;
}

/**
 * Product image with priority ordering
 * DESIGN RULES: Supports multiple images per product
 */
export interface ProductImage {
  id: string;
  productId: string;
  variantId: string | null;      // Null if for base product
  imageUrl: string;
  thumbnailUrl: string;
  altText: string;
  priority: number;              // Display order (1 = primary)
  isActive: boolean;
}

/**
 * Barcode management for products
 * BUSINESS RULES: Supports EAN-13, UPC, custom barcodes
 */
export interface Barcode {
  id: string;
  productId: string;
  variantId: string | null;
  barcodeType: 'EAN-13' | 'UPC' | 'CODE-39' | 'CUSTOM';
  barcodeValue: string;          // Must be unique
  isPrimary: boolean;
  createdAt: Date;
}

/**
 * Helper functions for Product domain
 */
export class ProductHelper {
  /**
   * Calculate available stock
   */
  static calculateAvailableStock(currentStock: number, reservedStock: number): number {
    return Math.max(0, currentStock - reservedStock);
  }

  /**
   * Check if product is in stock
   */
  static isInStock(product: Product): boolean {
    return product.availableStock > 0;
  }

  /**
   * Check if product is below minimum stock level
   */
  static isBelowMinStock(product: Product): boolean {
    return product.currentStock < product.minStockLevel;
  }

  /**
   * Check if product needs reorder
   */
  static needsReorder(product: Product): boolean {
    return product.currentStock <= product.reorderPoint;
  }

  /**
   * Check if backorder is allowed
   */
  static canBackorder(product: Product, quantity: number): boolean {
    return product.allowBackorders && quantity > 0;
  }

  /**
   * Get the maximum sellable quantity
   */
  static getMaxSellableQuantity(product: Product): number {
    if (product.allowBackorders) {
      return 1000; // Arbitrary large number for backorders
    }
    return product.availableStock;
  }

  /**
   * Validate product data
   */
  static validate(product: Partial<Product>): string[] {
    const errors: string[] = [];

    if (product.sku && !product.sku.trim()) {
      errors.push('SKU is required');
    }

    if (product.name && !product.name.trim()) {
      errors.push('Name is required');
    }

    if (product.costPrice !== undefined && product.costPrice < 0) {
      errors.push('Cost price cannot be negative');
    }

    if (product.sellingPrice !== undefined && product.sellingPrice < 0) {
      errors.push('Selling price cannot be negative');
    }

    if (product.costPrice !== undefined && product.sellingPrice !== undefined) {
      if (product.costPrice > product.sellingPrice) {
        errors.push('Cost price cannot exceed selling price');
      }
    }

    if (product.currentStock !== undefined && product.currentStock < 0) {
      errors.push('Current stock cannot be negative');
    }

    if (product.reservedStock !== undefined && product.reservedStock < 0) {
      errors.push('Reserved stock cannot be negative');
    }

    if (product.minStockLevel !== undefined && product.minStockLevel < 0) {
      errors.push('Minimum stock level cannot be negative');
    }

    if (product.reorderPoint !== undefined && product.reorderPoint < 0) {
      errors.push('Reorder point cannot be negative');
    }

    if (product.currentStock !== undefined && product.reservedStock !== undefined) {
      if (product.reservedStock > product.currentStock) {
        errors.push('Reserved stock cannot exceed current stock');
      }
    }

    return errors;
  }

  /**
   * Create a new product with default values
   */
  static createDefault(): Omit<Product, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      sku: '',
      code: '', // ADDED
      name: '',
      description: null,
      barcode: null,
      costPrice: 0,
      sellingPrice: 0,
      categoryId: '',
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      minStockLevel: 10,
      reorderPoint: 5,
      supplierId: null,
      taxRateId: null,
      weight: null,
      dimensions: null,
      allowBackorders: false,
      isActive: true,
      quantity: 0 // ADDED
    };
  }
}

/**
 * Product creation DTO
 */
export interface CreateProductDTO {
  sku: string;
  code?: string; // ADDED
  name: string;
  description?: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  categoryId: string;
  initialStock?: number;
  minStockLevel?: number;
  reorderPoint?: number;
  supplierId?: string;
  weight?: number;
  dimensions?: string;
  allowBackorders?: boolean;
}

/**
 * Product update DTO
 */
export interface UpdateProductDTO {
  name?: string;
  description?: string;
  costPrice?: number;
  sellingPrice?: number;
  categoryId?: string;
  minStockLevel?: number;
  reorderPoint?: number;
  supplierId?: string;
  weight?: number;
  dimensions?: string;
  allowBackorders?: boolean;
  isActive?: boolean;
  code?: string; // ADDED
}

/**
 * Product search filters
 */
export interface ProductFilters {
  categoryId?: string;
  supplierId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isActive?: boolean;
  searchTerm?: string;
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Product statistics
 */
export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  averageStockValue: number;
  totalStockValue: number;
}