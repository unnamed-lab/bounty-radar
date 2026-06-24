import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

const TWEET_MAX = 280;

@Injectable()
export class JobDropScheduler {
  private readonly logger = new Logger(JobDropScheduler.name);

  constructor(
    private readonly repo: BountyRepository,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.JOB_DROP_CRON ?? '0 0 15 * * *')
  async jobDrop(): Promise<void> {
    const jobs = await this.repo.forDropJobs(6);
    if (!jobs.length) {
      this.logger.log("No fresh jobs for today's job drop, skipping");
      return;
    }

    const handle = process.env.X_HANDLE ?? '@unnamedcodes';

    const tweets: string[] = [];

    // Hook — try AI, fall back to template
    const aiHook = await this.writer.dailyDropHook(jobs.length, 0);
    if (aiHook) {
      tweets.push(aiHook);
    } else {
      const totalUsd = jobs.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);
      tweets.push(
        `💼 ${totalUsd ? `$${totalUsd.toLocaleString()}+ in ` : ''}web3 jobs open now\n\n` +
        `${jobs.length} open roles — dev, ops, BD, and more 👇\n\n` +
        `Follow ${handle} + 🔔`,
      );
    }

    for (const b of jobs) {
      const parts: string[] = [];
      if (b.host) parts.push(`🏢 ${b.host}`);
      if (b.rewardText) parts.push(`💰 ${b.rewardText}`);
      if (b.deadline) {
        parts.push(`⏳ ${b.deadline.toISOString().slice(0, 10)}`);
      }
      const tagList = b.tags
        ? b.tags.split(',').filter((t) => t !== 'job').join(', ')
        : '';
      if (tagList) parts.push(`🏷️ ${tagList}`);
      const details = parts.length ? `\n\n${parts.join('\n')}` : '';
      let line = `${b.title}${details}\n\n🔗 ${normaliseUrl(b.url)}`;
      if (line.length > TWEET_MAX) line = line.slice(0, TWEET_MAX - 1) + '…';
      tweets.push(line);
    }

    // CTA — try AI, fall back to template
    const aiCTA = await this.writer.dailyDropCTA();
    if (aiCTA) {
      tweets.push(aiCTA);
    } else {
      tweets.push(
        `That's today's job board. ♻️ RT to help someone land their next role.\n\n` +
        `New jobs every day. Follow ${handle} + turn on notifications.`,
      );
    }

    await this.tg.sendThread(tweets, 'JOB DROP');
    for (const b of jobs) {
      await this.repo.logBountyPost(b.uid, 'job-drop').catch(() => {});
    }
    this.logger.log(`job drop drafted — ${tweets.length} tweets`);
  }
}
