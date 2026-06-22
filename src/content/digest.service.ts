import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BountyRepository } from '../persistence/bounty.repository';

const TWEET_MAX = 280;

@Injectable()
export class DigestService {
  private readonly handle: string;
  private readonly channel: string;

  constructor(
    private readonly repo: BountyRepository,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
    this.channel = cfg.get<string>('TG_CHANNEL') ?? '';
  }

  /** Returns the daily Bounty Radar thread as tweets, or [] if nothing fresh. */
  async buildDrop(): Promise<string[]> {
    const bounties = await this.repo.forDrop(8);
    if (!bounties.length) return [];

    const date = new Date().toISOString().slice(0, 10);
    const totalUsd = bounties.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);

    const hook =
      `📡 Bounty Radar — ${date}\n\n` +
      `${bounties.length} fresh web3 bounties across chains` +
      (totalUsd ? `, $${totalUsd.toLocaleString()}+ on the table 👇` : ' 👇') +
      `\n\nFollow ${this.handle} + 🔔 so you never miss a drop.`;

    const body = bounties.map((b, i) => {
      const reward = b.rewardText ? `\n💰 ${b.rewardText}` : '';
      const due = b.deadline
        ? `\n⏳ ${b.deadline.toISOString().slice(0, 10)}`
        : '';
      let line = `${i + 1}. ${b.title}${reward}${due}\n🔗 ${b.url}`;
      if (line.length > TWEET_MAX) line = line.slice(0, TWEET_MAX - 1) + '…';
      return line;
    });

    const cta =
      `That's today's radar. ♻️ RT to put these on more builders' screens.\n\n` +
      (this.channel ? `⚡ Real-time alerts: ${this.channel}\n` : '') +
      `New drop every day. Follow ${this.handle} + turn on notifications.`;

    await this.repo.markInDrop(bounties.map((b) => b.uid));
    return [hook, ...body, cta];
  }
}
