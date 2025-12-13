/**
 * Products API Controller
 * REST API endpoints for Product management
 * 
 * BUSINESS RULES:
 * - Role-based access control (RBAC)
 * - Input validation
 * - Error handling
 * - Pagination for 2000+ products
 * 
 * DESIGN RULES:
 * - Express.js controller pattern
 * - TypeScript strict mode
 * - Response standardization
 * - Error middleware integration
 */
import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../../../core/src/services/ProductService';
import { Product } from '../../../core/src/domain/Product';
import { ValidationError, NotFoundError } from '../../../core/src/errors/ApplicationError';
import { authenticate, authorize } from '../auth/auth.middleware';

export class ProductsController {
  private productService: ProductService;

  constructor(productService: ProductService) {
    this.productService = productService;
  }

  /**
   * Create a new product
   * ACCESS: Admin, Manager
   */
  createProduct = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const productData = req.body;
        
        // Basic validation
        if (!productData.sku || !productData.name) {
          return res.status(400).json({
            success: false,
            error: 'SKU and name are required'
          });
        }

        const product = await this.productService.createProduct(productData);
        
        res.status(201).json({
          success: true,
          data: product,
          message: 'Product created successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get product by ID
   * ACCESS: All authenticated users
   */
  getProduct = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const product = await this.productService.getProductById(id);
        
        res.status(200).json({
          success: true,
          data: product
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return res.status(404).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Update product
   * ACCESS: Admin, Manager
   */
  updateProduct = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        
        const product = await this.productService.updateProduct(id, updateData);
        
        res.status(200).json({
          success: true,
          data: product,
          message: 'Product updated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Delete product (soft delete)
   * ACCESS: Admin only
   */
  deleteProduct = [
    authenticate,
    authorize(['admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        await this.productService.deleteProduct(id);
        
        res.status(200).json({
          success: true,
          message: 'Product deleted successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Search products with filters
   * ACCESS: All authenticated users
   */
  searchProducts = [
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          searchTerm,
          categoryId,
          supplierId,
          minPrice,
          maxPrice,
          inStockOnly,
          lowStockOnly,
          isActive,
          page = '1',
          limit = '50'
        } = req.query;

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const take = parseInt(limit as string);

        const result = await this.productService.searchProducts({
          searchTerm: searchTerm as string,
          categoryId: categoryId as string,
          supplierId: supplierId as string,
          minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
          inStockOnly: inStockOnly === 'true',
          lowStockOnly: lowStockOnly === 'true',
          isActive: isActive !== undefined ? isActive === 'true' : undefined,
          skip,
          take
        });

        res.status(200).json({
          success: true,
          data: result.products,
          pagination: {
            page: parseInt(page as string),
            limit: take,
            total: result.total,
            pages: Math.ceil(result.total / take)
          }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get low stock products
   * ACCESS: Admin, Manager
   */
  getLowStockProducts = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const products = await this.productService.getLowStockProducts();
        
        res.status(200).json({
          success: true,
          data: products,
          count: products.length
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Update stock quantity
   * ACCESS: Admin, Manager
   */
  updateStock = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { quantity, reason } = req.body;
        
        if (quantity === undefined || typeof quantity !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Quantity is required and must be a number'
          });
        }

        const product = await this.productService.updateStock(
          id, 
          quantity, 
          reason || 'Manual adjustment'
        );
        
        res.status(200).json({
          success: true,
          data: product,
          message: `Stock updated by ${quantity > 0 ? '+' : ''}${quantity}`
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Get inventory value
   * ACCESS: Admin, Manager
   */
  getInventoryValue = [
    authenticate,
    authorize(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const value = await this.productService.getInventoryValue();
        
        res.status(200).json({
          success: true,
          data: {
            value,
            currency: 'MAD'
          }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Bulk import products from CSV
   * ACCESS: Admin only
   */
  bulkImport = [
    authenticate,
    authorize(['admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const products = req.body;
        
        if (!Array.isArray(products)) {
          return res.status(400).json({
            success: false,
            error: 'Request body must be an array of products'
          });
        }

        // TODO: Implement CSV parsing and validation
        // For now, accept array of product objects
        
        res.status(200).json({
          success: true,
          message: 'Bulk import endpoint ready (implementation pending)',
          received: products.length
        });
      } catch (error) {
        next(error);
      }
    }
  ];
}

export default ProductsController; 
