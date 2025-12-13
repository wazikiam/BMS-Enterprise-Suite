/**
 * Search Repository
 * Optimized search operations for 2000+ products
 * 
 * BUSINESS RULES:
 * - Fast full-text search across 2000+ products
 * - Category-based filtering with hierarchy support
 * - Price range filtering with performance
 * - Real-time stock availability checking
 * - Pagination with large datasets
 * 
 * DESIGN RULES:
 * - TypeScript strict mode
 * - Prisma ORM optimization
 * - Query optimization techniques
 * - Index-aware searching
 */
import { PrismaClient } from '@prisma/client';
import { Product } from '../domain/Product';

export interface SearchOptions {
  query?: string;
  categoryId?: string;
  includeSubcategories?: boolean;
  supplierId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  lowStockOnly?: boolean;
  isActive?: boolean;
  sortBy?: 'name' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'recent';
  skip?: number;
  take?: number;
}

export interface SearchResult {
  products: Product[];
  total: number;
  filters: {
    priceRange: { min: number; max: number };
    categories: Array<{ id: string; name: string; count: number }>;
    suppliers: Array<{ id: string; name: string; count: number }>;
  };
}

export class SearchRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Advanced product search optimized for 2000+ products
   * Uses multiple optimization techniques for performance
   */
  async searchProducts(options: SearchOptions): Promise<SearchResult> {
    const where: any = this.buildWhereClause(options);
    const orderBy = this.buildOrderBy(options.sortBy);

    // Execute search with optimized queries
    const [products, total, filters] = await Promise.all([
      this.executeSearchQuery(where, orderBy, options.skip, options.take),
      this.countResults(where),
      this.extractFilters(where)
    ]);

    return {
      products: products.map((p: any) => this.mapToProduct(p)),
      total,
      filters
    };
  }

  /**
   * Fast search by barcode or SKU
   * Optimized for point-of-sale scanning
   */
  async quickSearch(code: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { sku: { equals: code, mode: 'insensitive' } },
          { barcode: { equals: code } },
          { sku: { contains: code, mode: 'insensitive' } },
          { code: { equals: code, mode: 'insensitive' } } // ADDED: Search by code field
        ],
        isActive: true
      },
      include: {
        category: true,
        stockLevels: { where: { locationId: 'default' } }
      }
    });

    return product ? this.mapToProduct(product) : null;
  }

  /**
   * Search with category hierarchy
   * Includes all subcategories when requested
   */
  async searchByCategory(categoryId: string, includeSubcategories: boolean = true): Promise<Product[]> {
    let categoryIds = [categoryId];

    if (includeSubcategories) {
      // Get all subcategory IDs recursively
      const subcategoryIds = await this.getSubcategoryIds(categoryId);
      categoryIds = [...categoryIds, ...subcategoryIds];
    }

    const products = await this.prisma.product.findMany({
      where: {
        categoryId: { in: categoryIds },
        isActive: true
      },
      orderBy: { name: 'asc' },
      take: 1000 // Limit for performance
    });

    return products.map((p: any) => this.mapToProduct(p));
  }

  /**
   * Get low stock products with optimization
   */
  async findLowStockProducts(thresholdPercent: number = 0.3): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: this.prisma.product.fields.minStockLevel * thresholdPercent
        }
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

    return products.map((p: any) => this.mapToProduct(p));
  }

  /**
   * Get out of stock products
   */
  async findOutOfStockProducts(): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: 0
      },
      include: {
        category: true,
        supplier: true
      },
      orderBy: { name: 'asc' }
    });

    return products.map((p: any) => this.mapToProduct(p));
  }

  /**
   * Get recently added products
   */
  async findRecentProducts(days: number = 30): Promise<Product[]> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        createdAt: { gte: dateThreshold }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return products.map((p: any) => this.mapToProduct(p));
  }

  /**
   * Get best selling products (requires sales data integration)
   * Placeholder for Week 4 integration
   */
  async findBestSellingProducts(limit: number = 10): Promise<Product[]> {
    // TODO: Integrate with sales data in Week 4
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      take: limit
    });

    return products.map((p: any) => this.mapToProduct(p));
  }

  /**
   * Get products by supplier with stock info
   */
  async findProductsBySupplier(supplierId: string): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        supplierId,
        isActive: true
      },
      include: {
        category: true,
        stockLevels: { where: { locationId: 'default' } }
      },
      orderBy: { name: 'asc' }
    });

    return products.map((p: any) => this.mapToProduct(p));
  }

  /**
   * Build optimized WHERE clause for search
   */
  private buildWhereClause(options: SearchOptions): any {
    const where: any = {};

    // Text search across multiple fields
    if (options.query) {
      where.OR = [
        { name: { contains: options.query, mode: 'insensitive' } },
        { sku: { contains: options.query, mode: 'insensitive' } },
        { code: { contains: options.query, mode: 'insensitive' } }, // ADDED: Search by code
        { barcode: { contains: options.query, mode: 'insensitive' } },
        { description: { contains: options.query, mode: 'insensitive' } }
      ];
    }

    // Category filtering (with subcategory support handled separately)
    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    // Supplier filter
    if (options.supplierId) {
      where.supplierId = options.supplierId;
    }

    // Price range filtering
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      where.sellingPrice = {};
      if (options.minPrice !== undefined) {
        where.sellingPrice.gte = options.minPrice;
      }
      if (options.maxPrice !== undefined) {
        where.sellingPrice.lte = options.maxPrice;
      }
    }

    // Stock filters
    if (options.inStockOnly) {
      where.currentStock = { gt: 0 };
    }
    if (options.lowStockOnly) {
      where.currentStock = {
        lte: this.prisma.product.fields.minStockLevel,
        gt: 0
      };
    }

    // Active status filter
    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    return where;
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderBy(sortBy?: string): any {
    switch (sortBy) {
      case 'price_asc':
        return { sellingPrice: 'asc' };
      case 'price_desc':
        return { sellingPrice: 'desc' };
      case 'stock_asc':
        return { currentStock: 'asc' };
      case 'stock_desc':
        return { currentStock: 'desc' };
      case 'recent':
        return { createdAt: 'desc' };
      default:
        return { name: 'asc' };
    }
  }

  /**
   * Execute search query with optimizations
   */
  private async executeSearchQuery(where: any, orderBy: any, skip?: number, take?: number): Promise<any[]> {
    return await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        images: { 
          where: { isActive: true, priority: 1 },
          take: 1 
        },
        stockLevels: { 
          where: { locationId: 'default' },
          take: 1 
        }
      },
      orderBy,
      skip: skip || 0,
      take: take || 50
    });
  }

  /**
   * Count total results
   */
  private async countResults(where: any): Promise<number> {
    return await this.prisma.product.count({ where });
  }

  /**
   * Extract available filters from results
   */
  private async extractFilters(where: any): Promise<SearchResult['filters']> {
    const [priceRange, categories, suppliers] = await Promise.all([
      this.getPriceRange(where),
      this.getCategoryFilters(where),
      this.getSupplierFilters(where)
    ]);

    return {
      priceRange,
      categories,
      suppliers
    };
  }

  /**
   * Get price range for filter display
   */
  private async getPriceRange(where: any): Promise<{ min: number; max: number }> {
    const result = await this.prisma.product.aggregate({
      where,
      _min: { sellingPrice: true },
      _max: { sellingPrice: true }
    });

    return {
      min: result._min.sellingPrice || 0,
      max: result._max.sellingPrice || 0
    };
  }

  /**
   * Get category filters with counts
   */
  private async getCategoryFilters(where: any): Promise<Array<{ id: string; name: string; count: number }>> {
    const categories = await this.prisma.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    const categoryCounts = await Promise.all(
      categories.map(async (category: any) => {
        const count = await this.prisma.product.count({
          where: {
            ...where,
            categoryId: category.id
          }
        });
        return { ...category, count };
      })
    );

    return categoryCounts.filter((c: any) => c.count > 0);
  }

  /**
   * Get supplier filters with counts
   */
  private async getSupplierFilters(where: any): Promise<Array<{ id: string; name: string; count: number }>> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    const supplierCounts = await Promise.all(
      suppliers.map(async (supplier: any) => {
        const count = await this.prisma.product.count({
          where: {
            ...where,
            supplierId: supplier.id
          }
        });
        return { ...supplier, count };
      })
    );

    return supplierCounts.filter((s: any) => s.count > 0);
  }

  /**
   * Get all subcategory IDs recursively
   */
  private async getSubcategoryIds(parentId: string): Promise<string[]> {
    const getChildrenRecursive = async (categoryId: string): Promise<string[]> => {
      const children = await this.prisma.productCategory.findMany({
        where: { 
          parentId: categoryId,
          isActive: true 
        },
        select: { id: true }
      });

      let allIds = children.map((c: any) => c.id);
      
      for (const child of children) {
        const grandChildren = await getChildrenRecursive(child.id);
        allIds = [...allIds, ...grandChildren];
      }

      return allIds;
    };

    return getChildrenRecursive(parentId);
  }

  /**
   * Map database model to domain model
   */
  private mapToProduct(data: any): Product {
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