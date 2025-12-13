import { Router } from 'express';
import { SalesController, createSalesController } from './sales.controller';
import { SaleOrderService } from '../../../core/services/SaleOrderService';
import { authenticate } from '../auth/middleware/authenticate';
import { authorize } from '../auth/middleware/authorize';
import { UserRole } from '../../../core/domain/User';

// This would be imported from actual implementations
// For now, we'll create placeholder dependencies
const createPlaceholderDependencies = () => {
  // Placeholder repositories and services
  // In real implementation, these would be properly injected
  const saleOrderRepository = {} as any;
  const customerRepository = {} as any;
  const productRepository = {} as any;
  const stockRepository = {} as any;
  const paymentRepository = {} as any;
  const creditService = {} as any;
  const userRepository = {} as any;

  const saleOrderService = new SaleOrderService(
    saleOrderRepository,
    customerRepository,
    productRepository,
    stockRepository,
    paymentRepository,
    creditService,
    userRepository
  );

  return { saleOrderService };
};

export function createSalesRoutes(): Router {
  const router = Router();
  const { saleOrderService } = createPlaceholderDependencies();
  const salesController = createSalesController(saleOrderService);

  // Apply authentication to all sales routes
  router.use(authenticate);

  // ============================================
  // Sale Order Routes
  // ============================================

  /**
   * @route   GET /api/sales/orders
   * @desc    List all sale orders with pagination
   * @access  Private (Seller, Manager, Admin)
   */
  router.get(
    '/orders',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.listSaleOrders.bind(salesController)
  );

  /**
   * @route   POST /api/sales/orders
   * @desc    Create a new sale order
   * @access  Private (Seller, Manager, Admin)
   */
  router.post(
    '/orders',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.createSaleOrder.bind(salesController)
  );

  /**
   * @route   GET /api/sales/orders/:id
   * @desc    Get sale order by ID
   * @access  Private (Seller, Manager, Admin)
   */
  router.get(
    '/orders/:id',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.getSaleOrder.bind(salesController)
  );

  /**
   * @route   PUT /api/sales/orders/:id
   * @desc    Update sale order
   * @access  Private (Seller, Manager, Admin)
   * @note    Only allowed for DRAFT and CONFIRMED orders
   */
  router.put(
    '/orders/:id',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.updateSaleOrder.bind(salesController)
  );

  /**
   * @route   POST /api/sales/orders/:id/validate
   * @desc    Validate sale order (move to validated status)
   * @access  Private (Manager, Admin)
   */
  router.post(
    '/orders/:id/validate',
    authorize([UserRole.MANAGER, UserRole.ADMIN]),
    salesController.validateSaleOrder.bind(salesController)
  );

  /**
   * @route   POST /api/sales/orders/:id/cancel
   * @desc    Cancel sale order
   * @access  Private (Manager, Admin)
   * @note    Cannot cancel COMPLETED orders
   */
  router.post(
    '/orders/:id/cancel',
    authorize([UserRole.MANAGER, UserRole.ADMIN]),
    salesController.cancelSaleOrder.bind(salesController)
  );

  /**
   * @route   GET /api/sales/customers/:customerId/orders
   * @desc    Get sale orders by customer
   * @access  Private (Seller, Manager, Admin)
   */
  router.get(
    '/customers/:customerId/orders',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.getOrdersByCustomer.bind(salesController)
  );

  /**
   * @route   GET /api/sales/orders-by-date
   * @desc    Get sale orders by date range
   * @access  Private (Manager, Admin)
   */
  router.get(
    '/orders-by-date',
    authorize([UserRole.MANAGER, UserRole.ADMIN]),
    salesController.getOrdersByDateRange.bind(salesController)
  );

  // ============================================
  // Payment Routes
  // ============================================

  /**
   * @route   POST /api/sales/orders/:id/payments
   * @desc    Add payment to sale order
   * @access  Private (Seller, Manager, Admin)
   */
  router.post(
    '/orders/:id/payments',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.addPayment.bind(salesController)
  );

  /**
   * @route   POST /api/sales/payments/:paymentId/process
   * @desc    Process payment (record actual payment collection)
   * @access  Private (Seller, Manager, Admin)
   */
  router.post(
    '/payments/:paymentId/process',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.processPayment.bind(salesController)
  );

  // ============================================
  // Validation Routes
  // ============================================

  /**
   * @route   POST /api/sales/validate-stock
   * @desc    Validate stock for sale order lines
   * @access  Private (Seller, Manager, Admin)
   */
  router.post(
    '/validate-stock',
    authorize([UserRole.SELLER, UserRole.MANAGER, UserRole.ADMIN]),
    salesController.validateStock.bind(salesController)
  );

  /**
   * @route   POST /api/sales/customers/:customerId/validate-credit
   * @desc    Validate credit limit for customer
   * @access  Private (Manager, Admin)
   */
  router.post(
    '/customers/:customerId/validate-credit',
    authorize([UserRole.MANAGER, UserRole.ADMIN]),
    salesController.validateCreditLimit.bind(salesController)
  );

  // ============================================
  // Report Routes
  // ============================================

  /**
   * @route   GET /api/sales/report
   * @desc    Get sales report
   * @access  Private (Manager, Admin)
   */
  router.get(
    '/report',
    authorize([UserRole.MANAGER, UserRole.ADMIN]),
    salesController.getSalesReport.bind(salesController)
  );

  // ============================================
  // Health Check Route (Public)
  // ============================================

  /**
   * @route   GET /api/sales/health
   * @desc    Sales module health check
   * @access  Public
   */
  router.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Sales module is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // ============================================
  // Error Handling Middleware
  // ============================================

  // 404 handler for sales routes
  router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Sales route not found: ${req.originalUrl}`
    });
  });

  // Error handler
  router.use((error: any, req: any, res: any, next: any) => {
    console.error('Sales route error:', error);
    
    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error in sales module',
      requestId: req.id || 'unknown'
    });
  });

  return router;
}

// Export the router creation function
export default createSalesRoutes;

// ============================================
// Route Documentation
// ============================================

/**
 * @swagger
 * tags:
 *   name: Sales
 *   description: Sales order management and payment processing
 */

/**
 * @swagger
 * /api/sales/health:
 *   get:
 *     summary: Sales module health check
 *     tags: [Sales]
 *     responses:
 *       200:
 *         description: Sales module is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Sales module is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */

/**
 * @swagger
 * /api/sales/orders:
 *   get:
 *     summary: List all sale orders with pagination
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, confirmed, validated, partially_paid, fully_paid, completed, cancelled, credit_hold]
 *         description: Filter by order status
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders to this date
 *     responses:
 *       200:
 *         description: List of sale orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SaleOrder'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */

/**
 * @swagger
 * /api/sales/orders:
 *   post:
 *     summary: Create a new sale order
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSaleOrderRequest'
 *     responses:
 *       201:
 *         description: Sale order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SaleOrder'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */

/**
 * @swagger
 * /api/sales/orders/{id}:
 *   get:
 *     summary: Get sale order by ID
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sale order ID
 *     responses:
 *       200:
 *         description: Sale order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SaleOrder'
 *       404:
 *         description: Sale order not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */

// Note: Additional Swagger documentation would be added for all routes
// This is just a sample for the structure