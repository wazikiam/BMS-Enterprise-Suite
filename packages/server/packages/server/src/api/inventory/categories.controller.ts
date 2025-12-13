/**
 * Categories API Controller
 * REST API endpoints for Category management
 * 
 * BUSINESS RULES:
 * - Hierarchical category system
 * - Cannot delete categories with products
 * - Code uniqueness validation
 * - Tree structure for navigation
 * 
 * DESIGN RULES:
 * - Express.js controller pattern
 * - TypeScript strict mode
 * - Role-based access control
 */
import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../../../core/src/services/CategoryService';
import { ProductCategory } from '../../../core/src/domain/ProductCategory';
import { ValidationError, NotFoundError } from '../../../core/src/errors/ApplicationError';
import { authenticate, authorize } from '../auth/auth.middleware';

export class CategoriesController {
  private categoryService: CategoryService;

  constructor(categoryService: CategoryService) {
    this.categoryService = categoryService;
  }

  /**
   * Create a new category
   * ACCESS: Admin, Manager
   */
  createCategory = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const categoryData = req.body;
        
        // Validation
        if (!categoryData.code || !categoryData.name) {
          return res.status(400).json({
            success: false,
            error: 'Code and name are required'
          });
        }

        const category = await this.categoryService.createCategory(categoryData);
        
        res.status(201).json({
          success: true,
          data: category,
          message: 'Category created successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get category by ID
   * ACCESS: All authenticated users
   */
  getCategory = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const category = await this.categoryService.getCategoryById(id);
        
        res.status(200).json({
          success: true,
          data: category
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return res.status(404).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Get category tree
   * ACCESS: All authenticated users
   */
  getCategoryTree = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const categories = await this.categoryService.getCategoryTree();
        
        res.status(200).json({
          success: true,
          data: categories
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Update category
   * ACCESS: Admin, Manager
   */
  updateCategory = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        
        const category = await this.categoryService.updateCategory(id, updateData);
        
        res.status(200).json({
          success: true,
          data: category,
          message: 'Category updated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Delete category (soft delete)
   * ACCESS: Admin only
   */
  deleteCategory = [
    authenticate,
    authorize(['admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        await this.categoryService.deleteCategory(id);
        
        res.status(200).json({
          success: true,
          message: 'Category deleted successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Search categories
   * ACCESS: All authenticated users
   */
  searchCategories = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          searchTerm,
          parentId,
          level,
          isActive,
          page = '1',
          limit = '50'
        } = req.query;

        // Handle parentId = 'null' for root categories
        let parsedParentId: string | null | undefined = parentId as string;
        if (parentId === 'null') {
          parsedParentId = null;
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const take = parseInt(limit as string);

        const result = await this.categoryService.searchCategories({
          searchTerm: searchTerm as string,
          parentId: parsedParentId,
          level: level ? parseInt(level as string) : undefined,
          isActive: isActive !== undefined ? isActive === 'true' : undefined,
          skip,
          take
        });

        res.status(200).json({
          success: true,
          data: result.categories,
          pagination: {
            page: parseInt(page as string),
            limit: take,
            total: result.total,
            pages: Math.ceil(result.total / take)
          }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get categories by level
   * ACCESS: All authenticated users
   */
  getCategoriesByLevel = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { level } = req.params;
        const levelNumber = parseInt(level);
        
        if (isNaN(levelNumber) || levelNumber < 0) {
          return res.status(400).json({
            success: false,
            error: 'Level must be a positive number'
          });
        }

        const categories = await this.categoryService.getCategoriesByLevel(levelNumber);
        
        res.status(200).json({
          success: true,
          data: categories
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get subcategory IDs (recursive)
   * ACCESS: All authenticated users
   */
  getSubcategoryIds = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const subcategoryIds = await this.categoryService.getSubcategoryIds(id);
        
        res.status(200).json({
          success: true,
          data: subcategoryIds,
          count: subcategoryIds.length
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get root categories (level 0)
   * ACCESS: All authenticated users
   */
  getRootCategories = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await this.categoryService.searchCategories({
          parentId: null,
          isActive: true
        });
        
        res.status(200).json({
          success: true,
          data: result.categories
        });
      } catch (error) {
        next(error);
      }
    }
  ];
}

export default CategoriesController; 
