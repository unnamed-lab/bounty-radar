import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

@Injectable()
export class ClosingSoonService {
  private readonly logger = new Logger(ClosingSoonService.name);

  constructor(
    private readonly repo: BountyRepository,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.CLOSING_SOON_CRON ?? '0 0 */6 * * *')
  async run(): Promise<void> {
    const soon = await this.repo.closingSoon(72);
    if (!soon.length) return;

    const handle = process.env.X_HANDLE ?? '@unnamedcodes';

    const tweets: string[] = [];

    // Hook
    tweets.push(
      `⏳ ${soon.length > 1 ? `${soon.length} bounties close` : 'A bounty closes'} in the next 72h\n\n` +
      `Solana audit contests, bug bounties, and more — don't let them expire 👇\n\n` +
      `Follow ${handle} + 🔔`,
    );

    // Body — one tweet per bounty, try AI
    for (const b of soon.slice(0, 5)) {
      const url = normaliseUrl(b.url);
      const ai = await this.writer.closingSoon({
        title: b.title,
        host: b.host,
        rewardText: b.rewardText,
        rewardUsd: b.rewardUsd,
        deadline: b.deadline,
        source: 'bounty',
        url,
      });
      if (ai) {
        tweets.push(ai);
      } else {
        let line = `⏳ ${b.title}`;
        if (b.rewardText) line += ` — ${b.rewardText}`;
        if (b.deadline) {
          line += `\n⏰ Deadline: ${b.deadline.toISOString().slice(0, 10)}`;
        }
        line += `\n\n🔗 ${url}`;
        if (line.length > 280) line = line.slice(0, 279) + '…';
        tweets.push(line);
      }
    }

    // CTA
    tweets.push(
      `Don't miss the next batch. Follow ${handle} + 🔔 for daily drops.`,
    );

    await this.tg.sendThread(tweets, 'CLOSING SOON');
    await this.repo.markAlerted(soon.map((b) => b.uid));
    this.logger.log(`alerted ${soon.length} closing-soon bounties`);
  }
}
