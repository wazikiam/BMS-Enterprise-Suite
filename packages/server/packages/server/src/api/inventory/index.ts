/**
 * Inventory Module API Routes
 * Main entry point for all inventory-related API routes
 * 
 * BUSINESS RULES:
 * - Organizes all inventory endpoints
 * - Versioned API structure
 * - Centralized route management
 * 
 * DESIGN RULES:
 * - Modular route organization
 * - Express.js router pattern
 * - Consistent API structure
 */
import { Router } from 'express';
import productsRoutes from './products.routes';
import categoriesRoutes from './categories.routes';
import stockRoutes from '../stock/stock.routes';

const router = Router();

/**
 * API Version: v1
 * Base Path: /api/v1
 * 
 * Routes organization:
 * - /products      - Product management
 * - /categories    - Category management  
 * - /stock         - Stock management
 */

// Mount product routes
router.use('/products', productsRoutes);

// Mount category routes
router.use('/categories', categoriesRoutes);

// Mount stock routes
router.use('/stock', stockRoutes);

/**
 * Inventory module health check
 * @route   GET /api/v1/inventory/health
 * @desc    Check inventory module status
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    module: 'inventory',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      products: '/api/v1/inventory/products',
      categories: '/api/v1/inventory/categories',
      stock: '/api/v1/inventory/stock'
    }
  });
});

/**
 * Inventory module statistics
 * @route   GET /api/v1/inventory/stats
 * @desc    Get inventory module statistics
 * @access  Private (Admin, Manager)
 */
router.get('/stats', (req, res) => {
  // TODO: Implement actual statistics
  res.status(200).json({
    success: true,
    data: {
      totalProducts: 0,
      totalCategories: 0,
      totalStockValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0
    }
  });
});

export default router; 
