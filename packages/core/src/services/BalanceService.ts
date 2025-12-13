// packages/core/src/services/BalanceService.ts

import {
  CustomerBalance,
  BalanceAgeAnalysis,
  BalanceTransaction,
  BalanceTransactionType,
  BalanceSnapshot,
  BalanceReconciliation,
  ReconciliationDiscrepancy,
  BalanceAlertConfig,
  BalanceAlertType
} from '../domain/CustomerBalance';

import { Customer } from '../domain/Customer';
import { CreditLimit } from '../domain/CreditLimit';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

/* =====================================================
   REPOSITORY CONTRACTS
   ===================================================== */
interface ICustomerBalanceRepository {
  findByCustomerId(customerId: string): Promise<CustomerBalance | null>;
  update(id: string, data: Partial<CustomerBalance>): Promise<CustomerBalance>;

  createTransaction(
    data: Omit<BalanceTransaction, 'id'>
  ): Promise<BalanceTransaction>;

  findTransactionById(id: string): Promise<BalanceTransaction | null>;
  updateTransaction(id: string, data: Partial<BalanceTransaction>): Promise<void>;
  getTransactions(customerId: string): Promise<BalanceTransaction[]>;

  createSnapshot(data: Omit<BalanceSnapshot, 'id'>): Promise<BalanceSnapshot>;
  getSnapshots(customerId: string): Promise<BalanceSnapshot[]>;

  createReconciliation(
    data: Omit<BalanceReconciliation, 'id'>
  ): Promise<BalanceReconciliation>;

  saveAlertConfig(config: BalanceAlertConfig): Promise<void>;
}

interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
}

interface ICreditLimitRepository {
  findActiveByCustomerId(customerId: string): Promise<CreditLimit | null>;
  update(id: string, data: Partial<CreditLimit>): Promise<void>;
}

/* =====================================================
   BALANCE SERVICE
   ===================================================== */
export class BalanceService {
  constructor(
    private readonly balanceRepo: ICustomerBalanceRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly creditRepo: ICreditLimitRepository
  ) {}

  /* =====================================================
     CORE ACCESS
     ===================================================== */
  async getCustomerBalance(customerId: string): Promise<CustomerBalance> {
    const balance = await this.balanceRepo.findByCustomerId(customerId);
    if (!balance) {
      throw NotFoundError.factory('CustomerBalance', customerId);
    }
    return balance;
  }

  /* =====================================================
     LEDGER POSTING (ONLY MUTATION PATH)
     ===================================================== */
  async createBalanceTransaction(
    tx: Omit<BalanceTransaction, 'id'>
  ): Promise<BalanceTransaction> {
    const customer = await this.customerRepo.findById(tx.customerId);
    if (!customer) {
      throw NotFoundError.factory('Customer', tx.customerId);
    }

    const balance = await this.getCustomerBalance(tx.customerId);

    const newBalance =
      tx.type === BalanceTransactionType.DEBIT
        ? balance.currentBalance + tx.amount
        : balance.currentBalance - tx.amount;

    const creditLimit = await this.creditRepo.findActiveByCustomerId(tx.customerId);
    if (creditLimit && newBalance > creditLimit.amount) {
      throw new BusinessRuleError('Credit limit exceeded');
    }

    const createdTx = await this.balanceRepo.createTransaction({
      ...tx,
      balanceId: balance.id,
      balanceBefore: balance.currentBalance,
      balanceAfter: newBalance,
      createdAt: new Date(),
      version: 1
    });

    await this.balanceRepo.update(balance.id, {
      currentBalance: newBalance,
      availableBalance: creditLimit ? creditLimit.amount - newBalance : 0,
      lastUpdated: new Date(),
      updatedBy: tx.createdBy,
      version: balance.version + 1
    });

    if (creditLimit) {
      await this.creditRepo.update(creditLimit.id, {
        currentUtilization: (newBalance / creditLimit.amount) * 100,
        availableCredit: creditLimit.amount - newBalance,
        updatedAt: new Date(),
        updatedBy: tx.createdBy
      });
    }

    return createdTx;
  }

  /* =====================================================
     AGING
     ===================================================== */
  async calculateAging(customerId: string): Promise<BalanceAgeAnalysis> {
    const transactions = await this.balanceRepo.getTransactions(customerId);
    const now = new Date();

    const aging: BalanceAgeAnalysis = {
      current: 0,
      days31_60: 0,
      days61_90: 0,
      days91_180: 0,
      over180: 0,
      total: 0
    };

    for (const tx of transactions) {
      if (tx.type !== BalanceTransactionType.DEBIT || tx.status !== 'POSTED') continue;

      const ageDays =
        Math.floor((now.getTime() - tx.transactionDate.getTime()) / 86400000);

      if (ageDays <= 30) aging.current += tx.amount;
      else if (ageDays <= 60) aging.days31_60 += tx.amount;
      else if (ageDays <= 90) aging.days61_90 += tx.amount;
      else if (ageDays <= 180) aging.days91_180 += tx.amount;
      else aging.over180 += tx.amount;

      aging.total += tx.amount;
    }

    const balance = await this.getCustomerBalance(customerId);
    await this.balanceRepo.update(balance.id, {
      ageAnalysis: aging,
      lastUpdated: new Date(),
      updatedBy: 'system',
      version: balance.version + 1
    });

    return aging;
  }

  /* =====================================================
     SNAPSHOT
     ===================================================== */
  async createSnapshot(
    customerId: string,
    createdBy: string
  ): Promise<BalanceSnapshot> {
    const balance = await this.getCustomerBalance(customerId);
    const aging = await this.calculateAging(customerId);

    return this.balanceRepo.createSnapshot({
      customerId,
      snapshotDate: new Date(),
      balance: balance.currentBalance,
      creditLimit: balance.creditLimit,
      availableCredit: balance.availableBalance,
      ageAnalysis: aging,
      isOverdue: balance.overdueAmount > 0,
      isOverLimit: balance.isOverLimit,
      createdBy,
      createdAt: new Date()
    });
  }

  /* =====================================================
     RECONCILIATION
     ===================================================== */
  async reconcile(
    customerId: string,
    reconciledBy: string
  ): Promise<BalanceReconciliation> {
    const balance = await this.getCustomerBalance(customerId);
    const transactions = await this.balanceRepo.getTransactions(customerId);

    let calculated = 0;
    for (const tx of transactions) {
      if (tx.status !== 'POSTED') continue;
      calculated += tx.type === BalanceTransactionType.DEBIT ? tx.amount : -tx.amount;
    }

    const diff = calculated - balance.currentBalance;

    const discrepancies: ReconciliationDiscrepancy[] =
      diff !== 0
        ? [{
            transactionType: 'BALANCE',
            expectedAmount: calculated,
            actualAmount: balance.currentBalance,
            difference: diff,
            description: 'Ledger mismatch',
            resolved: false
          }]
        : [];

    return this.balanceRepo.createReconciliation({
      customerId,
      reconciliationDate: new Date(),
      startingBalance: balance.currentBalance,
      endingBalance: calculated,
      calculatedBalance: calculated,
      difference: diff,
      transactionCount: transactions.length,
      transactionTotal: calculated,
      status: diff === 0 ? 'COMPLETED' : 'DISCREPANCY',
      discrepancies: discrepancies.length ? discrepancies : undefined,
      reconciledBy,
      reconciledAt: new Date()
    });
  }

  /* =====================================================
     ALERTS
     ===================================================== */
  async checkAlerts(customerId: string): Promise<BalanceAlertType[]> {
    const balance = await this.getCustomerBalance(customerId);
    const alerts: BalanceAlertType[] = [];

    if (balance.overdueAmount > 0) {
      alerts.push(BalanceAlertType.OVERDUE_BALANCE);
    }
    if (balance.isOverLimit) {
      alerts.push(BalanceAlertType.CREDIT_LIMIT_EXCEEDED);
    }

    return alerts;
  }

  async configureAlerts(config: BalanceAlertConfig): Promise<void> {
    await this.balanceRepo.saveAlertConfig(config);
  }
}
