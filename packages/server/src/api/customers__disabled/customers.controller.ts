// packages/server/src/api/customers/customers.controller.ts
import { Request, Response } from 'express';
import { CustomerService } from '../../../core/src/services/CustomerService';
import { CustomerCreateInput, CustomerUpdateInput, CustomerFilters } from '../../../core/src/domain/Customer';
import { CustomerAddressCreateInput, CustomerAddressUpdateInput } from '../../../core/src/domain/CustomerAddress';
import { CustomerContactCreateInput, CustomerContactUpdateInput } from '../../../core/src/domain/CustomerContact';
import { ValidationError, NotFoundError, BusinessRuleError } from '../../../core/src/errors';

export class CustomersController {
  constructor(private customerService: CustomerService) {}

  // ========== CUSTOMER CRUD OPERATIONS ==========

  async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const input: CustomerCreateInput = req.body;
      const createdBy = req.user?.id || 'system';

      const validationErrors = await this.customerService.validateCustomerCreation(input);
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          errors: validationErrors.map(e => e.message)
        });
        return;
      }

      const customer = await this.customerService.createCustomer(input, createdBy);
      
      res.status(201).json({
        success: true,
        data: customer,
        message: 'Customer created successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await this.customerService.getCustomerById(id);
      
      res.status(200).json({
        success: true,
        data: customer
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomerByCode(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const customer = await this.customerService.getCustomerByCode(code);
      
      res.status(200).json({
        success: true,
        data: customer
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const input: CustomerUpdateInput = req.body;
      const updatedBy = req.user?.id || 'system';

      const validationErrors = await this.customerService.validateCustomerUpdate(id, input);
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          errors: validationErrors.map(e => e.message)
        });
        return;
      }

      const customer = await this.customerService.updateCustomer(id, input, updatedBy);
      
      res.status(200).json({
        success: true,
        data: customer,
        message: 'Customer updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async deleteCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deletedBy = req.user?.id || 'system';

      await this.customerService.deleteCustomer(id, deletedBy);
      
      res.status(200).json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async listCustomers(req: Request, res: Response): Promise<void> {
    try {
      const filters: CustomerFilters = {
        name: req.query.name as string,
        phone: req.query.phone as string,
        email: req.query.email as string,
        type: req.query.type as any,
        status: req.query.status as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        segmentId: req.query.segmentId as string,
        assignedSellerId: req.query.assignedSellerId as string,
        hasCreditLimit: req.query.hasCreditLimit === 'true' ? true : 
                      req.query.hasCreditLimit === 'false' ? false : undefined,
        minBalance: req.query.minBalance ? parseFloat(req.query.minBalance as string) : undefined,
        maxBalance: req.query.maxBalance ? parseFloat(req.query.maxBalance as string) : undefined,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined
      };

      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 50;

      const { customers, total } = await this.customerService.listCustomers(filters, page, pageSize);
      
      res.status(200).json({
        success: true,
        data: customers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async searchCustomers(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      if (!query || (query as string).trim().length < 2) {
        res.status(200).json({
          success: true,
          data: [],
          message: 'Search query must be at least 2 characters'
        });
        return;
      }

      const customers = await this.customerService.searchCustomers(query as string, limit);
      
      res.status(200).json({
        success: true,
        data: customers
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CUSTOMER ADDRESSES ==========

  async addCustomerAddress(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const input: CustomerAddressCreateInput = req.body;
      const createdBy = req.user?.id || 'system';

      // Ensure customerId in path matches body
      input.customerId = customerId;

      const address = await this.customerService.addCustomerAddress(customerId, input, createdBy);
      
      res.status(201).json({
        success: true,
        data: address,
        message: 'Customer address added successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateCustomerAddress(req: Request, res: Response): Promise<void> {
    try {
      const { addressId } = req.params;
      const input: CustomerAddressUpdateInput = req.body;
      const updatedBy = req.user?.id || 'system';

      const address = await this.customerService.updateCustomerAddress(addressId, input, updatedBy);
      
      res.status(200).json({
        success: true,
        data: address,
        message: 'Customer address updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async deleteCustomerAddress(req: Request, res: Response): Promise<void> {
    try {
      const { addressId } = req.params;
      const deletedBy = req.user?.id || 'system';

      await this.customerService.deleteCustomerAddress(addressId, deletedBy);
      
      res.status(200).json({
        success: true,
        message: 'Customer address deleted successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomerAddresses(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const addresses = await this.customerService.getCustomerAddresses(customerId);
      
      res.status(200).json({
        success: true,
        data: addresses
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async setDefaultAddress(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, addressId } = req.params;
      const { type } = req.body;
      const updatedBy = req.user?.id || 'system';

      if (!['BILLING', 'SHIPPING'].includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Address type must be BILLING or SHIPPING'
        });
        return;
      }

      await this.customerService.setDefaultAddress(customerId, addressId, type as 'BILLING' | 'SHIPPING', updatedBy);
      
      res.status(200).json({
        success: true,
        message: `Default ${type.toLowerCase()} address set successfully`
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CUSTOMER CONTACTS ==========

  async addCustomerContact(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const input: CustomerContactCreateInput = req.body;
      const createdBy = req.user?.id || 'system';

      // Ensure customerId in path matches body
      input.customerId = customerId;

      const contact = await this.customerService.addCustomerContact(customerId, input, createdBy);
      
      res.status(201).json({
        success: true,
        data: contact,
        message: 'Customer contact added successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateCustomerContact(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const input: CustomerContactUpdateInput = req.body;
      const updatedBy = req.user?.id || 'system';

      const contact = await this.customerService.updateCustomerContact(contactId, input, updatedBy);
      
      res.status(200).json({
        success: true,
        data: contact,
        message: 'Customer contact updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async deleteCustomerContact(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const deletedBy = req.user?.id || 'system';

      await this.customerService.deleteCustomerContact(contactId, deletedBy);
      
      res.status(200).json({
        success: true,
        message: 'Customer contact deleted successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomerContacts(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const contacts = await this.customerService.getCustomerContacts(customerId);
      
      res.status(200).json({
        success: true,
        data: contacts
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async setPrimaryContact(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, contactId } = req.params;
      const updatedBy = req.user?.id || 'system';

      await this.customerService.setPrimaryContact(customerId, contactId, updatedBy);
      
      res.status(200).json({
        success: true,
        message: 'Primary contact set successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT MANAGEMENT ==========

  async getCustomerCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const creditLimit = await this.customerService.getCustomerCreditLimit(customerId);
      
      res.status(200).json({
        success: true,
        data: creditLimit
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async setCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { amount, currency, terms } = req.body;
      const approvedBy = req.user?.id || 'system';

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be positive'
        });
        return;
      }

      const creditLimit = await this.customerService.setCreditLimit(
        customerId, 
        amount, 
        currency || 'MAD', 
        terms || 30, 
        approvedBy
      );
      
      res.status(200).json({
        success: true,
        data: creditLimit,
        message: 'Credit limit set successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { newAmount, reason } = req.body;
      const approvedBy = req.user?.id || 'system';

      if (!newAmount || newAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'New amount must be positive'
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Reason is required for credit limit change'
        });
        return;
      }

      const creditLimit = await this.customerService.updateCreditLimit(customerId, newAmount, reason, approvedBy);
      
      res.status(200).json({
        success: true,
        data: creditLimit,
        message: 'Credit limit updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async suspendCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { reason } = req.body;
      const suspendedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Reason is required for credit limit suspension'
        });
        return;
      }

      await this.customerService.suspendCreditLimit(customerId, reason, suspendedBy);
      
      res.status(200).json({
        success: true,
        message: 'Credit limit suspended successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async reinstateCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { reason } = req.body;
      const reinstatedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Reason is required for credit limit reinstatement'
        });
        return;
      }

      await this.customerService.reinstateCreditLimit(customerId, reason, reinstatedBy);
      
      res.status(200).json({
        success: true,
        message: 'Credit limit reinstated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BALANCE AND TRANSACTIONS ==========

  async getCustomerBalance(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const balance = await this.customerService.getCustomerBalance(customerId);
      
      res.status(200).json({
        success: true,
        data: balance
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomerTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 50;

      const { transactions, total } = await this.customerService.getCustomerTransactions(customerId, page, pageSize);
      
      res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CUSTOMER STATISTICS ==========

  async getCustomerStats(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const stats = await this.customerService.getCustomerStats(customerId);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BULK OPERATIONS ==========

  async importCustomers(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body.data;
      const createdBy = req.user?.id || 'system';

      if (!Array.isArray(data)) {
        res.status(400).json({
          success: false,
          error: 'Data must be an array'
        });
        return;
      }

      const result = await this.customerService.importCustomers(data, createdBy);
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Import completed: ${result.success} successful, ${result.failures.length} failed`
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async exportCustomers(req: Request, res: Response): Promise<void> {
    try {
      const filters: CustomerFilters = {
        name: req.query.name as string,
        phone: req.query.phone as string,
        email: req.query.email as string,
        type: req.query.type as any,
        status: req.query.status as any
      };

      const customers = await this.customerService.exportCustomers(filters);
      
      // Set headers for CSV export
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
      
      // Convert to CSV (simplified version)
      const csv = this.convertToCSV(customers);
      res.status(200).send(csv);
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== UTILITY METHODS ==========

  private handleError(error: any, res: Response): void {
    console.error('Customer API error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else if (error instanceof BusinessRuleError) {
      res.status(422).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  private convertToCSV(customers: any[]): string {
    if (customers.length === 0) {
      return '';
    }

    const headers = Object.keys(customers[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    for (const customer of customers) {
      const row = headers.map(header => {
        const value = customer[header];
        // Handle special cases
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        return String(value);
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  // ========== HEALTH CHECK ==========

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Simple health check - try to count customers
      const { customers } = await this.customerService.listCustomers({}, 1, 1);
      
      res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        customerCount: customers.length
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
} 
