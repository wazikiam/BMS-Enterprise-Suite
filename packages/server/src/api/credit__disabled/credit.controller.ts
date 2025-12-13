// packages/server/src/api/credit/credit.controller.ts
import { Request, Response } from 'express';
import { CreditService } from '../../../core/src/services/CreditService';
import { CreditValidationService } from '../../../core/src/services/CreditValidationService';
import { 
  CreditLimitApplication, 
  CreditLimitChangeRequest,
  CreditLimitSettings 
} from '../../../core/src/domain/CreditLimit';
import { TransactionType } from '../../../core/src/domain/Transaction';
import { ValidationError, NotFoundError, BusinessRuleError } from '../../../core/src/errors';

export class CreditController {
  constructor(
    private creditService: CreditService,
    private creditValidationService: CreditValidationService
  ) {}

  // ========== CREDIT LIMIT APPLICATION ==========

  async applyForCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const application: CreditLimitApplication = {
        customerId: req.params.customerId,
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
        application.customerId,
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
        message: 'Credit limit application submitted successfully',
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

  // ========== CREDIT VALIDATION ==========

  async validateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { amount, transactionType } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be positive'
        });
        return;
      }

      const validation = await this.creditValidationService.validateTransaction(
        customerId,
        amount,
        transactionType || TransactionType.SALE
      );
      
      res.status(200).json({
        success: validation.isValid,
        data: validation,
        message: validation.isValid ? 'Transaction validation passed' : 'Transaction validation failed'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async checkCreditLimit(req: Request, res: Response): Promise<void> {
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
        message: result.allowed ? 'Credit check passed' : 'Credit check failed'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async calculateCreditScore(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const creditScore = await this.creditValidationService.calculateCreditScore(customerId);
      
      res.status(200).json({
        success: true,
        data: {
          customerId,
          creditScore,
          rating: this.getCreditRating(creditScore)
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CREDIT LIMIT REQUESTS ==========

  async submitCreditLimitChangeRequest(req: Request, res: Response): Promise<void> {
    try {
      const request: Omit<CreditLimitChangeRequest, 'id'> = {
        customerId: req.params.customerId,
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

      const changeRequest = await this.creditService.submitCreditLimitChangeRequest(request);
      
      res.status(201).json({
        success: true,
        data: changeRequest,
        message: 'Credit limit change request submitted successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async approveCreditLimitChange(req: Request, res: Response): Promise<void> {
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

  async rejectCreditLimitChange(req: Request, res: Response): Promise<void> {
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

  // ========== CREDIT UTILIZATION AND REPORTING ==========

  async getCreditUtilization(req: Request, res: Response): Promise<void> {
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

  async getHighUtilizationCustomers(req: Request, res: Response): Promise<void> {
    try {
      const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 80;
      const customers = await this.creditService.getHighUtilizationCustomers(threshold);
      
      res.status(200).json({
        success: true,
        data: customers,
        threshold
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getCreditLimitHistory(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const history = await this.creditService.getCreditLimitHistory(customerId);
      
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== SETTINGS MANAGEMENT ==========

  async getCreditSettings(req: Request, res: Response): Promise<void> {
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

  async updateCreditSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings: Partial<CreditLimitSettings> = req.body;
      const updatedBy = req.user?.id || 'system';

      const updatedSettings = await this.creditService.updateCreditSettings(settings, updatedBy);
      
      res.status(200).json({
        success: true,
        data: updatedSettings,
        message: 'Credit settings updated successfully'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== OVERRIDE MANAGEMENT ==========

  async createCreditOverride(req: Request, res: Response): Promise<void> {
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

  async assessCreditRisk(req: Request, res: Response): Promise<void> {
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

  async performCreditReview(req: Request, res: Response): Promise<void> {
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

  // ========== BULK OPERATIONS ==========

  async validateMultipleTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { customerIds, amounts } = req.body;

      if (!Array.isArray(customerIds) || !Array.isArray(amounts)) {
        res.status(400).json({
          success: false,
          error: 'customerIds and amounts must be arrays'
        });
        return;
      }

      if (customerIds.length !== amounts.length) {
        res.status(400).json({
          success: false,
          error: 'customerIds and amounts arrays must have the same length'
        });
        return;
      }

      const validations = await this.creditValidationService.validateMultipleTransactions(customerIds, amounts);
      
      // Convert Map to object for JSON serialization
      const validationsObj: Record<string, any> = {};
      validations.forEach((validation, customerId) => {
        validationsObj[customerId] = validation;
      });
      
      res.status(200).json({
        success: true,
        data: validationsObj,
        summary: {
          total: customerIds.length,
          valid: Array.from(validations.values()).filter(v => v.isValid).length,
          invalid: Array.from(validations.values()).filter(v => !v.isValid).length
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async checkRegulatoryCompliance(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { transactionAmount } = req.body;

      if (!transactionAmount || transactionAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Transaction amount must be positive'
        });
        return;
      }

      const compliance = await this.creditValidationService.checkRegulatoryCompliance(
        customerId,
        transactionAmount
      );
      
      res.status(200).json({
        success: true,
        data: compliance,
        message: compliance.compliant ? 'Regulatory compliance check passed' : 'Regulatory compliance issues found'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== CUSTOMER ELIGIBILITY ==========

  async checkCustomerEligibility(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const eligibility = await this.creditValidationService.isCustomerCreditEligible(customerId);
      
      res.status(200).json({
        success: true,
        data: eligibility,
        message: eligibility.eligible ? 'Customer is credit eligible' : 'Customer is not credit eligible'
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  async getEligibilityScore(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const score = await this.creditValidationService.calculateCreditEligibilityScore(customerId);
      
      res.status(200).json({
        success: true,
        data: {
          customerId,
          eligibilityScore: score,
          rating: this.getEligibilityRating(score)
        }
      });
    } catch (error: any) {
      this.handleError(error, res);
    }
  }

  // ========== UTILITY METHODS ==========

  private handleError(error: any, res: Response): void {
    console.error('Credit API error:', error);

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

  private getCreditRating(score: number): string {
    if (score >= 800) return 'EXCELLENT';
    if (score >= 740) return 'VERY GOOD';
    if (score >= 670) return 'GOOD';
    if (score >= 580) return 'FAIR';
    if (score >= 300) return 'POOR';
    return 'VERY POOR';
  }

  private getEligibilityRating(score: number): string {
    if (score >= 80) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    if (score >= 40) return 'LOW';
    return 'VERY LOW';
  }

  // ========== HEALTH CHECK ==========

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Credit Management API'
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

  // ========== BATCH PROCESSING ==========

  async batchCreditReview(req: Request, res: Response): Promise<void> {
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

  // ========== ANALYTICS AND DASHBOARD ==========

  async getCreditAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // This would typically aggregate data from multiple sources
      // For now, return a simplified analytics response
      const analytics = {
        timestamp: new Date().toISOString(),
        summary: {
          totalCustomersWithCredit: 0, // Would be calculated
          averageCreditLimit: 0,
          totalCreditExposure: 0,
          highRiskCustomers: 0,
          overdueAccounts: 0
        },
        trends: {
          creditApplications: {
            daily: 0,
            weekly: 0,
            monthly: 0
          },
          creditUtilization: {
            average: 0,
            trend: 'stable' // 'increasing', 'decreasing', 'stable'
          }
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
}