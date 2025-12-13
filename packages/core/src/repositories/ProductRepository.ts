/**
 * Product Repository
 * Database operations for Product domain
 * 
 * BUSINESS RULES:
 * - Optimized for 2000+ products
 * - Fast search with category filtering
 * - Real-time stock updates
 * 
 * DESIGN RULES:
 * - TypeScript strict mode
 * - Prisma ORM patterns
 * - Error handling with custom exceptions
 */
import { PrismaClient } from '@prisma/client';
import { Product, ProductVariant, ProductImage, Barcode } from '../domain/Product';
import { NotFoundError, ValidationError } from '../errors/ApplicationError';

export class ProductRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new product
   * BUSINESS RULES: SKU must be unique
   */
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    // Check if SKU already exists
    const existing = await this.prisma.product.findUnique({
      where: { sku: productData.sku }
    });

    if (existing) {
      throw new ValidationError(`Product with SKU ${productData.sku} already exists`);
    }

    // Check if barcode is unique if provided
    if (productData.barcode) {
      const barcodeExists = await this.prisma.product.findFirst({
        where: { barcode: productData.barcode }
      });

      if (barcodeExists) {
        throw new ValidationError(`Product with barcode ${productData.barcode} already exists`);
      }
    }

    // Create product
    const product = await this.prisma.product.create({
      data: {
        sku: productData.sku,
        code: productData.code || '', // ADDED
        name: productData.name,
        description: productData.description,
        barcode: productData.barcode,
        costPrice: productData.costPrice,
        sellingPrice: productData.sellingPrice,
        categoryId: productData.categoryId,
        currentStock: productData.currentStock || 0,
        reservedStock: productData.reservedStock || 0, // ADDED
        availableStock: productData.availableStock || productData.currentStock || 0, // ADDED
        minStockLevel: productData.minStockLevel || 0,
        reorderPoint: productData.reorderPoint || 0,
        supplierId: productData.supplierId,
        taxRateId: productData.taxRateId,
        weight: productData.weight,
        dimensions: productData.dimensions,
        allowBackorders: productData.allowBackorders || false, // ADDED
        isActive: productData.isActive !== undefined ? productData.isActive : true
      }
    });

    return this.mapToDomain(product);
  }

  /**
   * Get product by ID
   * DESIGN RULES: Includes related data for performance
   */
  async getProductById(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
        images: true,
        barcodes: true
      }
    });

    if (!product) return null;
    return this.mapToDomain(product);
  }

  /**
   * Get product by SKU
   * BUSINESS RULES: Fast SKU lookup for sales
   */
  async getProductBySku(sku: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: {
        category: true,
        variants: { where: { isActive: true } },
        images: { where: { isActive: true }, orderBy: { priority: 'asc' } }
      }
    });

    if (!product) return null;
    return this.mapToDomain(product);
  }

  /**
   * Get product by barcode
   * BUSINESS RULES: Fast barcode scanning
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({
      where: { barcode },
      include: {
        category: true,
        variants: { where: { isActive: true } }
      }
    });

    if (!product) return null;
    return this.mapToDomain(product);
  }

  /**
   * Update product
   * BUSINESS RULES: Cannot update SKU after creation
   */
  async updateProduct(id: string, productData: Partial<Product>): Promise<Product> {
    // Prevent SKU updates
    if (productData.sku) {
      delete productData.sku;
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        code: productData.code, // ADDED
        name: productData.name,
        description: productData.description,
        barcode: productData.barcode,
        costPrice: productData.costPrice,
        sellingPrice: productData.sellingPrice,
        categoryId: productData.categoryId,
        reservedStock: productData.reservedStock, // ADDED
        availableStock: productData.availableStock, // ADDED
        minStockLevel: productData.minStockLevel,
        reorderPoint: productData.reorderPoint,
        weight: productData.weight,
        dimensions: productData.dimensions,
        allowBackorders: productData.allowBackorders, // ADDED
        isActive: productData.isActive,
        updatedAt: new Date()
      }
    });

    return this.mapToDomain(updated);
  }

  /**
   * Delete product (soft delete)
   * BUSINESS RULES: Cannot delete if has sales history
   */
  async deleteProduct(id: string): Promise<void> {
    // Check if product has sales history
    const hasSales = await this.prisma.saleOrderLine.count({
      where: { productId: id }
    }) > 0;

    if (hasSales) {
      throw new ValidationError('Cannot delete product with sales history');
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() }
    });
  }

  /**
   * Search products with filters
   * BUSINESS RULES: Fast search for 2000+ products
   * DESIGN RULES: Category-based filtering optimized
   */
  async searchProducts(options: {
    searchTerm?: string;
    categoryId?: string;
    supplierId?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ products: Product[]; total: number }> {
    const where: any = {};

    // Search term (name, SKU, barcode, description)
    if (options.searchTerm) {
      where.OR = [
        { name: { contains: options.searchTerm, mode: 'insensitive' } },
        { sku: { contains: options.searchTerm, mode: 'insensitive' } },
        { code: { contains: options.searchTerm, mode: 'insensitive' } }, // ADDED
        { barcode: { contains: options.searchTerm, mode: 'insensitive' } },
        { description: { contains: options.searchTerm, mode: 'insensitive' } }
      ];
    }

    // Category filter (including subcategories)
    if (options.categoryId) {
      // TODO: Implement subcategory inclusion when CategoryRepository is ready
      where.categoryId = options.categoryId;
    }

    // Other filters
    if (options.supplierId) where.supplierId = options.supplierId;
    if (options.minPrice !== undefined) where.sellingPrice = { gte: options.minPrice };
    if (options.maxPrice !== undefined) {
      where.sellingPrice = where.sellingPrice || {};
      where.sellingPrice.lte = options.maxPrice;
    }
    if (options.inStockOnly) where.currentStock = { gt: 0 };
    if (options.isActive !== undefined) where.isActive = options.isActive;

    // Execute query
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          images: { where: { isActive: true }, orderBy: { priority: 'asc' }, take: 1 }
        },
        orderBy: { name: 'asc' },
        skip: options.skip || 0,
        take: options.take || 50
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      products: products.map((p: any) => this.mapToDomain(p)),
      total
    };
  }

  /**
   * Update stock quantity
   * BUSINESS RULES: Real-time stock updates with validation
   */
  async updateStock(productId: string, quantityChange: number): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw NotFoundError.product(productId);
    }

    const newStock = product.currentStock + quantityChange;

    // Validate stock cannot go negative
    if (newStock < 0) {
      throw new ValidationError(
        `Insufficient stock for product ${product.sku}. ` +
        `Current: ${product.currentStock}, Requested: ${-quantityChange}`
      );
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        currentStock: newStock,
        availableStock: newStock - (product.reservedStock || 0), // ADDED: Update availableStock
        updatedAt: new Date()
      }
    });

    return this.mapToDomain(updated);
  }

  /**
   * Get low stock products
   * BUSINESS RULES: Products below min stock level
   */
  async getLowStockProducts(threshold?: number): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { lte: threshold !== undefined ? threshold : { lte: { minStockLevel: true } } }
      },
      include: {
        category: true,
        supplier: true
      },
      orderBy: [
        { currentStock: 'asc' },
        { name: 'asc' }
      ]
    });

    return products.map((p: any) => this.mapToDomain(p));
  }

  /**
   * Get total inventory value
   * BUSINESS RULES: SUM(costPrice * currentStock)
   */
  async getInventoryValue(): Promise<number> {
    const result = await this.prisma.product.aggregate({
      where: { isActive: true },
      _sum: {
        inventoryValue: true // Assuming computed field or need calculation
      }
    });

    return result._sum.inventoryValue || 0;
  }

  /**
   * Map Prisma model to domain model
   */
  private mapToDomain(data: any): Product {
    return {
      id: data.id,
      sku: data.sku,
      code: data.code || '', // ADDED
      name: data.name,
      description: data.description,
      barcode: data.barcode,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      categoryId: data.categoryId,
      currentStock: data.currentStock,
      reservedStock: data.reservedStock || 0, // ADDED
      availableStock: data.availableStock || (data.currentStock - (data.reservedStock || 0)), // ADDED
      minStockLevel: data.minStockLevel,
      reorderPoint: data.reorderPoint,
      supplierId: data.supplierId,
      taxRateId: data.taxRateId,
      weight: data.weight,
      dimensions: data.dimensions,
      allowBackorders: data.allowBackorders || false, // ADDED
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      quantity: data.quantity || 0 // ADDED
    };
  }
}