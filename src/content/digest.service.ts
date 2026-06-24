import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BountyRepository } from '../persistence/bounty.repository';
import { ContentWriterService } from '../zen/content-writer.service';
import { normaliseUrl } from '../utils/normalise-url';

const TWEET_MAX = 280;

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private readonly handle: string;

  constructor(
    private readonly repo: BountyRepository,
    private readonly writer: ContentWriterService,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
  }

  /** Returns the daily Bounty Radar thread as tweets, or [] if nothing fresh. */
  async buildDrop(): Promise<string[]> {
    const bounties = await this.repo.forDrop(12);
    if (!bounties.length) return [];

    const totalUsd = bounties.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);

    // Hook — try AI, fall back to template
    const aiHook = await this.writer.dailyDropHook(bounties.length, totalUsd);
    const hook = aiHook ?? this.defaultHook(bounties.length, totalUsd);

    // Body — try AI batch generation, fall back to per-item template
    const aiBody = await this.writer.dailyDropBodyItems(
      bounties.map((b) => ({
        title: b.title,
        host: b.host,
        rewardText: b.rewardText,
        rewardUsd: b.rewardUsd,
        deadline: b.deadline,
        tags: b.tags,
        url: b.url,
      })),
    );

    const body = aiBody ?? this.defaultBody(bounties);

    // CTA — try AI, fall back to template
    const aiCTA = await this.writer.dailyDropCTA();
    const cta = aiCTA ?? this.defaultCTA();

    return [hook, ...body, cta];
  }

  private defaultHook(count: number, totalUsd: number): string {
    return (
      `🚨 ${totalUsd ? `$${totalUsd.toLocaleString()}+ in ` : ''}Solana & multi-chain bounties dropped today\n\n` +
      `From audit contests to dev bounties and web3 jobs — ${count} open opportunities 👇\n\n` +
      `Follow ${this.handle} + 🔔`
    );
  }

  private defaultBody(
    bounties: Array<{
      title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string; url: string;
    }>,
  ): string[] {
    return bounties.map((b, i) => {
      const parts: string[] = [];
      if (b.host) parts.push(`🏢 Host: ${b.host}`);
      if (b.rewardText) parts.push(`💰 Reward: ${b.rewardText}`);
      if (b.deadline) {
        parts.push(`⏳ Deadline: ${b.deadline.toISOString().slice(0, 10)}`);
      }
      const tagList = b.tags ? b.tags.split(',').filter(Boolean).join(', ') : '';
      if (tagList) parts.push(`🏷️ Tags: ${tagList}`);
      const details = parts.length ? `\n\n${parts.join('\n')}` : '';
      let line = `${i + 1}. ${b.title}${details}\n\n🔗 ${normaliseUrl(b.url)}`;
      if (line.length > TWEET_MAX) line = line.slice(0, TWEET_MAX - 1) + '…';
      return line;
    });
  }

  private defaultCTA(): string {
    return (
      `That's today's radar. ♻️ RT to put these on more screens.\n\n` +
      `New drop every day. Follow ${this.handle} + turn on notifications.`
    );
  }
}
