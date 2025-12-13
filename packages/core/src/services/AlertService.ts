// packages/core/src/services/AlertService.ts
import { Customer } from '../domain/Customer';
import { CreditLimit, CreditLimitUtilization, CreditLimitStatus } from '../domain/CreditLimit';
import { CustomerBalance, BalanceAlertType, BalanceAlertConfig } from '../domain/CustomerBalance';
import { Transaction, TransactionType } from '../domain/Transaction';
import { NotFoundError } from '../errors/ApplicationError';

// Repository interfaces (these would typically be imported from actual files)
interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findAllActive(): Promise<Customer[]>;
  findCustomersCreatedAfter(date: Date): Promise<Customer[]>;
}

interface ICreditLimitRepository {
  findActiveByCustomerId(customerId: string): Promise<CreditLimit | null>;
}

interface ICustomerBalanceRepository {
  findByCustomerId(customerId: string): Promise<CustomerBalance | null>;
}

interface ITransactionRepository {
  findRecentTransactions(customerId: string, days: number): Promise<Transaction[]>;
  findLargeTransactions(since: Date, threshold: number): Promise<Transaction[]>;
  findTransactionsSince(since: Date): Promise<Transaction[]>;
  getLastTransaction(customerId: string): Promise<Transaction | null>;
  customerHasTransactions(customerId: string): Promise<boolean>;
}

interface INotificationService {
  sendAlertNotification(customerId: string, alerts: Alert[], preferences: NotificationPreferences): Promise<void>;
}

export interface IAlertService {
  // Credit limit alerts
  checkCreditLimitAlerts(customerId: string): Promise<Alert[]>;
  checkAllCreditLimitAlerts(): Promise<Map<string, Alert[]>>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string): Promise<void>;
  
  // Balance alerts
  checkBalanceAlerts(customerId: string): Promise<Alert[]>;
  checkOverdueBalances(): Promise<Alert[]>;
  checkHighUtilizationCustomers(threshold?: number): Promise<Alert[]>;
  
  // Transaction alerts
  checkUnusualTransactions(customerId: string): Promise<Alert[]>;
  checkLargeTransactions(threshold?: number): Promise<Alert[]>;
  checkFrequentTransactions(timeWindowHours?: number, countThreshold?: number): Promise<Alert[]>;
  
  // Customer status alerts
  checkInactiveCustomers(daysThreshold?: number): Promise<Alert[]>;
  checkNewCustomers(daysThreshold?: number): Promise<Alert[]>;
  
  // Alert management
  getActiveAlerts(customerId?: string, alertType?: string): Promise<Alert[]>;
  getAlertHistory(customerId?: string, startDate?: Date, endDate?: Date): Promise<Alert[]>;
  configureAlertRules(config: AlertConfiguration): Promise<void>;
  
  // Notification integration
  sendAlertNotifications(alerts: Alert[]): Promise<void>;
  getNotificationPreferences(customerId: string): Promise<NotificationPreferences>;
  
  // Batch processing
  runDailyAlertChecks(): Promise<AlertSummary>;
  runWeeklyAlertReport(): Promise<WeeklyAlertReport>;
}

export interface Alert {
  id: string;
  customerId: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  data: Record<string, any>;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  acknowledgementNotes?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface AlertConfiguration {
  creditLimitThresholds: {
    warning: number; // Percentage
    critical: number; // Percentage
  };
  balanceThresholds: {
    overdueWarningDays: number;
    overdueCriticalDays: number;
    largeTransactionAmount: number;
  };
  customerStatusThresholds: {
    inactiveDays: number;
    newCustomerDays: number;
  };
  notificationSettings: {
    sendEmail: boolean;
    sendSMS: boolean;
    sendDashboard: boolean;
    quietHours?: { start: string; end: string }; // Format: "HH:MM"
  };
  autoAcknowledgeRules?: {
    maxAmount?: number;
    customerTypes?: string[];
    alertTypes?: string[];
  };
}

export interface NotificationPreferences {
  customerId: string;
  email: boolean;
  sms: boolean;
  dashboard: boolean;
  frequency: 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_SUMMARY';
  quietHours?: { start: string; end: string };
}

export interface AlertSummary {
  totalAlerts: number;
  bySeverity: {
    CRITICAL: number;
    WARNING: number;
    INFO: number;
  };
  byType: Record<string, number>;
  newAlerts: number;
  acknowledgedAlerts: number;
  unresolvedAlerts: number;
}

export interface WeeklyAlertReport {
  weekStart: Date;
  weekEnd: Date;
  totalAlerts: number;
  alertsByDay: Record<string, number>;
  topCustomers: Array<{ customerId: string; customerName: string; alertCount: number }>;
  mostCommonAlertTypes: Array<{ alertType: string; count: number }>;
  resolutionRate: number;
  averageResponseTime: number; // Hours
}

export class AlertService implements IAlertService {
  constructor(
    private customerRepository: ICustomerRepository,
    private creditLimitRepository: ICreditLimitRepository,
    private balanceRepository: ICustomerBalanceRepository,
    private transactionRepository: ITransactionRepository,
    private notificationService: INotificationService
  ) {}

  async checkCreditLimitAlerts(customerId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const creditLimit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    
    if (!creditLimit || !balance) {
      return alerts;
    }

    // Check utilization
    const utilization = (balance.currentBalance / creditLimit.amount) * 100;
    const config = await this.getAlertConfiguration();

    if (utilization >= config.creditLimitThresholds.critical) {
      alerts.push(this.createAlert(
        customerId,
        'CREDIT_LIMIT_CRITICAL',
        'CRITICAL',
        'Credit Limit Critical',
        `Credit utilization at ${utilization.toFixed(1)}% (CRITICAL)`,
        { utilization, creditLimit: creditLimit.amount, currentBalance: balance.currentBalance }
      ));
    } else if (utilization >= config.creditLimitThresholds.warning) {
      alerts.push(this.createAlert(
        customerId,
        'CREDIT_LIMIT_WARNING',
        'WARNING',
        'Credit Limit Warning',
        `Credit utilization at ${utilization.toFixed(1)}% (WARNING)`,
        { utilization, creditLimit: creditLimit.amount, currentBalance: balance.currentBalance }
      ));
    }

    // Check if limit is expiring soon
    if (creditLimit.validTo) {
      const daysUntilExpiry = Math.ceil((creditLimit.validTo.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 7) {
        alerts.push(this.createAlert(
          customerId,
          'CREDIT_LIMIT_EXPIRING',
          'WARNING',
          'Credit Limit Expiring Soon',
          `Credit limit expires in ${daysUntilExpiry} days`,
          { expiryDate: creditLimit.validTo, daysUntilExpiry }
        ));
      }
    }

    // Check if credit limit is suspended or inactive
    if (!creditLimit.isActive || creditLimit.status !== CreditLimitStatus.ACTIVE) {
      alerts.push(this.createAlert(
        customerId,
        'CREDIT_LIMIT_INACTIVE',
        'WARNING',
        'Credit Limit Inactive',
        `Credit limit status: ${creditLimit.status}`,
        { status: creditLimit.status, isActive: creditLimit.isActive }
      ));
    }

    return alerts;
  }

  async checkAllCreditLimitAlerts(): Promise<Map<string, Alert[]>> {
    const allAlerts = new Map<string, Alert[]>();
    const customers = await this.customerRepository.findAllActive();

    for (const customer of customers) {
      try {
        const alerts = await this.checkCreditLimitAlerts(customer.id);
        if (alerts.length > 0) {
          allAlerts.set(customer.id, alerts);
        }
      } catch (error) {
        console.error(`Error checking alerts for customer ${customer.id}:`, error);
      }
    }

    return allAlerts;
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string): Promise<void> {
    // This would typically update an alert in the database
    // For now, we'll log the acknowledgement
    console.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}: ${notes}`);
  }

  async checkBalanceAlerts(customerId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    
    if (!balance) {
      return alerts;
    }

    // Check overdue status
    if (balance.isOverdue) {
      const config = await this.getAlertConfiguration();
      
      // Calculate worst aging category
      const aging = balance.ageAnalysis;
      let worstAging = 'CURRENT';
      let worstAmount = 0;
      
      if (aging.over180 > 0) {
        worstAging = 'OVER_180_DAYS';
        worstAmount = aging.over180;
      } else if (aging.days91_180 > 0) {
        worstAging = '91_180_DAYS';
        worstAmount = aging.days91_180;
      } else if (aging.days61_90 > 0) {
        worstAging = '61_90_DAYS';
        worstAmount = aging.days61_90;
      } else if (aging.days31_60 > 0) {
        worstAging = '31_60_DAYS';
        worstAmount = aging.days31_60;
      }
      
      alerts.push(this.createAlert(
        customerId,
        'OVERDUE_BALANCE',
        'CRITICAL',
        'Overdue Balance',
        `Customer has overdue balance. Oldest category: ${worstAging} (${worstAmount.toFixed(2)})`,
        { 
          totalBalance: balance.currentBalance,
          agingAnalysis: aging,
          worstAgingCategory: worstAging,
          worstAgingAmount: worstAmount
        }
      ));
    }

    // Check if balance is negative (credit balance)
    if (balance.currentBalance < 0) {
      alerts.push(this.createAlert(
        customerId,
        'CREDIT_BALANCE',
        'INFO',
        'Credit Balance',
        `Customer has credit balance of ${Math.abs(balance.currentBalance).toFixed(2)}`,
        { creditBalance: Math.abs(balance.currentBalance) }
      ));
    }

    return alerts;
  }

  async checkOverdueBalances(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const customers = await this.customerRepository.findAllActive();
    const config = await this.getAlertConfiguration();

    for (const customer of customers) {
      try {
        const balance = await this.balanceRepository.findByCustomerId(customer.id);
        if (balance && balance.isOverdue) {
          // Check aging for severity
          const aging = balance.ageAnalysis;
          let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';
          
          if (aging.over180 > 0) {
            severity = 'CRITICAL';
          } else if (aging.days91_180 > 0) {
            severity = 'WARNING';
          } else if (aging.days61_90 > 0) {
            severity = 'WARNING';
          }

          alerts.push(this.createAlert(
            customer.id,
            'OVERDUE_BALANCE',
            severity,
            'Overdue Balance',
            `${customer.name} has overdue balance of ${balance.currentBalance.toFixed(2)}`,
            {
              customerName: customer.name,
              balance: balance.currentBalance,
              agingAnalysis: aging,
              isOverdue: balance.isOverdue
            }
          ));
        }
      } catch (error) {
        console.error(`Error checking overdue balance for customer ${customer.id}:`, error);
      }
    }

    // Sort by severity and balance amount
    return alerts.sort((a, b) => {
      const severityOrder = { 'CRITICAL': 3, 'WARNING': 2, 'INFO': 1 };
      if (severityOrder[b.severity] !== severityOrder[a.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return (b.data.balance || 0) - (a.data.balance || 0);
    });
  }

  async checkHighUtilizationCustomers(threshold: number = 80): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const customers = await this.customerRepository.findAllActive();

    for (const customer of customers) {
      try {
        const creditLimit = await this.creditLimitRepository.findActiveByCustomerId(customer.id);
        const balance = await this.balanceRepository.findByCustomerId(customer.id);
        
        if (creditLimit && balance) {
          const utilization = (balance.currentBalance / creditLimit.amount) * 100;
          
          if (utilization >= threshold) {
            let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'WARNING';
            if (utilization >= 90) severity = 'CRITICAL';
            else if (utilization >= 80) severity = 'WARNING';
            
            alerts.push(this.createAlert(
              customer.id,
              'HIGH_UTILIZATION',
              severity,
              'High Credit Utilization',
              `${customer.name} credit utilization at ${utilization.toFixed(1)}%`,
              {
                customerName: customer.name,
                utilization,
                creditLimit: creditLimit.amount,
                currentBalance: balance.currentBalance,
                availableCredit: creditLimit.amount - balance.currentBalance
              }
            ));
          }
        }
      } catch (error) {
        console.error(`Error checking utilization for customer ${customer.id}:`, error);
      }
    }

    return alerts.sort((a, b) => (b.data.utilization || 0) - (a.data.utilization || 0));
  }

  async checkUnusualTransactions(customerId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const config = await this.getAlertConfiguration();
    
    // Get recent transactions (last 7 days)
    const recentTransactions = await this.transactionRepository.findRecentTransactions(customerId, 7);
    
    if (recentTransactions.length === 0) {
      return alerts;
    }

    // Calculate average transaction amount
    const totalAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = totalAmount / recentTransactions.length;

    // Check for transactions significantly larger than average
    for (const transaction of recentTransactions) {
      if (transaction.amount > averageAmount * 3 && transaction.amount > config.balanceThresholds.largeTransactionAmount) {
        alerts.push(this.createAlert(
          customerId,
          'UNUSUAL_TRANSACTION',
          'WARNING',
          'Unusually Large Transaction',
          `Transaction ${transaction.referenceNumber} amount ${transaction.amount} is significantly larger than average`,
          {
            transactionId: transaction.id,
            transactionAmount: transaction.amount,
            averageAmount,
            transactionDate: transaction.transactionDate,
            referenceNumber: transaction.referenceNumber
          }
        ));
      }
    }

    // Check for unusual frequency
    const transactionsToday = recentTransactions.filter(t => {
      const today = new Date();
      return t.transactionDate.toDateString() === today.toDateString();
    }).length;

    if (transactionsToday >= 10) {
      alerts.push(this.createAlert(
        customerId,
        'HIGH_FREQUENCY_TRANSACTIONS',
        'WARNING',
        'High Transaction Frequency',
        `${transactionsToday} transactions today, which is unusually high`,
        { transactionCount: transactionsToday, date: new Date().toDateString() }
      ));
    }

    return alerts;
  }

  async checkLargeTransactions(threshold?: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const config = await this.getAlertConfiguration();
    const largeTransactionThreshold = threshold || config.balanceThresholds.largeTransactionAmount;
    
    // Get all transactions from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const largeTransactions = await this.transactionRepository.findLargeTransactions(oneDayAgo, largeTransactionThreshold);

    for (const transaction of largeTransactions) {
      try {
        const customer = await this.customerRepository.findById(transaction.customerId);
        if (customer) {
          alerts.push(this.createAlert(
            transaction.customerId,
            'LARGE_TRANSACTION',
            'WARNING',
            'Large Transaction Detected',
            `${customer.name} made large transaction of ${transaction.amount}`,
            {
              customerName: customer.name,
              transactionId: transaction.id,
              transactionAmount: transaction.amount,
              transactionDate: transaction.transactionDate,
              referenceNumber: transaction.referenceNumber,
              threshold: largeTransactionThreshold
            }
          ));
        }
      } catch (error) {
        console.error(`Error processing large transaction alert for transaction ${transaction.id}:`, error);
      }
    }

    return alerts;
  }

  async checkFrequentTransactions(timeWindowHours: number = 1, countThreshold: number = 5): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const timeWindowAgo = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    // This would typically involve more sophisticated querying
    // For now, we'll get recent transactions and group by customer
    const recentTransactions = await this.transactionRepository.findTransactionsSince(timeWindowAgo);
    
    // Group by customer
    const transactionsByCustomer = new Map<string, Transaction[]>();
    for (const transaction of recentTransactions) {
      if (!transactionsByCustomer.has(transaction.customerId)) {
        transactionsByCustomer.set(transaction.customerId, []);
      }
      transactionsByCustomer.get(transaction.customerId)!.push(transaction);
    }
    
    // Check each customer
    for (const [customerId, transactions] of transactionsByCustomer) {
      if (transactions.length >= countThreshold) {
        try {
          const customer = await this.customerRepository.findById(customerId);
          if (customer) {
            alerts.push(this.createAlert(
              customerId,
              'FREQUENT_TRANSACTIONS',
              'WARNING',
              'Frequent Transactions',
              `${customer.name} made ${transactions.length} transactions in the last ${timeWindowHours} hour(s)`,
              {
                customerName: customer.name,
                transactionCount: transactions.length,
                timeWindowHours,
                transactions: transactions.map(t => ({
                  id: t.id,
                  amount: t.amount,
                  type: t.type,
                  date: t.transactionDate
                }))
              }
            ));
          }
        } catch (error) {
          console.error(`Error processing frequent transaction alert for customer ${customerId}:`, error);
        }
      }
    }

    return alerts;
  }

  async checkInactiveCustomers(daysThreshold?: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const config = await this.getAlertConfiguration();
    const inactiveDays = daysThreshold || config.customerStatusThresholds.inactiveDays;
    
    const customers = await this.customerRepository.findAllActive();
    const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    for (const customer of customers) {
      try {
        // Get last transaction date
        const lastTransaction = await this.transactionRepository.getLastTransaction(customer.id);
        
        if (!lastTransaction || lastTransaction.transactionDate < cutoffDate) {
          const daysInactive = lastTransaction 
            ? Math.floor((new Date().getTime() - lastTransaction.transactionDate.getTime()) / (1000 * 60 * 60 * 24))
            : inactiveDays;
          
          alerts.push(this.createAlert(
            customer.id,
            'INACTIVE_CUSTOMER',
            'INFO',
            'Inactive Customer',
            `${customer.name} has been inactive for ${daysInactive} days`,
            {
              customerName: customer.name,
              daysInactive,
              lastTransactionDate: lastTransaction?.transactionDate,
              customerSince: customer.createdAt
            }
          ));
        }
      } catch (error) {
        console.error(`Error checking inactive status for customer ${customer.id}:`, error);
      }
    }

    return alerts;
  }

  async checkNewCustomers(daysThreshold?: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const config = await this.getAlertConfiguration();
    const newCustomerDays = daysThreshold || config.customerStatusThresholds.newCustomerDays;
    
    const cutoffDate = new Date(Date.now() - newCustomerDays * 24 * 60 * 60 * 1000);
    const newCustomers = await this.customerRepository.findCustomersCreatedAfter(cutoffDate);

    for (const customer of newCustomers) {
      // Check if they've made any purchases
      const hasPurchases = await this.transactionRepository.customerHasTransactions(customer.id);
      
      if (!hasPurchases) {
        alerts.push(this.createAlert(
          customer.id,
          'NEW_CUSTOMER_NO_PURCHASES',
          'INFO',
          'New Customer Without Purchases',
          `${customer.name} registered ${Math.floor((new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago but hasn't made any purchases`,
          {
            customerName: customer.name,
            daysSinceRegistration: Math.floor((new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
            registrationDate: customer.createdAt
          }
        ));
      }
    }

    return alerts;
  }

  async getActiveAlerts(customerId?: string, alertType?: string): Promise<Alert[]> {
    // This would typically query an alerts database
    // For now, return empty array as placeholder
    return [];
  }

  async getAlertHistory(customerId?: string, startDate?: Date, endDate?: Date): Promise<Alert[]> {
    // This would typically query an alerts database
    // For now, return empty array as placeholder
    return [];
  }

  async configureAlertRules(config: AlertConfiguration): Promise<void> {
    // This would typically save configuration to database
    // For now, just validate and log
    this.validateAlertConfiguration(config);
    console.log('Alert configuration updated:', config);
  }

  async sendAlertNotifications(alerts: Alert[]): Promise<void> {
    if (alerts.length === 0) {
      return;
    }

    // Group alerts by customer
    const alertsByCustomer = new Map<string, Alert[]>();
    for (const alert of alerts) {
      if (!alertsByCustomer.has(alert.customerId)) {
        alertsByCustomer.set(alert.customerId, []);
      }
      alertsByCustomer.get(alert.customerId)!.push(alert);
    }

    // Send notifications for each customer
    for (const [customerId, customerAlerts] of alertsByCustomer) {
      try {
        const preferences = await this.getNotificationPreferences(customerId);
        
        // Filter alerts based on severity and preferences
        const alertsToSend = customerAlerts.filter(alert => {
          // Check quiet hours
          if (preferences.quietHours) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number);
            const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
            
            const currentTime = currentHour * 60 + currentMinute;
            const startTime = startHour * 60 + startMinute;
            const endTime = endHour * 60 + endMinute;
            
            if (currentTime >= startTime && currentTime <= endTime && alert.severity !== 'CRITICAL') {
              return false; // Skip non-critical alerts during quiet hours
            }
          }
          
          return true;
        });

        if (alertsToSend.length > 0) {
          await this.notificationService.sendAlertNotification(customerId, alertsToSend, preferences);
        }
      } catch (error) {
        console.error(`Error sending notifications for customer ${customerId}:`, error);
      }
    }
  }

  async getNotificationPreferences(customerId: string): Promise<NotificationPreferences> {
    // This would typically query customer preferences from database
    // Return default preferences for now
    return {
      customerId,
      email: true,
      sms: false,
      dashboard: true,
      frequency: 'IMMEDIATE',
      quietHours: { start: '22:00', end: '07:00' }
    };
  }

  async runDailyAlertChecks(): Promise<AlertSummary> {
    console.log('Running daily alert checks...');
    
    const allAlerts: Alert[] = [];
    
    // Run all alert checks
    const overdueAlerts = await this.checkOverdueBalances();
    const highUtilizationAlerts = await this.checkHighUtilizationCustomers();
    const largeTransactionAlerts = await this.checkLargeTransactions();
    const inactiveCustomerAlerts = await this.checkInactiveCustomers();
    const newCustomerAlerts = await this.checkNewCustomers();
    
    allAlerts.push(
      ...overdueAlerts,
      ...highUtilizationAlerts,
      ...largeTransactionAlerts,
      ...inactiveCustomerAlerts,
      ...newCustomerAlerts
    );
    
    // Send notifications
    await this.sendAlertNotifications(allAlerts);
    
    // Generate summary
    const summary: AlertSummary = {
      totalAlerts: allAlerts.length,
      bySeverity: {
        CRITICAL: allAlerts.filter(a => a.severity === 'CRITICAL').length,
        WARNING: allAlerts.filter(a => a.severity === 'WARNING').length,
        INFO: allAlerts.filter(a => a.severity === 'INFO').length
      },
      byType: {},
      newAlerts: allAlerts.length, // In real implementation, this would compare with existing alerts
      acknowledgedAlerts: 0,
      unresolvedAlerts: allAlerts.length
    };
    
    // Count by type
    for (const alert of allAlerts) {
      summary.byType[alert.alertType] = (summary.byType[alert.alertType] || 0) + 1;
    }
    
    console.log('Daily alert checks completed:', summary);
    return summary;
  }

  async runWeeklyAlertReport(): Promise<WeeklyAlertReport> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date();
    
    // This would typically query alert history from database
    // For now, return a mock report
    
    const report: WeeklyAlertReport = {
      weekStart,
      weekEnd,
      totalAlerts: 0,
      alertsByDay: {},
      topCustomers: [],
      mostCommonAlertTypes: [],
      resolutionRate: 0,
      averageResponseTime: 0
    };
    
    return report;
  }

  private createAlert(
    customerId: string,
    alertType: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    title: string,
    message: string,
    data: Record<string, any>
  ): Alert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      alertType,
      severity,
      title,
      message,
      data,
      triggeredAt: new Date(),
      acknowledged: false,
      resolved: false
    };
  }

  private async getAlertConfiguration(): Promise<AlertConfiguration> {
    // This would typically load from database or configuration file
    // Return default configuration for now
    return {
      creditLimitThresholds: {
        warning: 80, // 80%
        critical: 90  // 90%
      },
      balanceThresholds: {
        overdueWarningDays: 30,
        overdueCriticalDays: 60,
        largeTransactionAmount: 10000
      },
      customerStatusThresholds: {
        inactiveDays: 90,
        newCustomerDays: 30
      },
      notificationSettings: {
        sendEmail: true,
        sendSMS: false,
        sendDashboard: true,
        quietHours: { start: '22:00', end: '07:00' }
      },
      autoAcknowledgeRules: {
        maxAmount: 1000,
        customerTypes: ['COMPANY'],
        alertTypes: ['INFO']
      }
    };
  }

  private validateAlertConfiguration(config: AlertConfiguration): void {
    if (config.creditLimitThresholds.warning >= config.creditLimitThresholds.critical) {
      throw new Error('Credit limit warning threshold must be less than critical threshold');
    }
    
    if (config.creditLimitThresholds.warning < 0 || config.creditLimitThresholds.warning > 100) {
      throw new Error('Credit limit warning threshold must be between 0 and 100');
    }
    
    if (config.creditLimitThresholds.critical < 0 || config.creditLimitThresholds.critical > 100) {
      throw new Error('Credit limit critical threshold must be between 0 and 100');
    }
    
    if (config.balanceThresholds.overdueWarningDays >= config.balanceThresholds.overdueCriticalDays) {
      throw new Error('Overdue warning days must be less than overdue critical days');
    }
    
    if (config.customerStatusThresholds.inactiveDays <= 0) {
      throw new Error('Inactive days threshold must be positive');
    }
    
    if (config.customerStatusThresholds.newCustomerDays <= 0) {
      throw new Error('New customer days threshold must be positive');
    }
  }
}