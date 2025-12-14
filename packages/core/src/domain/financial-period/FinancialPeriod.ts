import { FinancialPeriodState } from './FinancialPeriodState';
import {
  FinancialPeriodError,
  InvalidFinancialPeriodTransitionError,
} from './FinancialPeriodError';

/**
 * FinancialPeriod is a DOMAIN AGGREGATE.
 *
 * It defines GOVERNANCE over time, not storage or behavior enforcement.
 * All transitions are explicit and immutable.
 */
export class FinancialPeriod {
  public readonly id: string;
  public readonly periodStart: Date;
  public readonly periodEnd: Date;
  public readonly state: FinancialPeriodState;

  private constructor(params: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    state: FinancialPeriodState;
  }) {
    if (params.periodStart >= params.periodEnd) {
      throw new FinancialPeriodError(
        'Financial period start must be before period end'
      );
    }

    this.id = params.id;
    this.periodStart = params.periodStart;
    this.periodEnd = params.periodEnd;
    this.state = params.state;
  }

  /**
   * Factory: create a new OPEN financial period
   */
  static open(params: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
  }): FinancialPeriod {
    return new FinancialPeriod({
      ...params,
      state: FinancialPeriodState.OPEN,
    });
  }

  /**
   * Transition: OPEN → CLOSING
   */
  closeForProcessing(): FinancialPeriod {
    if (this.state !== FinancialPeriodState.OPEN) {
      throw new InvalidFinancialPeriodTransitionError(
        this.state,
        FinancialPeriodState.CLOSING
      );
    }

    return new FinancialPeriod({
      id: this.id,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      state: FinancialPeriodState.CLOSING,
    });
  }

  /**
   * Transition: CLOSING → CLOSED
   */
  finalize(): FinancialPeriod {
    if (this.state !== FinancialPeriodState.CLOSING) {
      throw new InvalidFinancialPeriodTransitionError(
        this.state,
        FinancialPeriodState.CLOSED
      );
    }

    return new FinancialPeriod({
      id: this.id,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      state: FinancialPeriodState.CLOSED,
    });
  }
}
