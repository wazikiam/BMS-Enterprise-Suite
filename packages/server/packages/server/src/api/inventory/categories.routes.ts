/**
 * Categories API Routes
 * REST API routing for Category management
 * 
 * BUSINESS RULES:
 * - Hierarchical category system
 * - Tree structure endpoints
 * - Role-based access control
 * 
 * DESIGN RULES:
 * - Express.js router pattern
 * - Consistent URL structure
 * - Versioned API endpoints
 */
import { Router } from 'express';
import CategoriesController from './categories.controller';

const router = Router();

// Initialize controller
const categoriesController = new CategoriesController(
  {} as any, // CategoryService
  {} as any  // ProductService
);

/**
 * @route   GET /api/v1/categories
 * @desc    Search categories
 * @access  Private (All authenticated users)
 */
router.get('/', categoriesController.searchCategories);

/**
 * @route   GET /api/v1/categories/tree
 * @desc    Get category tree structure
 * @access  Private (All authenticated users)
 */
router.get('/tree', categoriesController.getCategoryTree);

/**
 * @route   GET /api/v1/categories/root
 * @desc    Get root categories (level 0)
 * @access  Private (All authenticated users)
 */
router.get('/root', categoriesController.getRootCategories);

/**
 * @route   GET /api/v1/categories/level/:level
 * @desc    Get categories by level
 * @access  Private (All authenticated users)
 */
router.get('/level/:level', categoriesController.getCategoriesByLevel);

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new category
 * @access  Private (Admin, Manager)
 */
router.post('/', categoriesController.createCategory);

/**
 * @route   GET /api/v1/categories/:id
 * @desc    Get category by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', categoriesController.getCategory);

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    Update category
 * @access  Private (Admin, Manager)
 */
router.put('/:id', categoriesController.updateCategory);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete category (soft delete)
 * @access  Private (Admin only)
 */
router.delete('/:id', categoriesController.deleteCategory);

/**
 * @route   GET /api/v1/categories/:id/subcategories
 * @desc    Get subcategory IDs (recursive)
 * @access  Private (All authenticated users)
 */
router.get('/:id/subcategories', categoriesController.getSubcategoryIds);

export default router; 
