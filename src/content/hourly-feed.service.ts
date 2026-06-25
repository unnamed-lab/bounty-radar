import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { BountyFetcherService } from '../zen/bounty-fetcher.service';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

@Injectable()
export class HourlyFeedService {
  private readonly logger = new Logger(HourlyFeedService.name);
  private running = false;

  constructor(
    private readonly repo: BountyRepository,
    private readonly fetcher: BountyFetcherService,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.HOURLY_FEED_CRON ?? '0 0 * * * *')
  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous run still in progress, skipping');
      return;
    }
    this.running = true;
    try {
      const hour = new Date().getHours();
      const category = hour % 4; // 0=Top Pick, 1=Closing Soon, 2=Fresh Find, 3=Active Pick (3-14d)

      let result = await this.tryCategory(category);
      if (!result) {
        this.logger.log(`No bounty for category ${category}, falling back to Top Pick`);
        result = await this.tryCategory(0);
      }
      if (!result) {
        this.logger.log('No bounties available for any category, skipping');
        return;
      }

      const { header, tweet, poolResets } = result;

      const msg = poolResets
        ? `📝 ${header} — 1 tweet 👇\n\n${tweet}\n\n🔄 Pool cycled — all bounties are eligible again.`
        : `📝 ${header} — 1 tweet 👇\n\n${tweet}`;

      await this.tg.sendRaw(msg);
      this.logger.log(`${header} sent`);
    } finally {
      this.running = false;
    }
  }

  private async tryCategory(category: number): Promise<{
    header: string;
    tweet: string;
    poolResets: boolean;
    title: string;
  } | null> {
    switch (category) {
      case 0:
        return this.doTopPick();
      case 1:
        return this.doClosingSoon();
      case 2:
        return this.doFreshFind();
      case 3:
        return this.doActivePick();
      default:
        return null;
    }
  }

  private async doTopPick(): Promise<{
    header: string; tweet: string; poolResets: boolean; title: string;
  } | null> {
    const result = await this.repo.forTopPick();
    if (!result) return null;

    const { bounty, poolResets } = result;
    bounty.url = normaliseUrl(bounty.url);
    const pageContent = await this.fetcher.fetch(bounty.url);
    const ai = await this.writer.featuredBounty(bounty, pageContent);
    const tweet = ai ?? this.defaultTopPickTweet(bounty);

    await this.repo.logBountyPost(bounty.uid, 'hourly-top-pick');
    await this.repo.updateLastPostedAt(bounty.uid);
    return { header: 'TOP PICK DRAFT', tweet, poolResets, title: bounty.title };
  }

  private async doClosingSoon(): Promise<{
    header: string; tweet: string; poolResets: boolean; title: string;
  } | null> {
    const result = await this.repo.forClosingSoonFeed();
    if (!result) return null;

    const { bounty, poolResets } = result;
    bounty.url = normaliseUrl(bounty.url);
    const ai = await this.writer.closingSoon(bounty);
    const tweet = ai ?? this.defaultClosingSoonTweet(bounty);

    await this.repo.logBountyPost(bounty.uid, 'hourly-closing-soon');
    await this.repo.updateLastPostedAt(bounty.uid);
    return { header: 'CLOSING SOON DRAFT', tweet, poolResets, title: bounty.title };
  }

  private async doFreshFind(): Promise<{
    header: string; tweet: string; poolResets: boolean; title: string;
  } | null> {
    const result = await this.repo.forFreshFind();
    if (!result) return null;

    const { bounty, poolResets } = result;
    bounty.url = normaliseUrl(bounty.url);
    const ai = await this.writer.freshFind(bounty);
    const tweet = ai ?? this.defaultFreshFindTweet(bounty);

    await this.repo.logBountyPost(bounty.uid, 'hourly-fresh-find');
    await this.repo.updateLastPostedAt(bounty.uid);
    return { header: 'FRESH FIND DRAFT', tweet, poolResets, title: bounty.title };
  }

  private async doActivePick(): Promise<{
    header: string; tweet: string; poolResets: boolean; title: string;
  } | null> {
    const result = await this.repo.forActivePick();
    if (!result) return null;

    const { bounty, poolResets } = result;
    bounty.url = normaliseUrl(bounty.url);
    const pageContent = await this.fetcher.fetch(bounty.url);
    const ai = await this.writer.activePick(bounty, pageContent);
    const tweet = ai ?? this.defaultActivePickTweet(bounty);

    await this.repo.logBountyPost(bounty.uid, 'hourly-active-pick');
    await this.repo.updateLastPostedAt(bounty.uid);
    return { header: 'ACTIVE PICK DRAFT', tweet, poolResets, title: bounty.title };
  }

  private defaultTopPickTweet(b: {
    title: string; host: string; rewardText: string; rewardUsd: number | null;
    deadline: Date | null; tags: string; source: string; url: string;
  }): string {
    const reward = b.rewardText || (b.rewardUsd ? `$${b.rewardUsd.toLocaleString()}` : '');
    const deadline = b.deadline ? b.deadline.toISOString().slice(0, 10) : '';
    const tags = b.tags ? b.tags.split(',').filter(Boolean).slice(0, 3).join(', ') : '';
    const link = normaliseUrl(b.url);

    let tweet =
      `BOUNTY ALERT${reward ? `: ${reward}` : ''}\n\n` +
      `${b.title}\n\n` +
      `🏢 ${b.host || b.source}\n` +
      `${reward ? `💵 ${reward}\n` : ''}` +
      `${deadline ? `⏳ ${deadline}\n` : ''}` +
      `${tags ? `🏷️ ${tags}\n` : ''}\n` +
      `Details, submission requirements, and how to enter at the link below.\n\n` +
      `${link}\n\n` +
      `♻️ RT to help someone else catch this, and follow ${process.env.X_HANDLE ?? '@unnamedcodes'} for more bounties and hackathons every week.`;

    const maxLen = 4000;
    if (tweet.length > maxLen) tweet = tweet.slice(0, maxLen - 1) + '…';
    return tweet;
  }

  private defaultClosingSoonTweet(b: {
    title: string; rewardText: string; rewardUsd: number | null;
    deadline: Date | null; url: string;
  }): string {
    const daysLeft = b.deadline
      ? Math.ceil((b.deadline.getTime() - Date.now()) / 86_400_000)
      : null;
    let tweet = `⏰ CLOSING SOON: ${b.title}`;
    if (b.rewardText || b.rewardUsd) {
      tweet += ` — ${b.rewardText || `$${b.rewardUsd!.toLocaleString()}`}`;
    }
    if (daysLeft != null) tweet += `\n⏳ ${daysLeft}d left`;
    tweet += `\n\n🔗 ${normaliseUrl(b.url)}`;
    if (tweet.length > 280) tweet = tweet.slice(0, 279) + '…';
    return tweet;
  }

  private defaultFreshFindTweet(b: {
    title: string; host: string; rewardText: string; rewardUsd: number | null;
    deadline: Date | null; tags: string; url: string;
  }): string {
    const parts: string[] = [];
    if (b.host) parts.push(`🏢 ${b.host}`);
    if (b.rewardText || b.rewardUsd) {
      parts.push(`💰 ${b.rewardText || `$${b.rewardUsd!.toLocaleString()}`}`);
    }
    if (b.deadline) parts.push(`⏳ ${b.deadline.toISOString().slice(0, 10)}`);
    const tags = b.tags ? `🏷️ ${b.tags.split(',').filter(Boolean).slice(0, 3).join(', ')}` : '';
    if (tags) parts.push(tags);
    const details = parts.length ? `\n\n${parts.join('\n')}` : '';
    let tweet = `🆕 NEW BOUNTY: ${b.title}${details}\n\n🔗 ${normaliseUrl(b.url)}`;
    if (tweet.length > 280) tweet = tweet.slice(0, 279) + '…';
    return tweet;
  }

  private defaultActivePickTweet(b: {
    title: string; host: string; rewardText: string; rewardUsd: number | null;
    deadline: Date | null; tags: string; url: string;
  }): string {
    const parts: string[] = [];
    if (b.host) parts.push(`🏢 ${b.host}`);
    if (b.rewardText || b.rewardUsd) {
      parts.push(`💰 ${b.rewardText || `$${b.rewardUsd!.toLocaleString()}`}`);
    }
    if (b.deadline) parts.push(`⏳ ${b.deadline.toISOString().slice(0, 10)}`);
    const tags = b.tags ? `🏷️ ${b.tags.split(',').filter(Boolean).slice(0, 3).join(', ')}` : '';
    if (tags) parts.push(tags);
    const details = parts.length ? `\n\n${parts.join('\n')}` : '';
    let tweet = `✅ STILL ACTIVE: ${b.title}${details}\n\n🔗 ${normaliseUrl(b.url)}`;
    if (tweet.length > 280) tweet = tweet.slice(0, 279) + '…';
    return tweet;
  }
}
