// packages/server/src/api/credit/limits.controller.ts
import { Request, Response } from 'express';
import { CreditService } from '../../../core/src/services/CreditService';
import { CreditValidationService } from '../../../core/src/services/CreditValidationService';
import { 
  CreditLimit,
  CreditLimitApplication,
  CreditLimitChangeRequest,
  CreditLimitValidation,
  CreditLimitUtilization,
  CreditLimitSettings
} from '../../../core/src/domain/CreditLimit';
import { ValidationError, NotFoundError, BusinessRuleError } from '../../../core/src/errors';

export class LimitsController {
  constructor(
    private creditService: CreditService,
    private creditValidationService: CreditValidationService
  ) {}

  // ========== CREDIT LIMIT MANAGEMENT ==========

  async getCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { limitId } = req.params;
      // Note: This would typically come from a repository
      // For now, we'll use a placeholder
      throw new Error('Credit limit retrieval by ID not implemented');
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCustomerCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      
      // This would come from CreditService
      const creditLimit = await this.creditService.getCreditUtilization(customerId);
      
      res.status(200).json({
        success: true,
        data: creditLimit
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async createCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const application: CreditLimitApplication = {
        customerId,
        requestedAmount: req.body.amount,
        currency: req.body.currency || 'MAD',
        annualRevenue: req.body.annualRevenue,
        yearsInBusiness: req.body.yearsInBusiness,
        existingCreditReferences: req.body.existingCreditReferences,
        bankName: req.body.bankName,
        bankAccountNumber: req.body.bankAccountNumber,
        bankContact: req.body.bankContact,
        tradeReferences: req.body.tradeReferences,
        financialStatements: req.body.financialStatements,
        taxReturns: req.body.taxReturns,
        businessRegistration: req.body.businessRegistration,
        applicationDate: new Date(),
        appliedBy: req.user?.id || 'system',
        notes: req.body.notes
      };

      // Validate the application
      const validation = await this.creditValidationService.validateCreditLimitApplication(
        customerId,
        application.requestedAmount
      );

      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
          riskLevel: validation.riskLevel,
          riskScore: validation.riskScore
        });
        return;
      }

      const creditLimit = await this.creditService.applyForCreditLimit(application);
      
      res.status(201).json({
        success: true,
        data: creditLimit,
        message: 'Credit limit created successfully',
        warnings: validation.warnings,
        riskAssessment: {
          level: validation.riskLevel,
          score: validation.riskScore
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { limitId } = req.params;
      const { newAmount, reason } = req.body;
      const changedBy = req.user?.id || 'system';

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
          error: 'Change reason is required'
        });
        return;
      }

      const creditLimit = await this.creditService.updateCreditLimit(limitId, newAmount, changedBy, reason);
      
      res.status(200).json({
        success: true,
        data: creditLimit,
        message: 'Credit limit updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async deleteCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { limitId } = req.params;
      // Note: Typically you would archive or deactivate rather than delete
      // For now, we'll use suspend functionality
      const suspendedBy = req.user?.id || 'system';
      
      await this.creditService.suspendCreditLimit(limitId, suspendedBy, 'Manual deletion request');
      
      res.status(200).json({
        success: true,
        message: 'Credit limit suspended (deactivated) successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT LIMIT APPROVAL WORKFLOW ==========

  async approveCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { limitId } = req.params;
      const { notes } = req.body;
      const approvedBy = req.user?.id || 'system';

      const creditLimit = await this.creditService.approveCreditLimit(limitId, approvedBy, notes);
      
      res.status(200).json({
        success: true,
        data: creditLimit,
        message: 'Credit limit approved successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async rejectCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { limitId } = req.params;
      const { reason } = req.body;
      const rejectedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
        return;
      }

      await this.creditService.rejectCreditLimit(limitId, rejectedBy, reason);
      
      res.status(200).json({
        success: true,
        message: 'Credit limit rejected successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async suspendCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const { limitId } = req.params;
      const { reason } = req.body;
      const suspendedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Suspension reason is required'
        });
        return;
      }

      await this.creditService.suspendCreditLimit(limitId, suspendedBy, reason);
      
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
      const { limitId } = req.params;
      const { reason } = req.body;
      const reinstatedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Reinstatement reason is required'
        });
        return;
      }

      await this.creditService.reinstateCreditLimit(limitId, reinstatedBy, reason);
      
      res.status(200).json({
        success: true,
        message: 'Credit limit reinstated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT LIMIT CHANGE REQUESTS ==========

  async submitLimitChangeRequest(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const request: Omit<CreditLimitChangeRequest, 'id'> = {
        customerId,
        newAmount: req.body.newAmount,
        changeReason: req.body.changeReason,
        effectiveDate: new Date(req.body.effectiveDate || new Date()),
        supportingDocuments: req.body.supportingDocuments,
        requestedBy: req.user?.id || 'system',
        requestedAt: new Date(),
        approvalRequired: req.body.approvalRequired !== false,
        justification: req.body.justification,
        expectedImpact: req.body.expectedImpact,
        status: 'PENDING'
      };

      // Validate the increase/decrease
      const currentLimit = await this.creditService.getCreditUtilization(customerId);
      const validation = await this.creditValidationService.validateCreditLimitIncrease(
        customerId,
        currentLimit.creditLimit,
        request.newAmount
      );

      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
          riskLevel: validation.riskLevel,
          riskScore: validation.riskScore
        });
        return;
      }

      const changeRequest = await this.creditService.submitCreditLimitChangeRequest(request);
      
      res.status(201).json({
        success: true,
        data: changeRequest,
        message: 'Credit limit change request submitted successfully',
        requiresApproval: request.approvalRequired
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async approveLimitChange(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const { notes } = req.body;
      const approvedBy = req.user?.id || 'system';

      const creditLimit = await this.creditService.approveCreditLimitChange(requestId, approvedBy, notes);
      
      res.status(200).json({
        success: true,
        data: creditLimit,
        message: 'Credit limit change approved successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async rejectLimitChange(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;
      const rejectedBy = req.user?.id || 'system';

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
        return;
      }

      await this.creditService.rejectCreditLimitChange(requestId, rejectedBy, reason);
      
      res.status(200).json({
        success: true,
        message: 'Credit limit change rejected successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getPendingChangeRequests(req: Request, res: Response): Promise<void> {
    try {
      // This would typically query a repository for pending requests
      // For now, return empty array as placeholder
      const pendingRequests: any[] = [];
      
      res.status(200).json({
        success: true,
        data: pendingRequests,
        count: pendingRequests.length
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT LIMIT UTILIZATION ==========

  async getUtilization(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const utilization = await this.creditService.getCreditUtilization(customerId);
      
      res.status(200).json({
        success: true,
        data: utilization
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getHighUtilizationList(req: Request, res: Response): Promise<void> {
    try {
      const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 80;
      const customers = await this.creditService.getHighUtilizationCustomers(threshold);
      
      res.status(200).json({
        success: true,
        data: customers,
        threshold,
        summary: {
          total: customers.length,
          critical: customers.filter(c => c.utilizationPercentage >= 90).length,
          warning: customers.filter(c => c.utilizationPercentage >= 80 && c.utilizationPercentage < 90).length
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT LIMIT HISTORY ==========

  async getLimitHistory(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const history = await this.creditService.getCreditLimitHistory(customerId);
      
      res.status(200).json({
        success: true,
        data: history,
        summary: {
          totalChanges: history.length,
          lastChange: history.length > 0 ? history[history.length - 1] : null,
          averageChangeAmount: history.length > 0 
            ? history.reduce((sum, h) => sum + Math.abs(h.newAmount - (h.previousAmount || 0)), 0) / history.length 
            : 0
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT LIMIT SETTINGS ==========

  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await this.creditService.getCreditSettings();
      
      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings: Partial<CreditLimitSettings> = req.body;
      const updatedBy = req.user?.id || 'system';

      const updatedSettings = await this.creditService.updateCreditSettings(settings, updatedBy);
      
      res.status(200).json({
        success: true,
        data: updatedSettings,
        message: 'Credit limit settings updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT OVERRIDES ==========

  async createOverride(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { amount, reason, expiryDate } = req.body;
      const overrideBy = req.user?.id || 'system';

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Override amount must be positive'
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Override reason is required'
        });
        return;
      }

      const overrideValidation = await this.creditValidationService.validateManagerOverride(
        customerId,
        amount,
        reason
      );

      if (!overrideValidation.allowed) {
        res.status(403).json({
          success: false,
          error: 'Override not allowed',
          details: overrideValidation
        });
        return;
      }

      const expiry = expiryDate ? new Date(expiryDate) : undefined;
      const creditLimit = await this.creditService.createCreditOverride(
        customerId,
        amount,
        overrideBy,
        reason,
        expiry
      );
      
      res.status(201).json({
        success: true,
        data: creditLimit,
        message: 'Credit override created successfully',
        requiresApproval: overrideValidation.requiresApproval,
        approvalLevel: overrideValidation.approvalLevel,
        conditions: overrideValidation.conditions
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async validateOverride(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, overrideId } = req.params;
      const isValid = await this.creditService.validateOverride(customerId, overrideId);
      
      res.status(200).json({
        success: true,
        data: { isValid },
        message: isValid ? 'Override is valid' : 'Override is invalid or expired'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== RISK ASSESSMENT ==========

  async assessRisk(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const riskAssessment = await this.creditService.assessCreditRisk(customerId);
      
      res.status(200).json({
        success: true,
        data: riskAssessment
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async performReview(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const reviewedBy = req.user?.id || 'system';

      const review = await this.creditService.performCreditReview(customerId, reviewedBy);
      
      res.status(200).json({
        success: true,
        data: review,
        message: 'Credit review completed successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== VALIDATION ==========

  async validateLimitIncrease(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { currentLimit, newAmount } = req.body;

      if (!currentLimit || !newAmount) {
        res.status(400).json({
          success: false,
          error: 'Current limit and new amount are required'
        });
        return;
      }

      const validation = await this.creditValidationService.validateCreditLimitIncrease(
        customerId,
        currentLimit,
        newAmount
      );
      
      res.status(200).json({
        success: validation.isValid,
        data: validation,
        message: validation.isValid ? 'Limit increase validation passed' : 'Limit increase validation failed'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async validateTransactionAgainstLimit(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be positive'
        });
        return;
      }

      const result = await this.creditValidationService.checkCreditLimit(customerId, amount);
      
      res.status(200).json({
        success: result.allowed,
        data: result,
        message: result.allowed ? 'Transaction within credit limit' : 'Transaction exceeds credit limit'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== BULK OPERATIONS ==========

  async batchCreditReviews(req: Request, res: Response): Promise<void> {
    try {
      const { customerIds } = req.body;
      const reviewedBy = req.user?.id || 'system';

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
          const review = await this.creditService.performCreditReview(customerId, reviewedBy);
          results.push({
            customerId,
            success: true,
            data: review
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
        message: `Batch credit review completed: ${results.length} successful, ${errors.length} failed`
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== ANALYTICS ==========

  async getCreditAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // This would aggregate data from multiple customers
      // For now, return a simplified analytics response
      const analytics = {
        timestamp: new Date().toISOString(),
        overview: {
          totalCreditExtended: 0, // Would be calculated
          averageCreditLimit: 0,
          totalUtilization: 0, // Percentage
          customersWithCredit: 0,
          customersOverLimit: 0
        },
        distribution: {
          byRiskLevel: {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0
          },
          byUtilization: {
            '0-30%': 0,
            '31-60%': 0,
            '61-80%': 0,
            '81-90%': 0,
            '91-100%': 0,
            '>100%': 0
          }
        },
        trends: {
          averageLimitGrowth: 'stable', // 'increasing', 'decreasing', 'stable'
          utilizationTrend: 'stable',
          approvalRate: 0 // Percentage
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

  // ========== HEALTH CHECK ==========

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Credit Limits API'
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

  // ========== UTILITY METHODS ==========

  private handleError(error: any, res: Response): void {
    console.error('Credit Limits API error:', error);

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

  // ========== EXPORT FUNCTIONALITY ==========

  async exportCreditLimits(req: Request, res: Response): Promise<void> {
    try {
      const { format } = req.query; // 'csv', 'excel', 'json'
      
      // This would generate an export file
      // For now, return a placeholder response
      const exportData = {
        format: format || 'json',
        timestamp: new Date().toISOString(),
        data: [] // Would contain actual credit limit data
      };

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=credit_limits.csv');
        res.status(200).send('customer_id,credit_limit,utilization,status\n');
      } else if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=credit_limits.xlsx');
        res.status(200).send('Excel file would be generated here');
      } else {
        res.status(200).json({
          success: true,
          data: exportData
        });
      }
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== NOTIFICATIONS ==========

  async sendLimitNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.body; // 'expiry', 'high_utilization', 'review_due'
      
      // This would trigger notifications for relevant customers
      // For now, return a placeholder response
      const notificationResult = {
        type,
        timestamp: new Date().toISOString(),
        customersNotified: 0,
        notificationsSent: 0
      };

      res.status(200).json({
        success: true,
        data: notificationResult,
        message: `Notification process initiated for ${type}`
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }
} 
