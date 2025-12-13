/**
 * Products API Routes
 * REST API routing for Product management
 * 
 * BUSINESS RULES:
 * - Role-based access control enforcement
 * - Input validation middleware
 * - Error handling
 * 
 * DESIGN RULES:
 * - Express.js router pattern
 * - Consistent URL structure
 * - Versioned API endpoints
 */
import { Router } from 'express';
import ProductsController from './products.controller';
import { validateRequest } from '../../middleware/validation.middleware';

const router = Router();

// Initialize controller (dependency injection would be handled by DI container)
const productsController = new ProductsController(
  // These dependencies would be injected in production
  {} as any, // ProductService
  {} as any, // CategoryService  
  {} as any  // StockService
);

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with filters
 * @access  Private (All authenticated users)
 */
router.get('/', productsController.searchProducts);

/**
 * @route   GET /api/v1/products/low-stock
 * @desc    Get low stock products
 * @access  Private (Admin, Manager)
 */
router.get('/low-stock', productsController.getLowStockProducts);

/**
 * @route   GET /api/v1/products/inventory-value
 * @desc    Get total inventory value
 * @access  Private (Admin, Manager)
 */
router.get('/inventory-value', productsController.getInventoryValue);

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Private (Admin, Manager)
 */
router.post('/', productsController.createProduct);

/**
 * @route   POST /api/v1/products/bulk-import
 * @desc    Bulk import products from CSV
 * @access  Private (Admin only)
 */
router.post('/bulk-import', productsController.bulkImport);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', productsController.getProduct);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product
 * @access  Private (Admin, Manager)
 */
router.put('/:id', productsController.updateProduct);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Admin only)
 */
router.delete('/:id', productsController.deleteProduct);

/**
 * @route   POST /api/v1/products/:id/stock
 * @desc    Update product stock quantity
 * @access  Private (Admin, Manager)
 */
router.post('/:id/stock', productsController.updateStock);

export default router; 
