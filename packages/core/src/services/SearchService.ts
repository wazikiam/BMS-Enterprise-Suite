/**
 * Search Service
 * Business logic layer for search operations
 * 
 * BUSINESS RULES:
 * - Category-based filtering with hierarchy support
 * - Fast search response for 2000+ products
 * - Real-time stock availability integration
 * - Search result ranking and relevance
 * 
 * DESIGN RULES:
 * - TypeScript strict mode
 * - Separation of concerns
 * - Error handling with custom exceptions
 * - Performance optimization
 */
import { SearchRepository, SearchOptions, SearchResult } from '../repositories/SearchRepository';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { ValidationError } from '../errors/ApplicationError';

export class SearchService {
  private searchRepository: SearchRepository;
  private categoryRepository: CategoryRepository;

  constructor(
    searchRepository: SearchRepository,
    categoryRepository: CategoryRepository
  ) {
    this.searchRepository = searchRepository;
    this.categoryRepository = categoryRepository;
  }

  /**
   * Search products with advanced filtering
   * BUSINESS RULES: Optimized for 2000+ products
   */
  async searchProducts(options: SearchOptions): Promise<SearchResult> {
    // Validate price range
    if (options.minPrice !== undefined && options.maxPrice !== undefined) {
      if (options.minPrice > options.maxPrice) {
        throw new ValidationError('Minimum price cannot be greater than maximum price');
      }
    }

    // Handle category hierarchy
    if (options.categoryId && options.includeSubcategories) {
      // Get all subcategory IDs
      const subcategoryIds = await this.categoryRepository.getSubcategoryIds(options.categoryId);
      // This would require modifying the SearchRepository to accept multiple category IDs
      // For now, we'll pass the parent category ID
    }

    // Execute search
    return await this.searchRepository.searchProducts(options);
  }

  /**
   * Quick search by barcode, SKU, or name
   * BUSINESS RULES: Fast response for point-of-sale
   */
  async quickSearch(query: string): Promise<any> {
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query cannot be empty');
    }

    if (query.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    // Try exact match first (barcode/SKU)
    const exactMatch = await this.searchRepository.quickSearch(query);
    if (exactMatch) {
      return {
        type: 'exact',
        product: exactMatch
      };
    }

    // Fall back to general search
    const searchResult = await this.searchRepository.searchProducts({
      query,
      take: 5,
      sortBy: 'recent'
    });

    return {
      type: searchResult.products.length > 0 ? 'results' : 'no_results',
      products: searchResult.products,
      total: searchResult.total
    };
  }

  /**
   * Search by category with hierarchy support
   * BUSINESS RULES: Include all subcategories when requested
   */
  async searchByCategory(categoryId: string, options: {
    includeSubcategories?: boolean;
    inStockOnly?: boolean;
    sortBy?: string;
    skip?: number;
    take?: number;
  } = {}): Promise<SearchResult> {
    // Validate category exists
    const category = await this.categoryRepository.getCategoryById(categoryId);
    if (!category) {
      throw new ValidationError(`Category ${categoryId} not found`);
    }

    let categoryIds = [categoryId];

    // Get subcategory IDs if requested
    if (options.includeSubcategories) {
      const subcategoryIds = await this.categoryRepository.getSubcategoryIds(categoryId);
      categoryIds = [...categoryIds, ...subcategoryIds];
    }

    // Since SearchRepository doesn't support multiple category IDs yet,
    // we'll use the search method with the primary category ID
    const searchOptions: SearchOptions = {
      categoryId: categoryId, // Using primary category for now
      includeSubcategories: options.includeSubcategories,
      inStockOnly: options.inStockOnly,
      sortBy: options.sortBy as any,
      skip: options.skip,
      take: options.take || 50
    };

    return await this.searchRepository.searchProducts(searchOptions);
  }

  /**
   * Get low stock products with severity levels
   * BUSINESS RULES: Categorized by severity (critical, warning, attention)
   */
  async getLowStockProducts(severity: 'all' | 'critical' | 'warning' | 'attention' = 'all'): Promise<any[]> {
    const products = await this.searchRepository.findLowStockProducts();
    
    // Categorize by severity
    const categorizedProducts = products.map(product => {
      const stockPercentage = product.minStockLevel > 0 
        ? (product.currentStock / product.minStockLevel) * 100 
        : 100;
      
      let severityLevel: 'critical' | 'warning' | 'attention';
      
      if (product.currentStock === 0) {
        severityLevel = 'critical';
      } else if (stockPercentage <= 20) {
        severityLevel = 'critical';
      } else if (stockPercentage <= 50) {
        severityLevel = 'warning';
      } else {
        severityLevel = 'attention';
      }

      return {
        ...product,
        severity: severityLevel,
        stockPercentage,
        daysOfSupply: this.calculateDaysOfSupply(product)
      };
    });

    // Filter by requested severity
    if (severity !== 'all') {
      return categorizedProducts.filter(p => p.severity === severity);
    }

    return categorizedProducts;
  }

  /**
   * Get out of stock products
   * BUSINESS RULES: Products with zero stock
   */
  async getOutOfStockProducts(): Promise<any[]> {
    const products = await this.searchRepository.findOutOfStockProducts();
    
    return products.map(product => ({
      ...product,
      lastRestockDate: this.getLastRestockDate(product.id), // Would need movement data
      suggestedReorderQty: this.calculateReorderQuantity(product)
    }));
  }

  /**
   * Get recently added products
   * BUSINESS RULES: Products added in last X days
   */
  async getRecentProducts(days: number = 30): Promise<any[]> {
    if (days < 1 || days > 365) {
      throw new ValidationError('Days must be between 1 and 365');
    }

    const products = await this.searchRepository.findRecentProducts(days);
    
    return products.map(product => ({
      ...product,
      daysSinceAdded: Math.floor(
        (new Date().getTime() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    }));
  }

  /**
   * Get best selling products (requires sales integration)
   * BUSINESS RULES: Top products by sales volume
   */
  async getBestSellingProducts(period: 'day' | 'week' | 'month' | 'year' = 'month', limit: number = 10): Promise<any[]> {
    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    // TODO: Integrate with sales data in Week 4
    // For now, return recent products as placeholder
    const products = await this.searchRepository.findRecentProducts(30);
    
    return products.slice(0, limit).map((product, index) => ({
      ...product,
      rank: index + 1,
      salesCount: Math.floor(Math.random() * 100) + 1, // Placeholder
      revenue: Math.floor(Math.random() * 10000) + 1000 // Placeholder
    }));
  }

  /**
   * Get search suggestions (autocomplete)
   * BUSINESS RULES: Fast suggestions for search box
   */
  async getSearchSuggestions(query: string, limit: number = 10): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Get matching products
    const result = await this.searchRepository.searchProducts({
      query,
      take: limit,
      sortBy: 'name'
    });

    // Extract suggestions
    const suggestions = new Set<string>();
    
    result.products.forEach(product => {
      // Add product name
      suggestions.add(product.name);
      
      // Add category
      // suggestions.add(product.category?.name || '');
      
      // Add SKU if it contains the query
      if (product.sku.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(product.sku);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get search filters for UI
   * BUSINESS RULES: Dynamic filters based on current results
   */
  async getSearchFilters(options: SearchOptions): Promise<any> {
    const result = await this.searchRepository.searchProducts({
      ...options,
      take: 1 // We just need the filter data
    });

    return {
      priceRange: result.filters.priceRange,
      categories: result.filters.categories,
      suppliers: result.filters.suppliers,
      stockStatus: {
        inStock: result.products.filter(p => p.currentStock > 0).length,
        lowStock: result.products.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length,
        outOfStock: result.products.filter(p => p.currentStock === 0).length
      }
    };
  }

  /**
   * Calculate days of supply based on sales history
   * PRIVATE: Helper method for low stock calculations
   */
  private calculateDaysOfSupply(product: any): number {
    // TODO: Integrate with sales data in Week 4
    // For now, use a simple calculation based on current stock
    const averageDailySales = 5; // Placeholder
    return averageDailySales > 0 ? Math.floor(product.currentStock / averageDailySales) : 999;
  }

  /**
   * Calculate suggested reorder quantity
   * PRIVATE: Helper method for out of stock products
   */
  private calculateReorderQuantity(product: any): number {
    // Based on min stock level and average sales
    const averageDailySales = 5; // Placeholder
    const leadTimeDays = 7; // Placeholder
    const safetyStock = Math.ceil(averageDailySales * leadTimeDays * 1.5);
    
    return Math.max(product.minStockLevel * 2, safetyStock);
  }

  /**
   * Get last restock date (placeholder)
   * PRIVATE: Would need stock movement data
   */
  private getLastRestockDate(productId: string): Date | null {
    // TODO: Integrate with StockRepository in Week 4
    return null;
  }
} 
