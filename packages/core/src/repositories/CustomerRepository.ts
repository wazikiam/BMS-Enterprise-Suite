// packages/core/src/repositories/CustomerRepository.ts
import { Customer } from '../domain/Customer';

export interface ICustomerRepository {
  // Basic CRUD operations
  findById(id: string): Promise<Customer | null>;
  findAll(): Promise<Customer[]>;
  create(customer: Omit<Customer, 'id'>): Promise<Customer>;
  update(id: string, data: Partial<Customer>): Promise<Customer>;
  delete(id: string): Promise<boolean>;
  
  // Query operations
  findByEmail(email: string): Promise<Customer | null>;
  findByPhone(phone: string): Promise<Customer | null>;
  findByTaxId(taxId: string): Promise<Customer | null>;
  findByCompany(companyName: string): Promise<Customer[]>;
  
  // Filter operations
  findWithFilters(filters: CustomerFilters, page: number, limit: number): Promise<{ customers: Customer[], total: number }>;
  findAllActive(): Promise<Customer[]>;
  findInactive(): Promise<Customer[]>;
  findCustomersCreatedAfter(date: Date): Promise<Customer[]>;
  
  // Business operations
  getCustomerCount(): Promise<number>;
  getActiveCustomerCount(): Promise<number>;
  searchCustomers(query: string, limit?: number): Promise<Customer[]>;
  getCustomersBySegment(segmentId: string): Promise<Customer[]>;
  getCustomersByLocation(location: string): Promise<Customer[]>;
  
  // Bulk operations
  bulkCreate(customers: Omit<Customer, 'id'>[]): Promise<Customer[]>;
  bulkUpdate(updates: Array<{ id: string; data: Partial<Customer> }>): Promise<Customer[]>;
  
  // Relationship operations
  getCustomerWithBalance(customerId: string): Promise<Customer | null>;
  getCustomerWithTransactions(customerId: string): Promise<Customer | null>;
  getCustomerWithCreditLimit(customerId: string): Promise<Customer | null>;
}

export interface CustomerFilters {
  status?: string;
  type?: 'INDIVIDUAL' | 'COMPANY';
  segmentId?: string;
  location?: string;
  createdFrom?: Date;
  createdTo?: Date;
  hasCreditLimit?: boolean;
  hasOverdueBalance?: boolean;
  searchTerm?: string;
}

export class CustomerRepository implements ICustomerRepository {
  private customers: Map<string, Customer> = new Map();
  private nextId = 1;

  async findById(id: string): Promise<Customer | null> {
    return this.customers.get(id) || null;
  }

  async findAll(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async create(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const id = `CUST-${this.nextId++}`;
    const newCustomer: Customer = {
      ...customer,
      id,
      createdAt: customer.createdAt || new Date(),
      updatedAt: new Date(),
      version: 1
    };
    
    this.customers.set(id, newCustomer);
    return newCustomer;
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new Error(`Customer with ID ${id} not found`);
    }

    const updatedCustomer: Customer = {
      ...customer,
      ...data,
      updatedAt: new Date(),
      version: customer.version + 1
    };

    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async delete(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const customers = Array.from(this.customers.values());
    return customers.find(c => c.email === email) || null;
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const customers = Array.from(this.customers.values());
    return customers.find(c => c.phone === phone) || null;
  }

  async findByTaxId(taxId: string): Promise<Customer | null> {
    const customers = Array.from(this.customers.values());
    return customers.find(c => c.taxId === taxId) || null;
  }

  async findByCompany(companyName: string): Promise<Customer[]> {
    const customers = Array.from(this.customers.values());
    return customers.filter(c => 
      c.companyName?.toLowerCase().includes(companyName.toLowerCase()) || 
      c.name.toLowerCase().includes(companyName.toLowerCase())
    );
  }

  async findWithFilters(filters: CustomerFilters, page: number, limit: number): Promise<{ customers: Customer[], total: number }> {
    let customers = Array.from(this.customers.values());

    // Apply filters
    if (filters.status) {
      customers = customers.filter(c => c.status === filters.status);
    }
    
    if (filters.type) {
      customers = customers.filter(c => c.type === filters.type);
    }
    
    if (filters.location) {
      customers = customers.filter(c => 
        c.city?.toLowerCase().includes(filters.location!.toLowerCase()) ||
        c.country?.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }
    
    if (filters.createdFrom) {
      customers = customers.filter(c => c.createdAt >= filters.createdFrom!);
    }
    
    if (filters.createdTo) {
      customers = customers.filter(c => c.createdAt <= filters.createdTo!);
    }
    
    if (filters.searchTerm) {
      const search = filters.searchTerm.toLowerCase();
      customers = customers.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone.includes(search) ||
        c.companyName?.toLowerCase().includes(search)
      );
    }

    const total = customers.length;
    
    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedCustomers = customers.slice(start, end);

    return { customers: paginatedCustomers, total };
  }

  async findAllActive(): Promise<Customer[]> {
    const customers = Array.from(this.customers.values());
    return customers.filter(c => c.status === 'ACTIVE');
  }

  async findInactive(): Promise<Customer[]> {
    const customers = Array.from(this.customers.values());
    return customers.filter(c => c.status === 'INACTIVE' || c.status === 'SUSPENDED');
  }

  async findCustomersCreatedAfter(date: Date): Promise<Customer[]> {
    const customers = Array.from(this.customers.values());
    return customers.filter(c => c.createdAt > date);
  }

  async getCustomerCount(): Promise<number> {
    return this.customers.size;
  }

  async getActiveCustomerCount(): Promise<number> {
    const activeCustomers = await this.findAllActive();
    return activeCustomers.length;
  }

  async searchCustomers(query: string, limit: number = 10): Promise<Customer[]> {
    const search = query.toLowerCase();
    const customers = Array.from(this.customers.values());
    
    const results = customers.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone.includes(search) ||
      c.companyName?.toLowerCase().includes(search) ||
      c.taxId?.includes(search)
    );

    return results.slice(0, limit);
  }

  async getCustomersBySegment(segmentId: string): Promise<Customer[]> {
    const customers = Array.from(this.customers.values());
    return customers.filter(c => c.segmentId === segmentId);
  }

  async getCustomersByLocation(location: string): Promise<Customer[]> {
    const locationLower = location.toLowerCase();
    const customers = Array.from(this.customers.values());
    
    return customers.filter(c => 
      c.city?.toLowerCase().includes(locationLower) ||
      c.country?.toLowerCase().includes(locationLower) ||
      c.address?.toLowerCase().includes(locationLower)
    );
  }

  async bulkCreate(customers: Omit<Customer, 'id'>[]): Promise<Customer[]> {
    const createdCustomers: Customer[] = [];
    
    for (const customerData of customers) {
      const customer = await this.create(customerData);
      createdCustomers.push(customer);
    }
    
    return createdCustomers;
  }

  async bulkUpdate(updates: Array<{ id: string; data: Partial<Customer> }>): Promise<Customer[]> {
    const updatedCustomers: Customer[] = [];
    
    for (const update of updates) {
      try {
        const customer = await this.update(update.id, update.data);
        updatedCustomers.push(customer);
      } catch (error) {
        // Skip failed updates
        console.error(`Failed to update customer ${update.id}:`, error);
      }
    }
    
    return updatedCustomers;
  }

  async getCustomerWithBalance(customerId: string): Promise<Customer | null> {
    return this.findById(customerId); // In real implementation, would join with balance
  }

  async getCustomerWithTransactions(customerId: string): Promise<Customer | null> {
    return this.findById(customerId); // In real implementation, would join with transactions
  }

  async getCustomerWithCreditLimit(customerId: string): Promise<Customer | null> {
    return this.findById(customerId); // In real implementation, would join with credit limit
  }
} 
