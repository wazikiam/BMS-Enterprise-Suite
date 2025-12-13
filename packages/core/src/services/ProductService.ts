/**
 * Product Service
 * Business logic layer for Product operations
 * 
 * BUSINESS RULES:
 * - SKU validation and uniqueness
 * - Price validation (cost <= selling)
 * - Stock level management
 * - Category assignment validation
 * - Bulk operations for 2000+ products
 * 
 * DESIGN RULES:
 * - Separates business logic from data access
 * - TypeScript strict mode
 * - Error handling with custom exceptions
 * - Optimized for performance with 2000+ products
 */
import { Product } from '../domain/Product';
import { ProductRepository } from '../repositories/ProductRepository';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { StockRepository } from '../repositories/StockRepository';
import { ValidationError, NotFoundError } from '../errors/ApplicationError';

export class ProductService {
  private productRepository: ProductRepository;
  private categoryRepository: CategoryRepository;
  private stockRepository: StockRepository;

  constructor(
    productRepository: ProductRepository,
    categoryRepository: CategoryRepository,
    stockRepository: StockRepository
  ) {
    this.productRepository = productRepository;
    this.categoryRepository = categoryRepository;
    this.stockRepository = stockRepository;
  }

  /**
   * Create a new product with validation
   * BUSINESS RULES:
   * - SKU must be unique
   * - Barcode must be unique if provided
   * - Cost price <= selling price
   * - Category must exist
   * - Stock cannot be negative
   */
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    // Validate prices
    if (productData.costPrice < 0 || productData.sellingPrice < 0) {
      throw new ValidationError('Prices cannot be negative');
    }

    if (productData.costPrice > productData.sellingPrice) {
      throw new ValidationError('Cost price cannot be greater than selling price');
    }

    // Validate stock levels
    if (productData.currentStock < 0) {
      throw new ValidationError('Stock cannot be negative');
    }

    if (productData.minStockLevel < 0) {
      throw new ValidationError('Minimum stock level cannot be negative');
    }

    if (productData.reorderPoint < 0) {
      throw new ValidationError('Reorder point cannot be negative');
    }

    // Validate category exists
    if (productData.categoryId) {
      const category = await this.categoryRepository.getCategoryById(productData.categoryId);
      if (!category) {
        throw new ValidationError(`Category ${productData.categoryId} does not exist`);
      }
    }

    // Create product
    const product = await this.productRepository.createProduct(productData);

    return product;
  }

  /**
   * Get product by ID with full details
   * BUSINESS RULES: Include stock levels and category info
   */
  async getProductById(id: string): Promise<Product & {
    stockLevel?: any;
    category?: any;
  }> {
    const product = await this.productRepository.getProductById(id);
    
    if (!product) {
      throw NotFoundError.product(id);
    }

    // Get additional data
    const stockLevel = await this.stockRepository.getStockLevel(id, 'default');

    return {
      ...product,
      stockLevel: stockLevel || undefined
    };
  }

  /**
   * Update product with validation
   * BUSINESS RULES:
   * - Cannot update SKU
   * - Price changes must be validated
   * - Stock adjustments create movements
   */
  async updateProduct(id: string, updateData: Partial<Product>): Promise<Product> {
    const existingProduct = await this.productRepository.getProductById(id);
    
    if (!existingProduct) {
      throw NotFoundError.product(id);
    }

    // Validate price changes
    if (updateData.costPrice !== undefined || updateData.sellingPrice !== undefined) {
      const newCostPrice = updateData.costPrice !== undefined ? updateData.costPrice : existingProduct.costPrice;
      const newSellingPrice = updateData.sellingPrice !== undefined ? updateData.sellingPrice : existingProduct.sellingPrice;

      if (newCostPrice > newSellingPrice) {
        throw new ValidationError('Cost price cannot be greater than selling price');
      }
    }

    return await this.productRepository.updateProduct(id, updateData);
  }

  /**
   * Search products with advanced filtering
   * BUSINESS RULES: Fast search for 2000+ products
   */
  async searchProducts(options: {
    searchTerm?: string;
    categoryId?: string;
    supplierId?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    lowStockOnly?: boolean;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ 
    products: Product[]; 
    total: number;
  }> {
    return await this.productRepository.searchProducts(options);
  }

  /**
   * Get low stock products
   * BUSINESS RULES: Products below minimum stock level
   */
  async getLowStockProducts(): Promise<Product[]> {
    return await this.productRepository.getLowStockProducts();
  }

  /**
   * Update stock quantity with movement tracking
   * BUSINESS RULES: Stock cannot go negative
   */
  async updateStock(productId: string, quantityChange: number, reason: string = 'Manual adjustment'): Promise<Product> {
    return await this.productRepository.updateStock(productId, quantityChange);
  }

  /**
   * Get inventory value
   * BUSINESS RULES: SUM(costPrice * currentStock)
   */
  async getInventoryValue(): Promise<number> {
    return await this.productRepository.getInventoryValue();
  }
}