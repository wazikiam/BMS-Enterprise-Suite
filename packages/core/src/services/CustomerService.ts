// packages/core/src/services/CustomerService.ts

import {
  Customer,
  CustomerCreateInput,
  CustomerUpdateInput,
} from '../domain/Customer';
import { CustomerRepository } from '../repositories/CustomerRepository';

/**
 * CustomerService
 * ---------------
 * Customers domain orchestration only.
 * No credit, no sales, no persistence logic.
 */
export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  async createCustomer(
    input: CustomerCreateInput,
    createdBy: string
  ): Promise<Customer> {
    const now = new Date();

    return this.repository.create({
      ...input,
      id: crypto.randomUUID(),
      code: `CUST-${Date.now()}`,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateCustomer(
    id: string,
    input: CustomerUpdateInput
  ): Promise<Customer> {
    return this.repository.update(id, {
      ...input,
      updatedAt: new Date(),
    });
  }

  async deactivateCustomer(id: string): Promise<void> {
    await this.repository.deactivate(id, new Date());
  }
}
