import { Product } from './Product';

export interface SaleOrderLineProps {
  id?: string;
  saleOrderId: string;
  productId: string;
  product?: Product;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  notes?: string;
  reservedStock?: number;
  deliveredQuantity?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SaleOrderLine {
  public readonly id?: string;
  public readonly saleOrderId: string;
  public readonly productId: string;
  public product?: Product;
  public productName: string;
  public productCode: string;
  public quantity: number;
  public unitPrice: number;
  public discountPercentage: number;
  public taxPercentage: number;
  public subtotal: number = 0;
  public taxAmount: number = 0;
  public total: number = 0;
  public notes?: string;
  public reservedStock: number = 0;
  public deliveredQuantity: number = 0;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: SaleOrderLineProps) {
    this.id = props.id;
    this.saleOrderId = props.saleOrderId;
    this.productId = props.productId;
    this.product = props.product;
    this.productName = props.productName;
    this.productCode = props.productCode;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.discountPercentage = props.discountPercentage;
    this.taxPercentage = props.taxPercentage;
    this.notes = props.notes;
    this.reservedStock = props.reservedStock ?? 0;
    this.deliveredQuantity = props.deliveredQuantity ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
    this.recalculateTotals();
  }

  /* =====================================================
     VALIDATION
     ===================================================== */
  private validate(): void {
    if (this.quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    if (this.unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    if (this.discountPercentage < 0 || this.discountPercentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }

    if (this.taxPercentage < 0) {
      throw new Error('Tax percentage cannot be negative');
    }

    if (this.reservedStock < 0) {
      throw new Error('Reserved stock cannot be negative');
    }

    if (this.deliveredQuantity < 0) {
      throw new Error('Delivered quantity cannot be negative');
    }

    if (this.deliveredQuantity > this.quantity) {
      throw new Error('Delivered quantity cannot exceed ordered quantity');
    }
  }

  /* =====================================================
     FINANCIAL CALCULATIONS
     ===================================================== */
  public recalculateTotals(): void {
    const gross = this.quantity * this.unitPrice;
    const discount = gross * (this.discountPercentage / 100);
    this.subtotal = gross - discount;
    this.taxAmount = this.subtotal * (this.taxPercentage / 100);
    this.total = this.subtotal + this.taxAmount;
  }

  /* =====================================================
     MUTATIONS (CONTROLLED)
     ===================================================== */
  public updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    if (newQuantity < this.deliveredQuantity) {
      throw new Error('New quantity cannot be less than delivered quantity');
    }

    if (this.reservedStock > newQuantity) {
      throw new Error('Reserved stock exceeds new quantity');
    }

    this.quantity = newQuantity;
    this.recalculateTotals();
  }

  public updateUnitPrice(newUnitPrice: number): void {
    if (newUnitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    this.unitPrice = newUnitPrice;
    this.recalculateTotals();
  }

  public updateDiscount(newDiscountPercentage: number): void {
    if (newDiscountPercentage < 0 || newDiscountPercentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }

    this.discountPercentage = newDiscountPercentage;
    this.recalculateTotals();
  }

  public updateTax(newTaxPercentage: number): void {
    if (newTaxPercentage < 0) {
      throw new Error('Tax percentage cannot be negative');
    }

    this.taxPercentage = newTaxPercentage;
    this.recalculateTotals();
  }

  /* =====================================================
     STOCK & DELIVERY (STATE ONLY)
     ===================================================== */
  public reserveStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Reservation quantity must be greater than zero');
    }

    if (this.reservedStock + quantity > this.quantity) {
      throw new Error('Total reserved stock cannot exceed ordered quantity');
    }

    this.reservedStock += quantity;
  }

  public releaseStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Release quantity must be greater than zero');
    }

    if (quantity > this.reservedStock) {
      throw new Error('Cannot release more than reserved stock');
    }

    this.reservedStock -= quantity;
  }

  public recordDelivery(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Delivered quantity must be greater than zero');
    }

    if (this.deliveredQuantity + quantity > this.quantity) {
      throw new Error('Delivered quantity exceeds ordered quantity');
    }

    this.deliveredQuantity += quantity;
  }

  /* =====================================================
     DERIVED STATE
     ===================================================== */
  public isFullyDelivered(): boolean {
    return this.deliveredQuantity === this.quantity;
  }

  public remainingToDeliver(): number {
    return this.quantity - this.deliveredQuantity;
  }

  public toJSON() {
    return {
      id: this.id,
      saleOrderId: this.saleOrderId,
      productId: this.productId,
      productName: this.productName,
      productCode: this.productCode,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      discountPercentage: this.discountPercentage,
      taxPercentage: this.taxPercentage,
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      total: this.total,
      notes: this.notes,
      reservedStock: this.reservedStock,
      deliveredQuantity: this.deliveredQuantity,
      isFullyDelivered: this.isFullyDelivered(),
      remainingToDeliver: this.remainingToDeliver(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
