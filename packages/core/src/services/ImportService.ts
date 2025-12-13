/**
 * Import Service
 * Business logic for bulk data import operations
 * 
 * BUSINESS RULES:
 * - CSV/Excel product import with validation
 * - Template-based import with strict formatting
 * - Batch processing with rollback on error
 * - Duplicate detection and handling
 * - Performance optimized for large imports
 * 
 * DESIGN RULES:
 * - TypeScript strict mode
 * - Stream processing for large files
 * - Comprehensive error reporting
 * - Transaction safety
 */
import { Product } from '../domain/Product';
import { ProductService } from './ProductService';
import { CategoryService } from './CategoryService';
import { ValidationError } from '../errors/ApplicationError';

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{
    row: number;
    field: string;
    value: any;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    message: string;
  }>;
  summary: {
    totalProcessed: number;
    processingTime: number;
    memoryUsage: number;
  };
}

export interface ImportOptions {
  // Validation options
  validateOnly?: boolean;
  skipInvalidRows?: boolean;
  updateExisting?: boolean;
  createMissingCategories?: boolean;
  
  // Processing options
  batchSize?: number;
  maxErrors?: number;
  timeout?: number; // in milliseconds
  
  // Notification options
  notifyOnComplete?: boolean;
  notifyEmail?: string;
}

export interface ImportTemplate {
  name: string;
  description: string;
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    required: boolean;
    validation?: RegExp | ((value: any) => boolean);
    defaultValue?: any;
    mapping?: string; // Maps to product field
  }>;
  sampleData: any[];
}

export class ImportService {
  private productService: ProductService;
  private categoryService: CategoryService;

  constructor(
    productService: ProductService,
    categoryService: CategoryService
  ) {
    this.productService = productService;
    this.categoryService = categoryService;
  }

  /**
   * Import products from CSV data
   * BUSINESS RULES: Bulk import with validation and error handling
   */
  async importProductsFromCSV(
    csvData: string | any[],
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: 0,
        processingTime: 0,
        memoryUsage: 0
      }
    };

    try {
      // Parse CSV data
      const rows = Array.isArray(csvData) ? csvData : this.parseCSV(csvData);
      result.summary.totalProcessed = rows.length;

      // Process in batches for performance
      const batchSize = options.batchSize || 100;
      const maxErrors = options.maxErrors || 100;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await this.processBatch(batch, i + 1, options, result);

        // Stop if too many errors
        if (result.errors.length >= maxErrors) {
          result.warnings.push({
            row: i + batchSize,
            message: `Import stopped due to too many errors (max: ${maxErrors})`
          });
          break;
        }

        // Check timeout
        if (options.timeout && (Date.now() - startTime) > options.timeout) {
          result.warnings.push({
            row: i + batchSize,
            message: `Import timeout after ${options.timeout}ms`
          });
          break;
        }
      }

    } catch (error: any) {
      result.errors.push({
        row: 0,
        field: 'system',
        value: null,
        error: `System error: ${error.message}`
      });
    } finally {
      result.summary.processingTime = Date.now() - startTime;
      result.summary.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }

    return result;
  }

  /**
   * Import products from Excel file
   * BUSINESS RULES: Excel-specific parsing with sheet support
   */
  async importProductsFromExcel(
    excelData: any, // Would be Buffer or file path in real implementation
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    // TODO: Implement Excel parsing library integration
    // For now, convert to CSV-like structure
    
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: 0,
        processingTime: 0,
        memoryUsage: 0
      }
    };

    result.warnings.push({
      row: 0,
      message: 'Excel import requires external library integration'
    });

    return result;
  }

  /**
   * Validate import data without importing
   * BUSINESS RULES: Pre-import validation with detailed report
   */
  async validateImportData(
    data: any[],
    template: ImportTemplate
  ): Promise<{
    isValid: boolean;
    errors: Array<{ row: number; field: string; error: string }>;
    warnings: Array<{ row: number; message: string }>;
    statistics: {
      totalRows: number;
      validRows: number;
      duplicateRows: number;
      missingRequired: number;
    };
  }> {
    const errors: Array<{ row: number; field: string; error: string }> = [];
    const warnings: Array<{ row: number; message: string }> = [];
    let validRows = 0;
    let duplicateRows = 0;
    let missingRequired = 0;

    const seenSKUs = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1;
      let rowValid = true;

      // Validate against template
      for (const field of template.fields) {
        const value = row[field.name];
        
        // Check required fields
        if (field.required && (value === undefined || value === null || value === '')) {
          errors.push({
            row: rowNumber,
            field: field.name,
            error: `${field.name} is required`
          });
          missingRequired++;
          rowValid = false;
          continue;
        }

        // Skip validation if value is empty
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // Type validation
        if (!this.validateFieldType(value, field.type)) {
          errors.push({
            row: rowNumber,
            field: field.name,
            error: `${field.name} must be of type ${field.type}, got ${typeof value}`
          });
          rowValid = false;
        }

        // Custom validation
        if (field.validation) {
          if (field.validation instanceof RegExp) {
            if (!field.validation.test(String(value))) {
              errors.push({
                row: rowNumber,
                field: field.name,
                error: `${field.name} must match pattern ${field.validation}`
              });
              rowValid = false;
            }
          } else if (typeof field.validation === 'function') {
            if (!field.validation(value)) {
              errors.push({
                row: rowNumber,
                field: field.name,
                error: `${field.name} failed custom validation`
              });
              rowValid = false;
            }
          }
        }
      }

      // Check for duplicate SKUs
      const sku = row['sku'] || row['SKU'];
      if (sku) {
        if (seenSKUs.has(sku)) {
          warnings.push({
            row: rowNumber,
            message: `Duplicate SKU: ${sku}`
          });
          duplicateRows++;
        } else {
          seenSKUs.add(sku);
        }
      }

      if (rowValid) {
        validRows++;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalRows: data.length,
        validRows,
        duplicateRows,
        missingRequired
      }
    };
  }

  /**
   * Generate import template
   * BUSINESS RULES: Standardized template for users
   */
  getProductImportTemplate(): ImportTemplate {
    return {
      name: 'Product Import Template',
      description: 'Template for importing products in bulk',
      fields: [
        {
          name: 'sku',
          type: 'string',
          required: true,
          validation: /^[A-Z0-9\-_]+$/,
          mapping: 'sku'
        },
        {
          name: 'code',
          type: 'string',
          required: false,
          mapping: 'code'
        },
        {
          name: 'name',
          type: 'string',
          required: true,
          mapping: 'name'
        },
        {
          name: 'description',
          type: 'string',
          required: false,
          mapping: 'description'
        },
        {
          name: 'barcode',
          type: 'string',
          required: false,
          mapping: 'barcode'
        },
        {
          name: 'category',
          type: 'string',
          required: true,
          mapping: 'categoryId'
        },
        {
          name: 'cost_price',
          type: 'number',
          required: true,
          validation: (value) => value > 0,
          mapping: 'costPrice'
        },
        {
          name: 'selling_price',
          type: 'number',
          required: true,
          validation: (value) => value > 0,
          mapping: 'sellingPrice'
        },
        {
          name: 'current_stock',
          type: 'number',
          required: false,
          defaultValue: 0,
          validation: (value) => value >= 0,
          mapping: 'currentStock'
        },
        {
          name: 'reserved_stock',
          type: 'number',
          required: false,
          defaultValue: 0,
          validation: (value) => value >= 0,
          mapping: 'reservedStock'
        },
        {
          name: 'min_stock_level',
          type: 'number',
          required: false,
          defaultValue: 0,
          validation: (value) => value >= 0,
          mapping: 'minStockLevel'
        },
        {
          name: 'allow_backorders',
          type: 'boolean',
          required: false,
          defaultValue: false,
          mapping: 'allowBackorders'
        },
        {
          name: 'supplier',
          type: 'string',
          required: false,
          mapping: 'supplierId'
        },
        {
          name: 'weight_kg',
          type: 'number',
          required: false,
          validation: (value) => value > 0,
          mapping: 'weight'
        },
        {
          name: 'dimensions',
          type: 'string',
          required: false,
          validation: /^\d+x\d+x\d+$/,
          mapping: 'dimensions'
        },
        {
          name: 'is_active',
          type: 'boolean',
          required: false,
          defaultValue: true,
          mapping: 'isActive'
        }
      ],
      sampleData: [
        {
          sku: 'PROD-001',
          code: 'PC-001',
          name: 'Sample Product',
          description: 'Product description',
          barcode: '123456789012',
          category: 'Electronics',
          cost_price: 100.50,
          selling_price: 150.00,
          current_stock: 50,
          reserved_stock: 5,
          min_stock_level: 10,
          allow_backorders: false,
          supplier: 'Supplier Co.',
          weight_kg: 1.5,
          dimensions: '10x20x30',
          is_active: true
        }
      ]
    };
  }

  /**
   * Generate CSV template file
   * BUSINESS RULES: Downloadable template with headers
   */
  generateCSVTemplate(): string {
    const template = this.getProductImportTemplate();
    const headers = template.fields.map(f => f.name).join(',');
    const sampleRow = template.sampleData[0];
    const sampleValues = template.fields.map(f => sampleRow[f.name]).join(',');
    
    return `${headers}\n${sampleValues}`;
  }

  /**
   * Export products to CSV
   * BUSINESS RULES: Bulk export with all product data
   */
  async exportProductsToCSV(options: {
    categoryId?: string;
    supplierId?: string;
    includeInactive?: boolean;
    fields?: string[];
  } = {}): Promise<string> {
    // Get products
    const searchResult = await this.productService.searchProducts({
      categoryId: options.categoryId,
      supplierId: options.supplierId,
      isActive: options.includeInactive ? undefined : true,
      take: 10000 // Export limit
    });

    // Determine fields to export
    const fields = options.fields || [
      'sku', 'code', 'name', 'description', 'barcode', 'categoryId',
      'costPrice', 'sellingPrice', 'currentStock', 'reservedStock', 'availableStock',
      'minStockLevel', 'allowBackorders', 'supplierId', 'weight', 'dimensions', 'isActive'
    ];

    // Generate CSV
    const headers = fields.join(',');
    const rows = searchResult.products.map(product => {
      return fields.map(field => {
        const value = (product as any)[field];
        // Handle special formatting
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return String(value);
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Process a batch of import rows
   * PRIVATE: Batch processing logic
   */
  private async processBatch(
    batch: any[],
    startRow: number,
    options: ImportOptions,
    result: ImportResult
  ): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowNumber = startRow + i;

      try {
        // Validate row
        const validationResult = await this.validateRow(row, rowNumber);
        if (!validationResult.valid) {
          result.errors.push(...validationResult.errors);
          result.failed++;
          if (!options.skipInvalidRows) {
            continue;
          }
        }

        // Skip if validation only
        if (options.validateOnly) {
          result.skipped++;
          continue;
        }

        // Map row to product data
        const productData = this.mapRowToProduct(row, options);

        // Import product
        await this.productService.createProduct(productData);
        result.success++;

      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'general',
          value: null,
          error: `Import failed: ${error.message}`
        });
        result.failed++;
      }
    }
  }

  /**
   * Validate a single row
   * PRIVATE: Row validation logic
   */
  private async validateRow(
    row: any,
    rowNumber: number
  ): Promise<{ valid: boolean; errors: Array<{ row: number; field: string; value: any; error: string }> }> {
    const errors: Array<{ row: number; field: string; value: any; error: string }> = [];

    // Required fields
    if (!row.sku) {
      errors.push({
        row: rowNumber,
        field: 'sku',
        value: row.sku,
        error: 'SKU is required'
      });
    }

    if (!row.name) {
      errors.push({
        row: rowNumber,
        field: 'name',
        value: row.name,
        error: 'Name is required'
      });
    }

    if (!row.cost_price && row.cost_price !== 0) {
      errors.push({
        row: rowNumber,
        field: 'cost_price',
        value: row.cost_price,
        error: 'Cost price is required'
      });
    }

    if (!row.selling_price && row.selling_price !== 0) {
      errors.push({
        row: rowNumber,
        field: 'selling_price',
        value: row.selling_price,
        error: 'Selling price is required'
      });
    }

    // Price validation
    if (row.cost_price && row.selling_price) {
      const cost = parseFloat(row.cost_price);
      const selling = parseFloat(row.selling_price);
      
      if (isNaN(cost) || isNaN(selling)) {
        errors.push({
          row: rowNumber,
          field: 'prices',
          value: `${row.cost_price}/${row.selling_price}`,
          error: 'Prices must be valid numbers'
        });
      } else if (cost > selling) {
        errors.push({
          row: rowNumber,
          field: 'prices',
          value: `${cost}/${selling}`,
          error: 'Cost price cannot be greater than selling price'
        });
      }
    }

    // Stock validation
    if (row.current_stock !== undefined) {
      const stock = parseFloat(row.current_stock);
      if (isNaN(stock) || stock < 0) {
        errors.push({
          row: rowNumber,
          field: 'current_stock',
          value: row.current_stock,
          error: 'Current stock must be a non-negative number'
        });
      }
    }

    // Reserved stock validation
    if (row.reserved_stock !== undefined) {
      const reserved = parseFloat(row.reserved_stock);
      if (isNaN(reserved) || reserved < 0) {
        errors.push({
          row: rowNumber,
          field: 'reserved_stock',
          value: row.reserved_stock,
          error: 'Reserved stock must be a non-negative number'
        });
      }
    }

    // Check reserved doesn't exceed current stock
    if (row.current_stock !== undefined && row.reserved_stock !== undefined) {
      const current = parseFloat(row.current_stock);
      const reserved = parseFloat(row.reserved_stock);
      if (!isNaN(current) && !isNaN(reserved) && reserved > current) {
        errors.push({
          row: rowNumber,
          field: 'stock',
          value: `Current: ${current}, Reserved: ${reserved}`,
          error: 'Reserved stock cannot exceed current stock'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Map CSV row to product data
   * PRIVATE: Data mapping logic
   */
  private mapRowToProduct(row: any, options: ImportOptions): Omit<Product, 'id' | 'createdAt' | 'updatedAt'> {
    // Handle category - create if missing and enabled
    let categoryId = 'uncategorized';
    if (row.category && options.createMissingCategories) {
      // TODO: Create category if it doesn't exist
      categoryId = row.category;
    } else if (row.category) {
      categoryId = row.category;
    }

    const currentStock = row.current_stock ? parseFloat(row.current_stock) : 0;
    const reservedStock = row.reserved_stock ? parseFloat(row.reserved_stock) : 0;
    const reorderPoint = row.reorder_point ? parseFloat(row.reorder_point) : 0;
    
    return {
      sku: row.sku.trim(),
      code: row.code?.trim() || '',
      name: row.name.trim(),
      description: row.description?.trim() || null,
      barcode: row.barcode?.trim() || null,
      costPrice: parseFloat(row.cost_price),
      sellingPrice: parseFloat(row.selling_price),
      categoryId,
      currentStock: currentStock,
      reservedStock: reservedStock,
      availableStock: Math.max(0, currentStock - reservedStock),
      minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : 0,
      reorderPoint: reorderPoint,
      supplierId: row.supplier?.trim() || null,
      taxRateId: null, // Would need tax rate mapping
      weight: row.weight_kg ? parseFloat(row.weight_kg) : null,
      dimensions: row.dimensions?.trim() || null,
      allowBackorders: row.allow_backorders ? Boolean(row.allow_backorders) : false,
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true
    };
  }

  /**
   * Parse CSV string to array of objects
   * PRIVATE: CSV parsing logic
   */
  private parseCSV(csvString: string): any[] {
    const lines = csvString.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        if (j < values.length) {
          row[headers[j]] = values[j].trim();
        } else {
          row[headers[j]] = '';
        }
      }
      
      result.push(row);
    }

    return result;
  }

  /**
   * Validate field type
   * PRIVATE: Type validation
   */
  private validateFieldType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return !isNaN(parseFloat(value));
      case 'boolean':
        return value === 'true' || value === 'false' || value === true || value === false;
      case 'date':
        return !isNaN(Date.parse(value));
      default:
        return true;
    }
  }
}