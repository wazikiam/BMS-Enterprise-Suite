/**
 * Product Category Domain Model
 * Multi-level hierarchical category system
 * 
 * BUSINESS RULES:
 * - Supports unlimited depth (Electronics > Phones > Accessories)
 * - Code must be unique for fast searching
 * - Cannot be deleted if has products (soft delete)
 * 
 * DESIGN RULES:
 * - Follows Odoo-style category hierarchy
 * - Optimized for 2000+ products filtering
 */
export interface ProductCategory {
  id: string;
  code: string;                    // Unique category code: "ELEC-PHONE-ACC"
  name: string;
  description: string | null;
  parentId: string | null;         // Null for root categories
  path: string;                    // Full path: "Electronics/Phones/Accessories"
  level: number;                   // 0 = root, 1 = child, 2 = grandchild
  displayOrder: number;            // For sorting in UI
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Category-specific settings
 * DESIGN RULES: Extensible for future features
 */
export interface CategorySettings {
  categoryId: string;
  defaultTaxRateId: string | null;
  requireExpiryDate: boolean;      // For perishable items
  requireSerialNumber: boolean;    // For high-value items
  allowDiscounts: boolean;
  maxDiscountPercent: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Category-Product mapping for many-to-many relationships
 * BUSINESS RULES: Product can belong to multiple categories
 */
export interface CategoryProduct {
  id: string;
  categoryId: string;
  productId: string;
  isPrimaryCategory: boolean;      // Main category for product
  displayOrder: number;            // Sorting within category
  createdAt: Date;
}

/**
 * Category statistics for dashboard widgets
 * Updated in real-time for performance
 */
export interface CategoryStats {
  categoryId: string;
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;        // Products below min stock level
  totalStockValue: number;         // SUM(costPrice * currentStock)
  lastUpdated: Date;
} 
