import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BountyRepository } from '../persistence/bounty.repository';

const TWEET_MAX = 280;

@Injectable()
export class DigestService {
  private readonly handle: string;

  constructor(
    private readonly repo: BountyRepository,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
  }

  /** Returns the daily Bounty Radar thread as tweets, or [] if nothing fresh. */
  async buildDrop(): Promise<string[]> {
    const bounties = await this.repo.forDrop(12);
    if (!bounties.length) return [];

    const totalUsd = bounties.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);

    const hook =
      `🚨 ${totalUsd ? `$${totalUsd.toLocaleString()}+ in ` : ''}Solana & multi-chain bounties dropped today\n\n` +
      `From audit contests to dev bounties and web3 jobs — ${bounties.length} open opportunities 👇\n\n` +
      `Follow ${this.handle} + 🔔`;

    const body = bounties.map((b, i) => {
      const parts: string[] = [];
      if ((b as any).host) parts.push(`🏢 Host: ${(b as any).host}`);
      if (b.rewardText) parts.push(`💰 Reward: ${b.rewardText}`);
      if (b.deadline) {
        parts.push(`⏳ Deadline: ${b.deadline.toISOString().slice(0, 10)}`);
      }
      const tagList = b.tags ? b.tags.split(',').filter(Boolean).join(', ') : '';
      if (tagList) parts.push(`🏷️ Tags: ${tagList}`);

      const details = parts.length ? `\n\n${parts.join('\n')}` : '';
      
      let line = `${i + 1}. ${b.title}${details}\n\n🔗 ${b.url}`;
      if (line.length > TWEET_MAX) line = line.slice(0, TWEET_MAX - 1) + '…';
      return line;
    });

    const cta =
      `That's today's radar. ♻️ RT to put these on more builders' screens.\n\n` +
      `New drop every day. Follow ${this.handle} + turn on notifications.`;

    return [hook, ...body, cta];
  }
}
