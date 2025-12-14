// packages/server/src/api/LedgerPostingController.ts

import { Request, Response } from 'express';

import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';
import { LedgerEntry } from '@bms/core/src/domain/ledger/LedgerEntry';
import { LedgerSide } from '@bms/core/src/domain/ledger/LedgerSide';

import { LedgerPostingCommandService } from './LedgerPostingCommandService';
import { validateCreateLedgerPostingDTO } from './validators/ledgerPosting.validator';
import { CreateLedgerPostingDTO } from './dto/CreateLedgerPostingDTO';

export class LedgerPostingController {
  constructor(
    private readonly commandService: LedgerPostingCommandService
  ) {
    if (!commandService) {
      throw new Error(
        'LedgerPostingController requires LedgerPostingCommandService'
      );
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    validateCreateLedgerPostingDTO(req.body);

    const dto: CreateLedgerPostingDTO = req.body;

    const entries = dto.entries.map(
      (e) =>
        new LedgerEntry({
          accountId: e.accountId,
          side:
            e.side === 'DEBIT'
              ? LedgerSide.DEBIT
              : LedgerSide.CREDIT,
          amount: e.amount,
          currency: e.currency,
          periodStart: new Date(e.periodStart),
          periodEnd: new Date(e.periodEnd),
        })
    );

    const posting = new LedgerPosting({
      id: dto.postingId,
      occurredAt: new Date(dto.occurredAt),
      entries,
    });

    await this.commandService.append(posting);

    res.status(201).json({
      status: 'accepted',
      postingId: posting.id,
    });
  }
}
