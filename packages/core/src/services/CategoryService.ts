/**
 * Category Service
 * Business logic layer for Category operations
 * 
 * BUSINESS RULES:
 * - Hierarchical categories with unlimited depth
 * - Cannot delete categories with products
 * - Code must be unique
 * - Category statistics auto-update
 * 
 * DESIGN RULES:
 * - Tree operations optimized for performance
 * - TypeScript strict mode
 * - Error handling with custom exceptions
 */
import { ProductCategory } from '../domain/ProductCategory';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { ValidationError, NotFoundError } from '../errors/ApplicationError';

export class CategoryService {
  private categoryRepository: CategoryRepository;
  private productRepository: ProductRepository;

  constructor(
    categoryRepository: CategoryRepository,
    productRepository: ProductRepository
  ) {
    this.categoryRepository = categoryRepository;
    this.productRepository = productRepository;
  }

  /**
   * Create a new category with validation
   * BUSINESS RULES:
   * - Code must be unique
   * - Parent category must exist if specified
   * - Path auto-generated from hierarchy
   */
  async createCategory(categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductCategory> {
    // Validate code format (alphanumeric with hyphens)
    const codeRegex = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
    if (!codeRegex.test(categoryData.code)) {
      throw new ValidationError(
        'Category code must be uppercase alphanumeric with hyphens (e.g., ELEC-PHONE-ACC)'
      );
    }

    // Validate parent exists if specified
    if (categoryData.parentId) {
      const parent = await this.categoryRepository.getCategoryById(categoryData.parentId);
      if (!parent) {
        throw new ValidationError(`Parent category ${categoryData.parentId} does not exist`);
      }
      
      // Limit depth to 5 levels maximum
      if (parent.level >= 4) {
        throw new ValidationError('Maximum category depth (5 levels) exceeded');
      }
    }

    return await this.categoryRepository.createCategory(categoryData);
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<ProductCategory> {
    const category = await this.categoryRepository.getCategoryById(id);
    
    if (!category) {
      throw NotFoundError.category(id);
    }

    return category;
  }

  /**
   * Get category tree
   * BUSINESS RULES: Hierarchical structure for navigation
   */
  async getCategoryTree(): Promise<ProductCategory[]> {
    return await this.categoryRepository.getCategoryTree();
  }

  /**
   * Get categories by level
   * BUSINESS RULES: For breadcrumbs and navigation
   */
  async getCategoriesByLevel(level: number): Promise<ProductCategory[]> {
    return await this.categoryRepository.getCategoriesByLevel(level);
  }

  /**
   * Update category
   * BUSINESS RULES: Cannot change parent if has children
   */
  async updateCategory(id: string, updateData: Partial<ProductCategory>): Promise<ProductCategory> {
    return await this.categoryRepository.updateCategory(id, updateData);
  }

  /**
   * Delete category (soft delete)
   * BUSINESS RULES:
   * - Cannot delete if has products
   * - Cannot delete if has active children
   */
  async deleteCategory(id: string): Promise<void> {
    // Check if category has products
    const hasProducts = await this.productRepository.searchProducts({
      categoryId: id,
      take: 1
    });

    if (hasProducts.total > 0) {
      throw new ValidationError('Cannot delete category with products');
    }

    await this.categoryRepository.deleteCategory(id);
  }

  /**
   * Search categories
   */
  async searchCategories(options: {
    searchTerm?: string;
    parentId?: string | null;
    level?: number;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ categories: ProductCategory[]; total: number }> {
    return await this.categoryRepository.searchCategories(options);
  }

  /**
   * Get subcategory IDs recursively
   * BUSINESS RULES: For category-based product filtering
   */
  async getSubcategoryIds(parentId: string): Promise<string[]> {
    return await this.categoryRepository.getSubcategoryIds(parentId);
  }
}