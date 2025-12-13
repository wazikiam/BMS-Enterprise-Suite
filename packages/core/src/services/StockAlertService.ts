/**
 * Stock Alert Service
 * Business logic for stock alert management
 * 
 * BUSINESS RULES:
 * - Real-time low stock detection
 * - Configurable alert thresholds
 * - Automatic alert generation
 * - Alert acknowledgment workflow
 * - Escalation rules for critical alerts
 * 
 * DESIGN RULES:
 * - TypeScript strict mode
 * - Event-driven architecture ready
 * - Configurable alert rules
 * - Notification system integration
 */
import { StockAlert, StockMovement } from '../domain/StockMovement';
import { StockRepository } from '../repositories/StockRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { ValidationError, NotFoundError } from '../errors/ApplicationError';

export interface AlertRule {
  id: string;
  name: string;
  condition: 'below_min_stock' | 'below_reorder_point' | 'zero_stock' | 'custom';
  threshold?: number;
  severity: 'info' | 'warning' | 'critical';
  autoAcknowledge: boolean;
  notifyUsers: string[]; // User IDs or roles to notify
  enabled: boolean;
}

export interface AlertNotification {
  alertId: string;
  productId: string;
  productName: string;
  alertType: string;
  severity: string;
  currentValue: number;
  thresholdValue: number;
  message: string;
  timestamp: Date;
}

export class StockAlertService {
  private stockRepository: StockRepository;
  private productRepository: ProductRepository;
  private alertRules: AlertRule[];

  constructor(
    stockRepository: StockRepository,
    productRepository: ProductRepository
  ) {
    this.stockRepository = stockRepository;
    this.productRepository = productRepository;
    this.alertRules = this.getDefaultAlertRules();
  }

  /**
   * Check for stock alerts on product stock change
   * BUSINESS RULES: Run after every stock movement
   */
  async checkStockAlerts(productId: string, newStockLevel: number): Promise<StockAlert[]> {
    const product = await this.productRepository.getProductById(productId);
    if (!product) {
      throw NotFoundError.product(productId);
    }

    const generatedAlerts: StockAlert[] = [];

    // Check each alert rule
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const shouldAlert = this.evaluateAlertRule(rule, product, newStockLevel);
      
      if (shouldAlert) {
        const alert = await this.createAlertFromRule(rule, product, newStockLevel);
        if (alert) {
          generatedAlerts.push(alert);
          
          // Generate notification if configured
          if (rule.notifyUsers.length > 0) {
            await this.generateNotification(alert, rule);
          }
        }
      }
    }

    return generatedAlerts;
  }

  /**
   * Run bulk stock alert check
   * BUSINESS RULES: Scheduled job for all products
   */
  async runBulkAlertCheck(): Promise<{
    totalChecked: number;
    alertsGenerated: number;
    criticalAlerts: number;
  }> {
    // Get all active products
    const searchResult = await this.productRepository.searchProducts({
      isActive: true,
      take: 2000 // Limit to 2000 products
    });

    let alertsGenerated = 0;
    let criticalAlerts = 0;

    // Check each product
    for (const product of searchResult.products) {
      const productAlerts = await this.checkStockAlerts(product.id, product.currentStock);
      
      if (productAlerts.length > 0) {
        alertsGenerated += productAlerts.length;
        criticalAlerts += productAlerts.filter(a => 
          a.alertType === 'OUT_OF_STOCK' || 
          (a.currentValue / a.thresholdValue) < 0.2
        ).length;
      }
    }

    return {
      totalChecked: searchResult.products.length,
      alertsGenerated,
      criticalAlerts
    };
  }

  /**
   * Get active stock alerts with filtering
   * BUSINESS RULES: Role-based access to alerts
   */
  async getActiveAlerts(options: {
    severity?: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON';
    acknowledged?: boolean;
    productId?: string;
    categoryId?: string;
    skip?: number;
    take?: number;
  } = {}): Promise<{ alerts: StockAlert[]; total: number }> {
    const allAlerts = await this.stockRepository.getActiveStockAlerts();
    
    // Apply filters
    let filteredAlerts = allAlerts;
    
    if (options.severity) {
      filteredAlerts = filteredAlerts.filter(a => a.alertType === options.severity);
    }
    
    if (options.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => 
        options.acknowledged ? a.acknowledgedBy !== null : a.acknowledgedBy === null
      );
    }
    
    if (options.productId) {
      filteredAlerts = filteredAlerts.filter(a => a.productId === options.productId);
    }

    // Apply pagination
    const skip = options.skip || 0;
    const take = options.take || 50;
    const paginatedAlerts = filteredAlerts.slice(skip, skip + take);

    return {
      alerts: paginatedAlerts,
      total: filteredAlerts.length
    };
  }

  /**
   * Acknowledge stock alert
   * BUSINESS RULES: Only unacknowledged alerts can be acknowledged
   */
  async acknowledgeAlert(alertId: string, userId: string, notes?: string): Promise<StockAlert> {
    const alert = await this.stockRepository.acknowledgeStockAlert(alertId, userId);
    
    // Log acknowledgment in audit trail
    await this.logAlertAction(alertId, 'ACKNOWLEDGED', userId, notes);
    
    return alert;
  }

  /**
   * Resolve stock alert (when stock is replenished)
   * BUSINESS RULES: Auto-resolve when stock reaches safe level
   */
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<StockAlert> {
    const alert = await this.stockRepository.resolveStockAlert(alertId);
    
    // Log resolution
    await this.logAlertAction(alertId, 'RESOLVED', resolvedBy, 'Stock replenished');
    
    return alert;
  }

  /**
   * Escalate alert (increase severity)
   * BUSINESS RULES: For alerts that haven't been addressed
   */
  async escalateAlert(alertId: string, newSeverity: 'LOW_STOCK' | 'OUT_OF_STOCK'): Promise<StockAlert> {
    // TODO: Implement alert escalation
    // This would require updating the alert in the database
    
    throw new Error('Alert escalation not yet implemented');
  }

  /**
   * Get alert statistics for dashboard
   * BUSINESS RULES: Real-time alert metrics
   */
  async getAlertStatistics(): Promise<{
    totalActive: number;
    unacknowledged: number;
    critical: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    resolutionRate: number;
    averageResponseTime: number; // in hours
  }> {
    const allAlerts = await this.stockRepository.getActiveStockAlerts();
    
    const unacknowledged = allAlerts.filter(a => !a.acknowledgedBy).length;
    const critical = allAlerts.filter(a => a.alertType === 'OUT_OF_STOCK').length;
    
    // Group by severity
    const bySeverity = allAlerts.reduce((acc, alert) => {
      acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // TODO: Group by category (would need product category data)
    const byCategory: Record<string, number> = {
      'Electronics': Math.floor(Math.random() * 10),
      'Furniture': Math.floor(Math.random() * 5),
      'Other': Math.floor(Math.random() * 3)
    };
    
    // Calculate resolution rate (placeholder)
    const totalResolved = Math.floor(Math.random() * 50);
    const totalAlerts = allAlerts.length + totalResolved;
    const resolutionRate = totalAlerts > 0 ? (totalResolved / totalAlerts) * 100 : 0;
    
    // Average response time (placeholder)
    const averageResponseTime = 4.5; // hours

    return {
      totalActive: allAlerts.length,
      unacknowledged,
      critical,
      bySeverity,
      byCategory,
      resolutionRate,
      averageResponseTime
    };
  }

  /**
   * Configure alert rules
   * BUSINESS RULES: Admin-only configuration
   */
  async configureAlertRule(rule: AlertRule): Promise<AlertRule> {
    // Validate rule
    if (!rule.name || rule.name.trim().length === 0) {
      throw new ValidationError('Rule name is required');
    }
    
    if (rule.condition === 'custom' && !rule.threshold) {
      throw new ValidationError('Custom rules require a threshold value');
    }
    
    if (rule.threshold !== undefined && rule.threshold < 0) {
      throw new ValidationError('Threshold cannot be negative');
    }
    
    // Save rule (in real implementation, this would save to database)
    const existingIndex = this.alertRules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.alertRules[existingIndex] = rule;
    } else {
      rule.id = `rule_${Date.now()}`;
      this.alertRules.push(rule);
    }
    
    return rule;
  }

  /**
   * Get alert notification history
   * BUSINESS RULES: Audit trail of all notifications
   */
  async getNotificationHistory(alertId: string): Promise<AlertNotification[]> {
    // TODO: Implement notification history
    // This would query a notifications table
    
    // Placeholder implementation
    return [
      {
        alertId,
        productId: 'prod_123',
        productName: 'Sample Product',
        alertType: 'LOW_STOCK',
        severity: 'warning',
        currentValue: 5,
        thresholdValue: 10,
        message: 'Product stock below minimum level',
        timestamp: new Date()
      }
    ];
  }

  /**
   * Evaluate if an alert rule triggers
   * PRIVATE: Rule evaluation logic
   */
  private evaluateAlertRule(rule: AlertRule, product: any, stockLevel: number): boolean {
    switch (rule.condition) {
      case 'below_min_stock':
        return stockLevel <= product.minStockLevel && stockLevel > 0;
      
      case 'below_reorder_point':
        return stockLevel <= product.reorderPoint && stockLevel > 0;
      
      case 'zero_stock':
        return stockLevel === 0;
      
      case 'custom':
        return rule.threshold !== undefined && stockLevel <= rule.threshold;
      
      default:
        return false;
    }
  }

  /**
   * Create alert from rule evaluation
   * PRIVATE: Alert creation logic
   */
  private async createAlertFromRule(rule: AlertRule, product: any, stockLevel: number): Promise<StockAlert | null> {
    // Check if similar alert already exists
    const existingAlerts = await this.stockRepository.getActiveStockAlerts();
    const similarAlertExists = existingAlerts.some(alert => 
      alert.productId === product.id && 
      alert.alertType === this.mapRuleToAlertType(rule)
    );
    
    if (similarAlertExists) {
      return null; // Don't create duplicate alert
    }
    
    // Create alert
    const alertData: Omit<StockAlert, 'id' | 'triggeredAt' | 'resolvedAt'> = {
      productId: product.id,
      variantId: null,
      alertType: this.mapRuleToAlertType(rule),
      thresholdValue: this.getThresholdValue(rule, product),
      currentValue: stockLevel,
      isActive: true,
      acknowledgedBy: rule.autoAcknowledge ? 'system' : null,
      acknowledgedAt: rule.autoAcknowledge ? new Date() : null
    };
    
    return await this.stockRepository.createStockAlert(alertData);
  }

  /**
   * Generate notification for alert
   * PRIVATE: Notification generation
   */
  private async generateNotification(alert: StockAlert, rule: AlertRule): Promise<void> {
    // TODO: Implement notification system
    // This would integrate with email, SMS, or in-app notifications
    
    console.log(`Notification generated for alert ${alert.id}:`, {
      rule: rule.name,
      severity: rule.severity,
      notifyUsers: rule.notifyUsers
    });
  }

  /**
   * Log alert actions for audit trail
   * PRIVATE: Audit logging
   */
  private async logAlertAction(alertId: string, action: string, userId: string, notes?: string): Promise<void> {
    // TODO: Implement audit logging
    console.log(`Alert ${alertId} ${action} by ${userId}: ${notes || ''}`);
  }

  /**
   * Map rule to alert type
   * PRIVATE: Type mapping
   */
  private mapRuleToAlertType(rule: AlertRule): 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON' {
    switch (rule.condition) {
      case 'zero_stock':
        return 'OUT_OF_STOCK';
      case 'custom':
        return rule.severity === 'critical' ? 'OUT_OF_STOCK' : 'LOW_STOCK';
      default:
        return 'LOW_STOCK';
    }
  }

  /**
   * Get threshold value for rule
   * PRIVATE: Threshold calculation
   */
  private getThresholdValue(rule: AlertRule, product: any): number {
    switch (rule.condition) {
      case 'below_min_stock':
        return product.minStockLevel;
      case 'below_reorder_point':
        return product.reorderPoint;
      case 'zero_stock':
        return 0;
      case 'custom':
        return rule.threshold || 0;
      default:
        return 0;
    }
  }

  /**
   * Get default alert rules
   * PRIVATE: Default configuration
   */
  private getDefaultAlertRules(): AlertRule[] {
    return [
      {
        id: 'rule_1',
        name: 'Out of Stock',
        condition: 'zero_stock',
        severity: 'critical',
        autoAcknowledge: false,
        notifyUsers: ['admin', 'manager'],
        enabled: true
      },
      {
        id: 'rule_2',
        name: 'Below Minimum Stock',
        condition: 'below_min_stock',
        severity: 'warning',
        autoAcknowledge: false,
        notifyUsers: ['manager'],
        enabled: true
      },
      {
        id: 'rule_3',
        name: 'Below Reorder Point',
        condition: 'below_reorder_point',
        severity: 'info',
        autoAcknowledge: true,
        notifyUsers: [],
        enabled: true
      },
      {
        id: 'rule_4',
        name: 'Critical Low Stock (20%)',
        condition: 'custom',
        threshold: 0.2, // 20% of min stock
        severity: 'critical',
        autoAcknowledge: false,
        notifyUsers: ['admin'],
        enabled: true
      }
    ];
  }
}