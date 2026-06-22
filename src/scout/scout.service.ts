import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BOUNTY_SOURCES,
  BountySource,
} from '../sources/bounty-source.interface';
import {
  PAYOUT_SOURCES,
  PayoutSource,
} from '../sources/payout-source.interface';
import { BountyRepository } from '../persistence/bounty.repository';
import { PrismaService } from '../persistence/prisma.service';
import { parseRewardUsd } from '../domain/reward';

@Injectable()
export class ScoutService {
  private readonly logger = new Logger(ScoutService.name);
  private running = false;

  constructor(
    @Inject(BOUNTY_SOURCES) private readonly sources: BountySource[],
    @Inject(PAYOUT_SOURCES) private readonly payoutSources: PayoutSource[],
    private readonly repo: BountyRepository,
    private readonly prisma: PrismaService,
  ) {}

  // Scan keeps the DB fresh; the curated drop posts from it. Guards re-entrancy.
  @Cron(process.env.SCAN_CRON ?? '0 0 */6 * * *')
  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous scan still running, skipping');
      return;
    }
    this.running = true;
    try {
      await this.scanBounties();
      await this.scanPayouts();
    } finally {
      this.running = false;
    }
  }

  private async scanBounties(): Promise<void> {
    const results = await Promise.allSettled(this.sources.map((s) => s.fetch()));
    let newCount = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        this.logger.error(`[${this.sources[i].name}] fetch failed`, r.reason);
        continue;
      }
      for (const b of r.value) {
        if (!b.url || !b.title) continue;
        try {
          if (await this.repo.upsertIfNew(b)) newCount++;
        } catch (err) {
          this.logger.error(`persist failed: ${b.url}`, err as Error);
        }
      }
    }
    this.logger.log(`bounty scan — ${newCount} new persisted`);
  }

  private async scanPayouts(): Promise<void> {
    const results = await Promise.allSettled(
      this.payoutSources.map((s) => s.fetchPayouts()),
    );
    let newCount = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        this.logger.error(
          `[${this.payoutSources[i].name}] payouts failed`,
          r.reason,
        );
        continue;
      }
      for (const p of r.value) {
        if (!p.url || !p.title) continue;
        try {
          await this.prisma.payout.create({
            data: {
              source: p.source,
              title: p.title,
              url: p.url,
              winner: p.winner ?? '',
              amountText: p.amountText ?? '',
              amountUsd: parseRewardUsd(p.amountText ?? ''),
              closedAt: p.closedAt ? new Date(p.closedAt) : new Date(),
            },
          });
          newCount++;
        } catch {
          // unique([url, winner]) violation = already stored; ignore
        }
      }
    }
    this.logger.log(`payout scan — ${newCount} new persisted`);
  }
}
