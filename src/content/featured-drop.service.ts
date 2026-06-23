import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BountyRepository } from '../persistence/bounty.repository';
import { TelegramService } from '../telegram/telegram.service';

const TWEET_MAX = 280;

@Injectable()
export class FeaturedDropService {
  private readonly logger = new Logger(FeaturedDropService.name);
  private readonly handle: string;
  private running = false;

  constructor(
    private readonly repo: BountyRepository,
    private readonly tg: TelegramService,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
  }

  @Cron(process.env.FEATURED_DROP_CRON ?? '0 0 */2 * * *')
  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous run still in progress, skipping');
      return;
    }
    this.running = true;
    try {
      const result = await this.repo.forFeaturedDrop();
      if (!result) {
        this.logger.log('No eligible bounties for featured drop');
        return;
      }

      const { bounty, poolResets } = result;
      const tweet = this.buildTweet(bounty);

      const messages: string[] = [
        `📝 FEATURED BOUNTY DRAFT — 1 tweet 👇\n\n${tweet}`,
      ];
      if (poolResets) {
        messages.push(
          '🔄 Pool cycled — all bounties are eligible again for the featured feed.',
        );
      }

      await this.tg.sendRaw(messages.join('\n\n'));
      this.logger.log(`featured drop drafted: ${bounty.title}`);
    } finally {
      this.running = false;
    }
  }

  private buildTweet(bounty: {
    title: string;
    host: string;
    rewardText: string;
    rewardUsd: number | null;
    deadline: Date | null;
    tags: string;
    source: string;
    url: string;
  }): string {
    const daysLeft =
      bounty.deadline != null
        ? Math.ceil(
            (bounty.deadline.getTime() - Date.now()) / 86_400_000,
          )
        : null;

    const reward =
      bounty.rewardText ||
      (bounty.rewardUsd ? `$${bounty.rewardUsd.toLocaleString()}` : '');

    // Choose hook emoji based on context
    let hook: string;
    const isAudit =
      bounty.source === 'sherlock' || bounty.source === 'code4rena';
    const isUrgent = daysLeft != null && daysLeft <= 7 && daysLeft > 0;

    if (isUrgent) {
      hook = `⏰ CLOSING SOON`;
    } else if (isAudit) {
      hook = `🔍 AUDIT LIVE`;
    } else {
      hook = `💰 BOUNTY`;
    }

    const parts: string[] = [];
    if (bounty.host) parts.push(`🏢 ${bounty.host}`);
    if (reward) parts.push(`💵 ${reward}`);
    if (daysLeft != null && daysLeft > 0) {
      parts.push(`⏳ ${daysLeft}d left`);
    } else if (bounty.deadline) {
      parts.push(`⏳ ${bounty.deadline.toISOString().slice(0, 10)}`);
    }

    const hashtags = this.buildHashtags(bounty.tags, bounty.source);
    if (hashtags.length) parts.push(`🏷️ ${hashtags.join(' ')}`);

    const details = parts.length ? `\n\n${parts.join('\n')}` : '';

    let tweet = `${hook}: ${bounty.title}${details}\n\n🔗 ${bounty.url}`;
    if (tweet.length > TWEET_MAX) tweet = tweet.slice(0, TWEET_MAX - 1) + '…';
    return tweet;
  }

  private buildHashtags(tags: string, source: string): string[] {
    const set = new Set<string>();
    const sourceClean = source.replace(/[^a-zA-Z0-9]/g, '');
    if (sourceClean) set.add(`#${sourceClean}`);

    if (tags) {
      for (const tag of tags.split(',').filter(Boolean)) {
        const clean = tag.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (clean && set.size < 3) set.add(`#${clean}`);
        if (set.size >= 3) break;
      }
    }

    if (set.size < 2) set.add('#Web3');
    if (set.size < 3) set.add('#Bounty');

    return Array.from(set);
  }
}
