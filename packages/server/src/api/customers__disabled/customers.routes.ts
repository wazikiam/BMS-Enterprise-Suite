// packages/server/src/api/customers/customers.routes.ts
import { Router } from 'express';
import { CustomersController } from './customers.controller';
import { CustomerValidators } from './customers.validator';
import { authMiddleware } from '../auth/auth.middleware';
import { rbacMiddleware } from '../../middleware/rbac.middleware';
import { permissionMiddleware } from '../../middleware/permission.middleware';

export function createCustomersRouter(customerController: CustomersController): Router {
  const router = Router();

  // Apply authentication middleware to all customer routes
  router.use(authMiddleware);

  // ========== CUSTOMER CRUD ROUTES ==========

  // Create customer
  router.post(
    '/',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCreateCustomer),
    (req, res, next) => customerController.createCustomer(req, res).catch(next)
  );

  // Get customer by ID
  router.get(
    '/:id',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.getCustomer(req, res).catch(next)
  );

  // Get customer by code
  router.get(
    '/code/:code',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerCode),
    (req, res, next) => customerController.getCustomerByCode(req, res).catch(next)
  );

  // Update customer
  router.put(
    '/:id',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateUpdateCustomer),
    (req, res, next) => customerController.updateCustomer(req, res).catch(next)
  );

  // Delete customer
  router.delete(
    '/:id',
    rbacMiddleware(['ADMIN']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.deleteCustomer(req, res).catch(next)
  );

  // List customers with filters
  router.get(
    '/',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateListCustomers),
    (req, res, next) => customerController.listCustomers(req, res).catch(next)
  );

  // Search customers
  router.get(
    '/search/quick',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateSearchCustomers),
    (req, res, next) => customerController.searchCustomers(req, res).catch(next)
  );

  // ========== CUSTOMER ADDRESS ROUTES ==========

  // Add address to customer
  router.post(
    '/:customerId/addresses',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCreateAddress),
    (req, res, next) => customerController.addCustomerAddress(req, res).catch(next)
  );

  // Update customer address
  router.put(
    '/addresses/:addressId',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateUpdateAddress),
    (req, res, next) => customerController.updateCustomerAddress(req, res).catch(next)
  );

  // Delete customer address
  router.delete(
    '/addresses/:addressId',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateAddressId),
    (req, res, next) => customerController.deleteCustomerAddress(req, res).catch(next)
  );

  // Get customer addresses
  router.get(
    '/:customerId/addresses',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.getCustomerAddresses(req, res).catch(next)
  );

  // Set default address
  router.post(
    '/:customerId/addresses/:addressId/default',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateSetDefaultAddress),
    (req, res, next) => customerController.setDefaultAddress(req, res).catch(next)
  );

  // ========== CUSTOMER CONTACT ROUTES ==========

  // Add contact to customer
  router.post(
    '/:customerId/contacts',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCreateContact),
    (req, res, next) => customerController.addCustomerContact(req, res).catch(next)
  );

  // Update customer contact
  router.put(
    '/contacts/:contactId',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateUpdateContact),
    (req, res, next) => customerController.updateCustomerContact(req, res).catch(next)
  );

  // Delete customer contact
  router.delete(
    '/contacts/:contactId',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateContactId),
    (req, res, next) => customerController.deleteCustomerContact(req, res).catch(next)
  );

  // Get customer contacts
  router.get(
    '/:customerId/contacts',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.getCustomerContacts(req, res).catch(next)
  );

  // Set primary contact
  router.post(
    '/:customerId/contacts/:contactId/primary',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER']),
    CustomerValidators.validateRequest(CustomerValidators.validateSetPrimaryContact),
    (req, res, next) => customerController.setPrimaryContact(req, res).catch(next)
  );

  // ========== CREDIT MANAGEMENT ROUTES ==========

  // Get customer credit limit
  router.get(
    '/:customerId/credit-limit',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.getCustomerCreditLimit(req, res).catch(next)
  );

  // Set credit limit
  router.post(
    '/:customerId/credit-limit',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateSetCreditLimit),
    (req, res, next) => customerController.setCreditLimit(req, res).catch(next)
  );

  // Update credit limit
  router.put(
    '/:customerId/credit-limit',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateUpdateCreditLimit),
    (req, res, next) => customerController.updateCreditLimit(req, res).catch(next)
  );

  // Suspend credit limit
  router.post(
    '/:customerId/credit-limit/suspend',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateSuspendCreditLimit),
    (req, res, next) => customerController.suspendCreditLimit(req, res).catch(next)
  );

  // Reinstate credit limit
  router.post(
    '/:customerId/credit-limit/reinstate',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateReinstateCreditLimit),
    (req, res, next) => customerController.reinstateCreditLimit(req, res).catch(next)
  );

  // ========== BALANCE AND TRANSACTION ROUTES ==========

  // Get customer balance
  router.get(
    '/:customerId/balance',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.getCustomerBalance(req, res).catch(next)
  );

  // Get customer transactions
  router.get(
    '/:customerId/transactions',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateGetTransactions),
    (req, res, next) => customerController.getCustomerTransactions(req, res).catch(next)
  );

  // ========== CUSTOMER STATISTICS ROUTES ==========

  // Get customer statistics
  router.get(
    '/:customerId/stats',
    rbacMiddleware(['ADMIN', 'MANAGER', 'SELLER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    (req, res, next) => customerController.getCustomerStats(req, res).catch(next)
  );

  // ========== BULK OPERATION ROUTES ==========

  // Import customers
  router.post(
    '/import',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    CustomerValidators.validateRequest(CustomerValidators.validateImportCustomers),
    (req, res, next) => customerController.importCustomers(req, res).catch(next)
  );

  // Export customers
  router.get(
    '/export',
    rbacMiddleware(['ADMIN', 'MANAGER', 'VIEWER']),
    CustomerValidators.validateRequest(CustomerValidators.validateExportCustomers),
    (req, res, next) => customerController.exportCustomers(req, res).catch(next)
  );

  // ========== UTILITY ROUTES ==========

  // Health check
  router.get(
    '/health',
    (req, res, next) => customerController.healthCheck(req, res).catch(next)
  );

  // ========== SELLER-SPECIFIC ROUTES ==========

  // Seller: Get assigned customers only
  router.get(
    '/seller/assigned',
    rbacMiddleware(['SELLER']),
    permissionMiddleware('customers', 'read_assigned'),
    (req, res, next) => {
      // Filter customers by assigned seller ID
      req.query.assignedSellerId = req.user?.id;
      customerController.listCustomers(req, res).catch(next);
    }
  );

  // Seller: Create quick customer (name + phone only)
  router.post(
    '/seller/quick',
    rbacMiddleware(['SELLER']),
    permissionMiddleware('customers', 'create'),
    [
      body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
      body('phone').trim().notEmpty().matches(/^(?:\+212|0)([5-7]\d{8})$/),
      CustomerValidators.handleValidationErrors
    ],
    (req, res, next) => {
      // Only allow name and phone for quick creation
      const quickInput = {
        name: req.body.name,
        phone: req.body.phone,
        type: 'INDIVIDUAL'
      };
      req.body = quickInput;
      customerController.createCustomer(req, res).catch(next);
    }
  );

  // ========== WALK-IN CUSTOMER ROUTES ==========

  // Create walk-in customer (temporary)
  router.post(
    '/walkin',
    rbacMiddleware(['SELLER']),
    permissionMiddleware('customers', 'create_walkin'),
    [
      body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
      body('phone').trim().notEmpty().matches(/^(?:\+212|0)([5-7]\d{8})$/),
      CustomerValidators.handleValidationErrors
    ],
    (req, res, next) => {
      const walkinInput = {
        ...req.body,
        type: 'TEMPORARY',
        tags: ['walkin', 'temporary']
      };
      req.body = walkinInput;
      customerController.createCustomer(req, res).catch(next);
    }
  );

  // Convert walk-in to regular customer
  router.post(
    '/:customerId/convert-to-regular',
    rbacMiddleware(['SELLER', 'MANAGER']),
    permissionMiddleware('customers', 'convert_walkin'),
    CustomerValidators.validateRequest(CustomerValidators.validateCustomerId),
    async (req, res, next) => {
      try {
        const customer = await customerController.getCustomer(req, res);
        if (customer.type !== 'TEMPORARY') {
          res.status(400).json({
            success: false,
            error: 'Customer is not a walk-in/temporary customer'
          });
          return;
        }

        // Update to individual customer
        req.body = { type: 'INDIVIDUAL' };
        customerController.updateCustomer(req, res).catch(next);
      } catch (error) {
        next(error);
      }
    }
  );

  // ========== CUSTOMER SEGMENTATION ROUTES ==========

  // Assign customer to segment
  router.post(
    '/:customerId/segments/:segmentId',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    permissionMiddleware('customers', 'manage_segments'),
    CustomerValidators.validateRequest([
      param('customerId').isUUID(),
      param('segmentId').isUUID()
    ]),
    async (req, res, next) => {
      try {
        // This would integrate with SegmentService
        // For now, just update customer segmentId
        req.body = { segmentId: req.params.segmentId };
        customerController.updateCustomer(req, res).catch(next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Remove customer from segment
  router.delete(
    '/:customerId/segments/:segmentId',
    rbacMiddleware(['ADMIN', 'MANAGER']),
    permissionMiddleware('customers', 'manage_segments'),
    CustomerValidators.validateRequest([
      param('customerId').isUUID(),
      param('segmentId').isUUID()
    ]),
    async (req, res, next) => {
      try {
        // Get current customer to check segment
        const customer = await customerController.getCustomer(req, res);
        if (customer.segmentId === req.params.segmentId) {
          req.body = { segmentId: undefined };
          customerController.updateCustomer(req, res).catch(next);
        } else {
          res.status(400).json({
            success: false,
            error: 'Customer is not assigned to this segment'
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ========== ERROR HANDLING MIDDLEWARE ==========

  router.use((error: any, req: any, res: any, next: any) => {
    console.error('Customer route error:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    } else if (error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else if (error.name === 'BusinessRuleError') {
      res.status(422).json({
        success: false,
        error: error.message
      });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    } else if (error.name === 'ForbiddenError') {
      res.status(403).json({
        success: false,
        error: 'Forbidden'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  return router;
}

// Helper function for body validation (used in quick creation routes)
import { body } from 'express-validator'; 
