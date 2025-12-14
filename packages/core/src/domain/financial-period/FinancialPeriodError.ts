export class FinancialPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialPeriodError';
  }
}

export class InvalidFinancialPeriodTransitionError extends FinancialPeriodError {
  constructor(from: string, to: string) {
    super(`Invalid financial period transition: ${from} → ${to}`);
  }
}
