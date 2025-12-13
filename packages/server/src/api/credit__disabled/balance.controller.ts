// packages/server/src/api/credit/balance.controller.ts
import { Request, Response } from 'express';
import { BalanceService } from '../../../core/src/services/BalanceService';
import { 
  BalanceAdjustment,
  BalanceTransfer,
  BalanceAlertConfig,
  BalanceTransaction,
  BalanceTransactionType
} from '../../../core/src/domain/CustomerBalance';
import { TransactionType } from '../../../core/src/domain/Transaction';
import { ValidationError, NotFoundError, BusinessRuleError } from '../../../core/src/errors';

export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  // ========== BALANCE MANAGEMENT ==========

  async getCustomerBalance(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const balance = await this.balanceService.getCustomerBalance(customerId);
      
      res.status(200).json({
        success: true,
        data: balance
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async recalculateBalance(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const recalculatedBy = req.user?.id || 'system';

      const balance = await this.balanceService.recalculateBalance(customerId, recalculatedBy);
      
      res.status(200).json({
        success: true,
        data: balance,
        message: 'Balance recalculated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== AGING ANALYSIS ==========

  async getAgingAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const aging = await this.balanceService.calculateAgingAnalysis(customerId);
      
      res.status(200).json({
        success: true,
        data: aging
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateAging(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      await this.balanceService.updateAgingForCustomer(customerId);
      
      res.status(200).json({
        success: true,
        message: 'Aging analysis updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async batchUpdateAging(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.balanceService.batchUpdateAging();
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Batch aging update completed: ${result.processed} processed, ${result.errors} errors`
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BALANCE TRANSACTIONS ==========

  async createBalanceTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const transactionData = req.body;
      const createdBy = req.user?.id || 'system';

      // Validate required fields
      if (!transactionData.type || !transactionData.amount) {
        res.status(400).json({
          success: false,
          error: 'Transaction type and amount are required'
        });
        return;
      }

      const transaction: Omit<BalanceTransaction, 'id'> = {
        customerId,
        balanceId: '', // Will be populated by service
        type: transactionData.type as BalanceTransactionType,
        amount: transactionData.amount,
        currency: transactionData.currency || 'MAD',
        referenceType: transactionData.referenceType || 'MANUAL',
        referenceId: transactionData.referenceId || '',
        referenceNumber: transactionData.referenceNumber || `BAL-${Date.now()}`,
        transactionDate: new Date(transactionData.transactionDate || new Date()),
        dueDate: transactionData.dueDate ? new Date(transactionData.dueDate) : undefined,
        postingDate: new Date(transactionData.postingDate || new Date()),
        status: 'POSTED',
        isReconciled: false,
        description: transactionData.description || 'Manual balance transaction',
        notes: transactionData.notes,
        createdBy,
        balanceBefore: 0, // Will be populated by service
        balanceAfter: 0,   // Will be populated by service
        version: 1
      };

      const transactionRecord = await this.balanceService.createBalanceTransaction(transaction);
      
      res.status(201).json({
        success: true,
        data: transactionRecord,
        message: 'Balance transaction created successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async voidBalanceTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const voidedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Void reason is required'
        });
        return;
      }

      await this.balanceService.voidBalanceTransaction(transactionId, voidedBy, reason);
      
      res.status(200).json({
        success: true,
        message: 'Balance transaction voided successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async reconcileTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const reconciledBy = req.user?.id || 'system';

      await this.balanceService.reconcileTransaction(transactionId, reconciledBy);
      
      res.status(200).json({
        success: true,
        message: 'Transaction reconciled successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BALANCE ADJUSTMENTS ==========

  async createBalanceAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const adjustmentData = req.body;
      const adjustedBy = req.user?.id || 'system';

      // Validate required fields
      if (!adjustmentData.adjustmentType || !adjustmentData.amount || !adjustmentData.reason) {
        res.status(400).json({
          success: false,
          error: 'Adjustment type, amount, and reason are required'
        });
        return;
      }

      const adjustment: Omit<BalanceAdjustment, 'id'> = {
        customerId,
        adjustmentType: adjustmentData.adjustmentType,
        amount: adjustmentData.amount,
        currency: adjustmentData.currency || 'MAD',
        reason: adjustmentData.reason,
        justification: adjustmentData.justification || 'Manual adjustment',
        requiresApproval: adjustmentData.requiresApproval !== false,
        approvedBy: adjustmentData.approvedBy,
        approvedAt: adjustmentData.approvedAt ? new Date(adjustmentData.approvedAt) : undefined,
        originalTransactionId: adjustmentData.originalTransactionId,
        affectsAging: adjustmentData.affectsAging !== false,
        agingCategory: adjustmentData.agingCategory,
        adjustedBy,
        adjustedAt: new Date(),
        notes: adjustmentData.notes
      };

      const adjustmentRecord = await this.balanceService.createBalanceAdjustment(adjustment);
      
      res.status(201).json({
        success: true,
        data: adjustmentRecord,
        message: 'Balance adjustment created successfully',
        requiresApproval: adjustment.requiresApproval
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async approveAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const { adjustmentId } = req.params;
      const { notes } = req.body;
      const approvedBy = req.user?.id || 'system';

      await this.balanceService.approveAdjustment(adjustmentId, approvedBy, notes);
      
      res.status(200).json({
        success: true,
        message: 'Adjustment approved successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BALANCE SNAPSHOTS AND HISTORY ==========

  async createBalanceSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const createdBy = req.user?.id || 'system';

      const snapshot = await this.balanceService.createBalanceSnapshot(customerId, createdBy);
      
      res.status(201).json({
        success: true,
        data: snapshot,
        message: 'Balance snapshot created successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getBalanceHistory(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { startDate, endDate } = req.query;

      const fromDate = startDate ? new Date(startDate as string) : undefined;
      const toDate = endDate ? new Date(endDate as string) : undefined;

      const history = await this.balanceService.getBalanceHistory(customerId, fromDate, toDate);
      
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== RECONCILIATION ==========

  async reconcileCustomerBalance(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const reconciledBy = req.user?.id || 'system';

      const reconciliation = await this.balanceService.reconcileCustomerBalance(customerId, reconciledBy);
      
      res.status(200).json({
        success: true,
        data: reconciliation,
        message: reconciliation.status === 'COMPLETED' 
          ? 'Balance reconciliation completed successfully' 
          : 'Balance reconciliation completed with discrepancies'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async findReconciliationDiscrepancies(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const discrepancies = await this.balanceService.findReconciliationDiscrepancies(customerId);
      
      res.status(200).json({
        success: true,
        data: discrepancies,
        message: discrepancies.length > 0 
          ? `${discrepancies.length} discrepancies found` 
          : 'No discrepancies found'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BALANCE TRANSFERS ==========

  async transferBalance(req: Request, res: Response): Promise<void> {
    try {
      const transferData = req.body;
      const transferredBy = req.user?.id || 'system';

      // Validate required fields
      if (!transferData.fromCustomerId || !transferData.toCustomerId || !transferData.amount) {
        res.status(400).json({
          success: false,
          error: 'From customer, to customer, and amount are required'
        });
        return;
      }

      const transfer: Omit<BalanceTransfer, 'id'> = {
        fromCustomerId: transferData.fromCustomerId,
        toCustomerId: transferData.toCustomerId,
        amount: transferData.amount,
        currency: transferData.currency || 'MAD',
        transferDate: new Date(transferData.transferDate || new Date()),
        reason: transferData.reason || 'MANUAL_TRANSFER',
        description: transferData.description || 'Manual balance transfer',
        requiresApproval: transferData.requiresApproval !== false,
        approvedBy: transferData.approvedBy,
        approvedAt: transferData.approvedAt ? new Date(transferData.approvedAt) : undefined,
        sourceTransactionId: '', // Will be populated by service
        destinationTransactionId: '', // Will be populated by service
        transferredBy
      };

      const transferRecord = await this.balanceService.transferBalance(transfer);
      
      res.status(201).json({
        success: true,
        data: transferRecord,
        message: 'Balance transfer completed successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async reverseTransfer(req: Request, res: Response): Promise<void> {
    try {
      const { transferId } = req.params;
      const { reason } = req.body;
      const reversedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Reversal reason is required'
        });
        return;
      }

      await this.balanceService.reverseTransfer(transferId, reversedBy, reason);
      
      res.status(200).json({
        success: true,
        message: 'Balance transfer reversed successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== ALERTS AND NOTIFICATIONS ==========

  async checkBalanceAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const alerts = await this.balanceService.checkBalanceAlerts(customerId);
      
      res.status(200).json({
        success: true,
        data: alerts,
        message: alerts.length > 0 
          ? `${alerts.length} balance alerts found` 
          : 'No balance alerts found'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async configureBalanceAlerts(req: Request, res: Response): Promise<void> {
    try {
      const config: BalanceAlertConfig = req.body;
      const configuredBy = req.user?.id || 'system';

      await this.balanceService.configureBalanceAlerts(config, configuredBy);
      
      res.status(200).json({
        success: true,
        message: 'Balance alert configuration updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== REPORTING ==========

  async generateBalanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { customerIds } = req.body;
      
      const balances = await this.balanceService.generateBalanceReport(
        Array.isArray(customerIds) ? customerIds : undefined
      );
      
      res.status(200).json({
        success: true,
        data: balances,
        summary: {
          totalCustomers: balances.length,
          totalBalance: balances.reduce((sum, b) => sum + b.currentBalance, 0),
          averageBalance: balances.length > 0 
            ? balances.reduce((sum, b) => sum + b.currentBalance, 0) / balances.length 
            : 0,
          overdueCount: balances.filter(b => b.isOverdue).length,
          overLimitCount: balances.filter(b => b.isOverLimit).length
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async generateAgingReport(req: Request, res: Response): Promise<void> {
    try {
      const { ageCategory } = req.query;
      
      const report = await this.balanceService.generateAgingReport(
        ageCategory as keyof any
      );
      
      res.status(200).json({
        success: true,
        data: report,
        summary: {
          totalCustomers: report.length,
          totalAgingAmount: report.reduce((sum, r) => sum + (r.categoryAmount || 0), 0),
          averageAgingPercentage: report.length > 0 
            ? report.reduce((sum, r) => sum + (r.categoryPercentage || 0), 0) / report.length 
            : 0
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== UTILITY FUNCTIONS ==========

  async calculateDaysSalesOutstanding(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const dso = await this.balanceService.calculateDaysSalesOutstanding(customerId);
      
      res.status(200).json({
        success: true,
        data: {
          customerId,
          daysSalesOutstanding: dso,
          interpretation: this.interpretDSO(dso)
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async calculateAverageCollectionPeriod(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const acp = await this.balanceService.calculateAverageCollectionPeriod(customerId);
      
      res.status(200).json({
        success: true,
        data: {
          customerId,
          averageCollectionPeriod: acp,
          interpretation: this.interpretACP(acp)
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async predictCashFlow(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { days } = req.query;
      
      const predictionDays = days ? parseInt(days as string) : 30;
      const cashFlow = await this.balanceService.predictCashFlow(customerId, predictionDays);
      
      res.status(200).json({
        success: true,
        data: {
          customerId,
          predictionDays,
          cashFlow,
          summary: {
            totalExpected: cashFlow.reduce((sum, cf) => sum + cf.expectedAmount, 0),
            dailyAverage: cashFlow.length > 0 
              ? cashFlow.reduce((sum, cf) => sum + cf.expectedAmount, 0) / cashFlow.length 
              : 0,
            peakDate: cashFlow.length > 0 
              ? cashFlow.reduce((prev, current) => 
                  (prev.expectedAmount > current.expectedAmount) ? prev : current
                ).date 
              : null
          }
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BATCH OPERATIONS ==========

  async batchRecalculateBalances(req: Request, res: Response): Promise<void> {
    try {
      const { customerIds } = req.body;
      const recalculatedBy = req.user?.id || 'system';

      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'customerIds must be a non-empty array'
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const customerId of customerIds) {
        try {
          const balance = await this.balanceService.recalculateBalance(customerId, recalculatedBy);
          results.push({
            customerId,
            success: true,
            data: balance
          });
        } catch (error: any) {
          errors.push({
            customerId,
            success: false,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          total: customerIds.length,
          successful: results.length,
          failed: errors.length,
          results,
          errors
        },
        message: `Batch balance recalculation completed: ${results.length} successful, ${errors.length} failed`
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== HEALTH CHECK ==========

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Balance Management API'
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

  // ========== PRIVATE UTILITY METHODS ==========

  private handleError(error: any, res: Response): void {
    console.error('Balance API error:', error);

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

  private interpretDSO(dso: number): string {
    if (dso === 0) return 'No outstanding sales';
    if (dso < 30) return 'Excellent - collections are timely';
    if (dso < 45) return 'Good - acceptable collection period';
    if (dso < 60) return 'Fair - collections could be improved';
    if (dso < 90) return 'Poor - collections need attention';
    return 'Critical - collections require immediate action';
  }

  private interpretACP(acp: number): string {
    if (acp === 0) return 'No payment history available';
    if (acp < 15) return 'Excellent - customers pay quickly';
    if (acp < 30) return 'Good - timely payments';
    if (acp < 45) return 'Fair - some delays in payments';
    if (acp < 60) return 'Poor - frequent payment delays';
    return 'Critical - significant payment delays';
  }

  // ========== ANALYTICS ENDPOINTS ==========

  async getBalanceAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // This would aggregate data from multiple customers
      // For now, return a simplified analytics response
      const analytics = {
        timestamp: new Date().toISOString(),
        overview: {
          totalOutstandingBalance: 0, // Would be calculated
          averageBalancePerCustomer: 0,
          customersWithOverdueBalances: 0,
          totalOverdueAmount: 0
        },
        agingAnalysis: {
          current: 0,
          days31_60: 0,
          days61_90: 0,
          days91_180: 0,
          over180: 0
        },
        trends: {
          balanceGrowth: 'stable', // 'increasing', 'decreasing', 'stable'
          collectionEfficiency: 0, // Percentage
          writeOffRate: 0 // Percentage
        }
      };

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomerBalanceTrend(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { period } = req.query; // '7d', '30d', '90d', '1y'

      // Get balance history for the period
      let startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30); // Default to 30 days
      }

      const history = await this.balanceService.getBalanceHistory(customerId, startDate, new Date());
      
      // Format trend data
      const trend = history.map(snapshot => ({
        date: snapshot.snapshotDate,
        balance: snapshot.balance,
        creditLimit: snapshot.creditLimit,
        utilization: snapshot.creditLimit > 0 
          ? (snapshot.balance / snapshot.creditLimit) * 100 
          : 0
      }));

      res.status(200).json({
        success: true,
        data: {
          customerId,
          period,
          trend,
          summary: {
            startBalance: trend.length > 0 ? trend[0].balance : 0,
            endBalance: trend.length > 0 ? trend[trend.length - 1].balance : 0,
            change: trend.length > 0 ? trend[trend.length - 1].balance - trend[0].balance : 0,
            averageBalance: trend.length > 0 
              ? trend.reduce((sum, point) => sum + point.balance, 0) / trend.length 
              : 0
          }
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }
}