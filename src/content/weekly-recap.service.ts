import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

@Injectable()
export class WeeklyRecapService {
  private readonly logger = new Logger(WeeklyRecapService.name);

  constructor(
    private readonly repo: BountyRepository,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.WEEKLY_RECAP_CRON ?? '0 0 18 * * 0')
  async run(): Promise<void> {
    const data = await this.repo.weeklyRecap(7);
    if (!data.totalCount) {
      this.logger.log('No bounties this week, skipping recap');
      return;
    }

    const ai = await this.writer.weeklyRecap({
      ...data,
      topBounties: data.topBounties.map((b) => ({
        ...b,
        url: normaliseUrl(b.url),
      })),
    });

    if (ai && ai.length >= 2) {
      await this.tg.sendThread(ai, 'WEEKLY RECAP');
    } else {
      await this.tg.sendThread(this.fallback(data), 'WEEKLY RECAP');
    }

    this.logger.log(`weekly recap sent — ${data.totalCount} bounties, $${Math.round(data.totalUsd).toLocaleString()}`);
  }

  private fallback(data: {
    totalCount: number;
    totalUsd: number;
    topBounties: Array<{ title: string; host: string; rewardText: string; rewardUsd: number | null; url: string }>;
    topSources: Array<{ source: string; count: number }>;
    categoryBreakdown: Array<{ category: string; count: number }>;
  }): string[] {
    const totalUsd = Math.round(data.totalUsd).toLocaleString();
    const handle = process.env.X_HANDLE ?? '@unnamedcodes';

    const top3 = data.topBounties
      .map((b, i) => {
        const r = b.rewardText || (b.rewardUsd ? `$${b.rewardUsd.toLocaleString()}` : '');
        return `${i + 1}. ${b.title} — ${b.host}${r ? ` (${r})` : ''}\n${normaliseUrl(b.url)}`;
      })
      .join('\n\n');

    const sources = data.topSources.map((s) => `${s.source} (${s.count})`).join(', ');
    const cats = data.categoryBreakdown.map((c) => `${c.category} (${c.count})`).join(', ');

    return [
      `📊 Weekly Bounty Radar — ${data.totalCount} new bounties worth ~$${totalUsd}\n\n` +
      `Here is what happened in web3 bounties this week 👇`,

      `🏆 Top 3 this week\n\n${top3}\n\n${sources ? `📡 Top sources: ${sources}` : ''}${cats ? `\n📂 Categories: ${cats}` : ''}`,

      `That is the week in review. New bounties drop daily — follow ${handle} + 🔔 to never miss one.\n\n` +
      `♻️ RT if you found something useful.`,
    ];
  }
}
