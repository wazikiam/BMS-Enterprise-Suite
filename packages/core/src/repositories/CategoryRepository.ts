/**
 * Category Repository
 * Database operations for ProductCategory domain
 * 
 * BUSINESS RULES:
 * - Hierarchical categories with unlimited depth
 * - Fast category-based filtering for 2000+ products
 * - Cannot delete categories with products
 * 
 * DESIGN RULES:
 * - Optimized for tree operations
 * - Recursive queries for subcategories
 */
import { PrismaClient } from '@prisma/client';
import { ProductCategory, CategorySettings, CategoryStats } from '../domain/ProductCategory';
import { NotFoundError, ValidationError } from '../errors/ApplicationError';

export class CategoryRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new category
   * BUSINESS RULES: Code must be unique
   */
  async createCategory(categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductCategory> {
    // Check if code already exists
    const existing = await this.prisma.productCategory.findUnique({
      where: { code: categoryData.code }
    });

    if (existing) {
      throw new ValidationError(`Category with code ${categoryData.code} already exists`);
    }

    // Calculate path and level if parent is provided
    let path = categoryData.name;
    let level = 0;

    if (categoryData.parentId) {
      const parent = await this.prisma.productCategory.findUnique({
        where: { id: categoryData.parentId }
      });

      if (!parent) {
        throw NotFoundError.parentCategory(categoryData.parentId);
      }

      path = `${parent.path}/${categoryData.name}`;
      level = parent.level + 1;
    }

    // Create category
    const category = await this.prisma.productCategory.create({
      data: {
        code: categoryData.code,
        name: categoryData.name,
        description: categoryData.description,
        parentId: categoryData.parentId,
        path,
        level,
        displayOrder: categoryData.displayOrder || 0,
        imageUrl: categoryData.imageUrl,
        isActive: categoryData.isActive !== undefined ? categoryData.isActive : true
      }
    });

    return this.mapToDomain(category);
  }

  /**
   * Get category by ID
   * DESIGN RULES: Includes parent and children for tree views
   */
  async getCategoryById(id: string): Promise<ProductCategory | null> {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        settings: true,
        stats: true
      }
    });

    if (!category) return null;
    return this.mapToDomain(category);
  }

  /**
   * Get category by code
   * BUSINESS RULES: Fast code lookup
   */
  async getCategoryByCode(code: string): Promise<ProductCategory | null> {
    const category = await this.prisma.productCategory.findUnique({
      where: { code },
      include: {
        parent: true,
        children: { where: { isActive: true } }
      }
    });

    if (!category) return null;
    return this.mapToDomain(category);
  }

  /**
   * Update category
   * BUSINESS RULES: Cannot change parent if has children
   */
  async updateCategory(id: string, categoryData: Partial<ProductCategory>): Promise<ProductCategory> {
    // Prevent parent change if category has children
    if (categoryData.parentId !== undefined) {
      const hasChildren = await this.prisma.productCategory.count({
        where: { parentId: id, isActive: true }
      }) > 0;

      if (hasChildren) {
        throw new ValidationError('Cannot change parent of category that has children');
      }
    }

    // If parent changed, recalculate path and level
    let updateData: any = { ...categoryData };
    
    if (categoryData.parentId || categoryData.name) {
      const current = await this.prisma.productCategory.findUnique({
        where: { id },
        include: { parent: true }
      });

      if (!current) {
        throw NotFoundError.category(id);
      }

      const newParentId = categoryData.parentId !== undefined ? categoryData.parentId : current.parentId;
      const newName = categoryData.name || current.name;

      if (newParentId) {
        const parent = await this.prisma.productCategory.findUnique({
          where: { id: newParentId }
        });

        if (!parent) {
          throw NotFoundError.parentCategory(newParentId);
        }

        updateData.path = `${parent.path}/${newName}`;
        updateData.level = parent.level + 1;
      } else {
        updateData.path = newName;
        updateData.level = 0;
      }
    }

    updateData.updatedAt = new Date();

    const updated = await this.prisma.productCategory.update({
      where: { id },
      data: updateData
    });

    return this.mapToDomain(updated);
  }

  /**
   * Delete category (soft delete)
   * BUSINESS RULES: Cannot delete if has products or active children
   */
  async deleteCategory(id: string): Promise<void> {
    // Check if category has products
    const hasProducts = await this.prisma.product.count({
      where: { categoryId: id, isActive: true }
    }) > 0;

    if (hasProducts) {
      throw new ValidationError('Cannot delete category with products');
    }

    // Check if category has active children
    const hasActiveChildren = await this.prisma.productCategory.count({
      where: { parentId: id, isActive: true }
    }) > 0;

    if (hasActiveChildren) {
      throw new ValidationError('Cannot delete category with active subcategories');
    }

    // Soft delete
    await this.prisma.productCategory.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() }
    });
  }

  /**
   * Get all categories in tree structure
   * DESIGN RULES: Optimized for sidebar navigation
   */
  async getCategoryTree(includeInactive: boolean = false): Promise<ProductCategory[]> {
    const where = includeInactive ? {} : { isActive: true };
    
    const categories = await this.prisma.productCategory.findMany({
      where,
      orderBy: [
        { level: 'asc' },
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    // Build tree structure
    return this.buildCategoryTree(categories);
  }

  /**
   * Get categories by level
   * BUSINESS RULES: For breadcrumbs and navigation
   */
  async getCategoriesByLevel(level: number): Promise<ProductCategory[]> {
    const categories = await this.prisma.productCategory.findMany({
      where: { level, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { products: { where: { isActive: true } } }
        }
      }
    });

    return categories.map((c: any) => this.mapToDomain(c));
  }

  /**
   * Get subcategories recursively
   * BUSINESS RULES: For category-based product filtering
   */
  async getSubcategoryIds(parentId: string): Promise<string[]> {
    const getChildrenRecursive = async (categoryId: string): Promise<string[]> => {
      const children = await this.prisma.productCategory.findMany({
        where: { parentId: categoryId, isActive: true },
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
   * Search categories
   * DESIGN RULES: Fast search for category management
   */
  async searchCategories(options: {
    searchTerm?: string;
    parentId?: string | null; // null for root categories
    level?: number;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ categories: ProductCategory[]; total: number }> {
    const where: any = {};

    if (options.searchTerm) {
      where.OR = [
        { name: { contains: options.searchTerm, mode: 'insensitive' } },
        { code: { contains: options.searchTerm, mode: 'insensitive' } },
        { description: { contains: options.searchTerm, mode: 'insensitive' } }
      ];
    }

    if (options.parentId !== undefined) {
      where.parentId = options.parentId;
    }

    if (options.level !== undefined) {
      where.level = options.level;
    }

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [categories, total] = await Promise.all([
      this.prisma.productCategory.findMany({
        where,
        include: {
          parent: true,
          _count: {
            select: { 
              products: { where: { isActive: true } },
              children: { where: { isActive: true } }
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { displayOrder: 'asc' },
          { name: 'asc' }
        ],
        skip: options.skip || 0,
        take: options.take || 50
      }),
      this.prisma.productCategory.count({ where })
    ]);

    return {
      categories: categories.map((c: any) => this.mapToDomain(c)),
      total
    };
  }

  /**
   * Update category statistics
   * BUSINESS RULES: Real-time stats for dashboard
   */
  async updateCategoryStats(categoryId: string): Promise<CategoryStats> {
    // Get all products in category and subcategories
    const subcategoryIds = await this.getSubcategoryIds(categoryId);
    const allCategoryIds = [categoryId, ...subcategoryIds];

    // Aggregate statistics
    const stats = await this.prisma.product.aggregate({
      where: {
        categoryId: { in: allCategoryIds },
        isActive: true
      },
      _count: { id: true },
      _sum: {
        currentStock: true,
        costPrice: true
      }
    });

    // Count low stock products
    const lowStockCount = await this.prisma.product.count({
      where: {
        categoryId: { in: allCategoryIds },
        isActive: true,
        currentStock: { lte: { minStockLevel: true } }
      }
    });

    // Create or update stats
    const categoryStats = await this.prisma.categoryStats.upsert({
      where: { categoryId },
      create: {
        categoryId,
        totalProducts: stats._count.id || 0,
        activeProducts: stats._count.id || 0,
        lowStockProducts: lowStockCount,
        totalStockValue: (stats._sum.costPrice || 0) * (stats._sum.currentStock || 0),
        lastUpdated: new Date()
      },
      update: {
        totalProducts: stats._count.id || 0,
        activeProducts: stats._count.id || 0,
        lowStockProducts: lowStockCount,
        totalStockValue: (stats._sum.costPrice || 0) * (stats._sum.currentStock || 0),
        lastUpdated: new Date()
      }
    });

    return {
      categoryId: categoryStats.categoryId,
      totalProducts: categoryStats.totalProducts,
      activeProducts: categoryStats.activeProducts,
      lowStockProducts: categoryStats.lowStockProducts,
      totalStockValue: categoryStats.totalStockValue,
      lastUpdated: categoryStats.lastUpdated
    };
  }

  /**
   * Build hierarchical tree from flat list
   */
  private buildCategoryTree(categories: any[], parentId: string | null = null): ProductCategory[] {
    return categories
      .filter((category: any) => category.parentId === parentId)
      .map((category: any) => ({
        ...this.mapToDomain(category),
        children: this.buildCategoryTree(categories, category.id)
      }));
  }

  /**
   * Map Prisma model to domain model
   */
  private mapToDomain(data: any): ProductCategory {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      parentId: data.parentId,
      path: data.path,
      level: data.level,
      displayOrder: data.displayOrder,
      imageUrl: data.imageUrl,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}