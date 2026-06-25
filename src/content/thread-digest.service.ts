import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

@Injectable()
export class ThreadDigestService {
  private readonly logger = new Logger(ThreadDigestService.name);
  private running = false;

  constructor(
    private readonly repo: BountyRepository,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.DIGEST_CRON ?? '0 30 */6 * * *')
  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous run still in progress, skipping');
      return;
    }
    this.running = true;
    try {
      const bounties = await this.repo.forThreadDigest(6);
      if (bounties.length < 4) {
        this.logger.log(`Only ${bounties.length} qualifying bounties found, skipping digest`);
        return;
      }

      const withUrls = bounties.map((b) => ({ ...b, url: normaliseUrl(b.url) }));
      let tweets = await this.writer.digestThread(withUrls);

      if (!tweets) {
        this.logger.warn('AI digest thread generation failed, using template fallback');
        tweets = this.fallbackThread(withUrls);
      }

      await this.tg.sendThread(tweets, 'DIGEST');
      this.logger.log(`Digest thread sent (${tweets.length} tweets, ${bounties.length} bounties)`);
    } finally {
      this.running = false;
    }
  }

  private fallbackThread(
    bounties: Array<{ title: string; host: string; rewardText: string; rewardUsd: number | null; url: string }>,
  ): string[] {
    const totalUsd = bounties.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);
    const handle = process.env.X_HANDLE ?? '@unnamedcodes';

    const tweets: string[] = [];

    const hook = totalUsd > 0
      ? `Here are ${bounties.length} open bounties worth $${totalUsd.toLocaleString()}+ that you can enter right now. 🧵`
      : `Here are ${bounties.length} open bounties you can enter right now. 🧵`;
    tweets.push(hook);

    for (const b of bounties) {
      const reward = b.rewardText || (b.rewardUsd ? `$${b.rewardUsd.toLocaleString()}` : '');
      let t = `${b.title}`;
      if (reward) t += ` — ${reward}`;
      if (b.host) t += `\n🏢 ${b.host}`;
      t += `\n\n${b.url}`;
      tweets.push(t.slice(0, 280));
    }

    tweets.push(`Which one are you entering? Reply below 👇\n\n♻️ RT to help a builder find their next opportunity.\n\nFollow ${handle} for daily bounty drops.`);

    return tweets;
  }
}
