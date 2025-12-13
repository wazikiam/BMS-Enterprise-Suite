// packages/core/src/services/CustomerService.ts

import {
  Customer,
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerFilters,
  CustomerStatus,
  CustomerType
} from '../domain/Customer';

import { ICustomerRepository } from '../repositories/CustomerRepository';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

/**
 * CustomerService
 * ----------------
 * CORE customer lifecycle only.
 *
 * ❌ No addresses
 * ❌ No contacts
 * ❌ No balances
 * ❌ No credit limits
 * ❌ No segments
 *
 * These will be added once repositories exist.
 */
export class CustomerService {
  constructor(
    private readonly customerRepository: ICustomerRepository
  ) {}

  /* =====================================================
     CREATE
     ===================================================== */
  async createCustomer(input: CustomerCreateInput): Promise<Customer> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Customer name is required');
    }

    if (!input.phone || input.phone.trim().length === 0) {
      throw new ValidationError('Customer phone is required');
    }

    const customer: Omit<Customer, 'id'> = {
      code: this.generateCustomerCode(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim(),
      type: input.type ?? CustomerType.INDIVIDUAL,
      status: CustomerStatus.ACTIVE,

      // required domain fields
      currentBalance: 0,
      creditLimit: 0,
      totalPurchases: 0,
      averageTransactionValue: 0,
      tags: [],
      notes: undefined,

      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    return this.customerRepository.create(customer);
  }

  /* =====================================================
     READ
     ===================================================== */
  async getCustomerById(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw NotFoundError.factory('Customer', id);
    }
    return customer;
  }

  async listCustomers(
    filters: CustomerFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<{ data: Customer[]; total: number }> {
    const result = await this.customerRepository.findWithFilters(
      filters,
      page,
      pageSize
    );

    return {
      data: result.customers,
      total: result.total
    };
  }


  /* =====================================================
     UPDATE
     ===================================================== */
  async updateCustomer(
    id: string,
    input: CustomerUpdateInput
  ): Promise<Customer> {
    const customer = await this.getCustomerById(id);

    if (customer.status === CustomerStatus.INACTIVE) {
      throw new BusinessRuleError('Cannot update inactive customer');
    }

    const updated: Partial<Customer> = {
      ...input,
      updatedAt: new Date()
    };

    return this.customerRepository.update(id, updated);
  }

  /* =====================================================
     STATUS MANAGEMENT
     ===================================================== */
  async activateCustomer(id: string): Promise<Customer> {
    return this.setStatus(id, CustomerStatus.ACTIVE);
  }

  async suspendCustomer(id: string): Promise<Customer> {
    return this.setStatus(id, CustomerStatus.SUSPENDED);
  }

  async deactivateCustomer(id: string): Promise<Customer> {
    return this.setStatus(id, CustomerStatus.INACTIVE);
  }

  private async setStatus(
    id: string,
    status: CustomerStatus
  ): Promise<Customer> {
    const customer = await this.getCustomerById(id);

    customer.status = status;
    customer.updatedAt = new Date();

    return this.customerRepository.update(id, customer);
  }

  /* =====================================================
     INTERNAL
     ===================================================== */
  private generateCustomerCode(): string {
    const ts = Date.now().toString().slice(-6);
    return `CUST-${ts}`;
  }
}
