import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class StatsService {
  private readonly handle: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tg: TelegramService,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
  }

  @Cron(process.env.STATS_CRON ?? '0 0 9 1 * *')
  async run(): Promise<void> {
    const since = new Date();
    since.setMonth(since.getMonth() - 1);

    const payouts = await this.prisma.payout.findMany({
      where: { closedAt: { gte: since } },
    });
    if (!payouts.length) return;

    const total = payouts.reduce((s, p) => s + (p.amountUsd ?? 0), 0);
    const bySource = new Map<string, number>();
    for (const p of payouts) {
      bySource.set(p.source, (bySource.get(p.source) ?? 0) + 1);
    }
    const top = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];

    const tweets: string[] = [];

    // Hook
    tweets.push(
      `📊 Solana & web3 paid out ~$${Math.round(total).toLocaleString()} in bounties last month\n\n` +
      `Here's the breakdown of who's paying builders the most 👇`,
    );

    // Body
    tweets.push(
      `💸 ~$${Math.round(total).toLocaleString()} paid out\n` +
      `📦 ${payouts.length} bounties closed\n` +
      (top ? `🏆 Most active: ${top[0]} (${top[1]})\n` : '') +
      `\nI track these daily so you don't have to. Follow ${this.handle}.`,
    );

    await this.tg.sendThread(tweets, 'MONTHLY STATS');
  }
}
