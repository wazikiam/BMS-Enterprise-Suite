/**
 * Stock Movement Domain Model
 * Tracks all inventory changes for audit trail
 * 
 * BUSINESS RULES:
 * - Every stock change must create a movement record
 * - Stock cannot go negative (validated before movement)
 * - Movements are immutable once created
 * 
 * DESIGN RULES:
 * - Optimized for real-time validation (Week 4)
 * - Supports 2000+ products with fast queries
 */
export enum StockMovementType {
  PURCHASE_RECEIPT = 'PURCHASE_RECEIPT',       // Stock in from purchase
  SALE_DELIVERY = 'SALE_DELIVERY',             // Stock out from sale
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',       // Manual correction
  STOCK_TRANSFER = 'STOCK_TRANSFER',           // Between locations
  RETURN_CUSTOMER = 'RETURN_CUSTOMER',         // Customer return
  RETURN_SUPPLIER = 'RETURN_SUPPLIER',         // Supplier return
  DAMAGE_WRITE_OFF = 'DAMAGE_WRITE_OFF',       // Damaged stock
  PRODUCTION_IN = 'PRODUCTION_IN',             // Manufacturing input
  PRODUCTION_OUT = 'PRODUCTION_OUT'            // Manufacturing output
}

export enum StockMovementStatus {
  PENDING = 'PENDING',          // Created but not applied
  COMPLETED = 'COMPLETED',      // Successfully applied
  CANCELLED = 'CANCELLED',      // Cancelled by user
  REVERSED = 'REVERSED'         // Reversed by system
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId: string | null;      // Null if for base product
  movementType: StockMovementType;
  status: StockMovementStatus;
  
  // Quantity information
  quantityBefore: number;        // Stock before movement
  quantityChange: number;        // Positive = in, Negative = out
  quantityAfter: number;         // Stock after movement (calculated)
  
  // Reference documents
  referenceId: string | null;    // SaleOrderId, PurchaseOrderId, etc.
  referenceNumber: string | null;// Document number for display
  
  // Location tracking (single warehouse for now, multi-warehouse ready)
  locationId: string;            // Default warehouse
  destinationLocationId: string | null;  // For transfers
  
  // Pricing information
  unitCost: number | null;       // Cost per unit at time of movement
  totalValue: number | null;     // unitCost * quantityChange
  
  // User tracking
  userId: string;                // Who performed the action
  notes: string | null;          // Reason for adjustment
  
  // Timestamps
  movementDate: Date;            // When it physically happened
  completedAt: Date | null;      // When stock was actually updated
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Stock Level snapshot
 * BUSINESS RULES: Real-time stock for 2000+ products
 * DESIGN RULES: Updated by trigger/transaction
 */
export interface StockLevel {
  id: string;
  productId: string;
  variantId: string | null;
  locationId: string;
  currentStock: number;           // Real-time quantity
  reservedStock: number;          // Reserved for sales (Week 4)
  availableStock: number;         // currentStock - reservedStock
  lastMovementId: string | null;  // Last movement that affected this
  lastUpdated: Date;
}

/**
 * Stock Alert for low stock levels
 * BUSINESS RULES: Automatic alerts when below threshold
 * DESIGN RULES: Configurable per product
 */
export interface StockAlert {
  id: string;
  productId: string;
  variantId: string | null;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON';
  thresholdValue: number;         // For LOW_STOCK: min stock level
  currentValue: number;           // Current stock when alert triggered
  isActive: boolean;              // Active alerts only
  acknowledgedBy: string | null;  // User who acknowledged
  acknowledgedAt: Date | null;
  triggeredAt: Date;
  resolvedAt: Date | null;
}

/**
 * Stock Reservation for sales (Week 4 preparation)
 * DESIGN RULES: Prevents overselling
 */
export interface StockReservation {
  id: string;
  productId: string;
  variantId: string | null;
  saleOrderId: string | null;
  saleOrderLineId: string | null;
  quantity: number;
  status: 'RESERVED' | 'RELEASED' | 'CONSUMED';
  expiresAt: Date;                // Auto-release if not consumed
  createdAt: Date;
  updatedAt: Date;
} 
