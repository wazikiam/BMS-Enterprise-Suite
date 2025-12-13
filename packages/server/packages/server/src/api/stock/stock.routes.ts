/**
 * Stock API Routes
 * REST API routing for Stock Management
 * 
 * BUSINESS RULES:
 * - Real-time stock tracking
 * - Stock movements audit trail
 * - Low stock alerts system
 * - Stock reservations
 * 
 * DESIGN RULES:
 * - Express.js router pattern
 * - Consistent URL structure
 * - Versioned API endpoints
 */
import { Router } from 'express';
import StockController from './stock.controller';

const router = Router();

// Initialize controller
const stockController = new StockController(
  {} as any, // StockService
  {} as any  // ProductService
);

/**
 * @route   GET /api/v1/stock/summary
 * @desc    Get stock summary for dashboard
 * @access  Private (Admin, Manager)
 */
router.get('/summary', stockController.getStockSummary);

/**
 * @route   GET /api/v1/stock/alerts
 * @desc    Get active stock alerts
 * @access  Private (Admin, Manager)
 */
router.get('/alerts', stockController.getActiveAlerts);

/**
 * @route   GET /api/v1/stock/inventory-value
 * @desc    Get total inventory value
 * @access  Private (Admin, Manager)
 */
router.get('/inventory-value', stockController.getInventoryValue);

/**
 * @route   POST /api/v1/stock/check-low-stock
 * @desc    Manually check for low stock alerts
 * @access  Private (Admin only)
 */
router.post('/check-low-stock', stockController.checkLowStock);

/**
 * @route   GET /api/v1/stock/products/:productId
 * @desc    Get stock level for product
 * @access  Private (All authenticated users)
 */
router.get('/products/:productId', stockController.getStockLevel);

/**
 * @route   GET /api/v1/stock/products/:productId/movements
 * @desc    Get stock movements for product
 * @access  Private (All authenticated users)
 */
router.get('/products/:productId/movements', stockController.getProductMovements);

/**
 * @route   POST /api/v1/stock/products/:productId/adjust
 * @desc    Adjust stock quantity
 * @access  Private (Admin, Manager)
 */
router.post('/products/:productId/adjust', stockController.adjustStock);

/**
 * @route   POST /api/v1/stock/products/:productId/reserve
 * @desc    Reserve stock for sale
 * @access  Private (Admin, Manager, Seller)
 */
router.post('/products/:productId/reserve', stockController.reserveStock);

/**
 * @route   POST /api/v1/stock/movements
 * @desc    Create stock movement
 * @access  Private (Admin, Manager)
 */
router.post('/movements', stockController.createMovement);

/**
 * @route   POST /api/v1/stock/alerts/:alertId/acknowledge
 * @desc    Acknowledge stock alert
 * @access  Private (Admin, Manager)
 */
router.post('/alerts/:alertId/acknowledge', stockController.acknowledgeAlert);

/**
 * @route   POST /api/v1/stock/reservations/:reservationId/release
 * @desc    Release stock reservation
 * @access  Private (Admin, Manager, Seller)
 */
router.post('/reservations/:reservationId/release', stockController.releaseReservation);

export default router; 
