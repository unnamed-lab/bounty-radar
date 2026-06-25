import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class BotCommandsService {
  private readonly logger = new Logger(BotCommandsService.name);
  private offset = 0;

  constructor(
    private readonly tg: TelegramService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/10 * * * * *')
  async poll(): Promise<void> {
    const updates = await this.tg.getUpdates(this.offset);
    for (const u of updates) {
      const id = u.update_id;
      if (id >= this.offset) this.offset = id + 1;

      const msg = u.message;
      if (!msg?.text) continue;

      const text = msg.text.trim();
      if (!text.startsWith('/')) continue;

      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      const chatId = msg.chat.id;

      try {
        await this.handle(chatId, cmd, args);
      } catch (err: any) {
        this.logger.error(`Command ${cmd} failed: ${err.message}`);
        await this.tg.sendTo(chatId, `Error: ${err.message}`);
      }
    }
  }

  private async handle(chatId: number, cmd: string, args: string[]): Promise<void> {
    switch (cmd) {
      case '/help':
        return this.help(chatId);
      case '/stats':
        return this.stats(chatId);
      case '/bounties':
        return this.bounties(chatId, args);
      case '/recent':
        return this.recent(chatId, args);
      case '/sources':
        return this.sources(chatId);
      case '/feeds':
        return this.feeds(chatId);
      default:
        await this.tg.sendTo(chatId, `Unknown command. Try /help`);
    }
  }

  private async help(chatId: number): Promise<void> {
    await this.tg.sendTo(chatId, [
      '🤖 *Bounty Radar Commands*',
      '',
      '`/help` — this message',
      '`/stats` — summary stats',
      '`/bounties [N]` — top N bounties by reward (default 5)',
      '`/recent [N]` — last N posts (default 5)',
      '`/sources` — source breakdown',
      '`/feeds` — feed breakdown',
    ].join('\n'));
  }

  private async stats(chatId: number): Promise<void> {
    const total = await this.prisma.bounty.count();
    const open = await this.prisma.bounty.count({ where: { status: 'open' } });
    const closed = total - open;

    const posts24h = await this.prisma.bountyPost.count({
      where: { postedAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    const posts7d = await this.prisma.bountyPost.count({
      where: { postedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    });

    const poolRemaining = await this.prisma.bounty.count({
      where: { status: 'open', includedInDrop: false, tags: { not: { contains: 'job' } } },
    });

    const stale = await this.prisma.bounty.count({
      where: { status: 'open', lastSeen: { lt: new Date(Date.now() - 30 * 86_400_000) } },
    });

    const openWithUsd = await this.prisma.bounty.findMany({
      where: { status: 'open', rewardUsd: { not: null } },
      select: { rewardUsd: true },
    });
    const totalUsd = openWithUsd.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);

    await this.tg.sendTo(chatId, [
      '📊 *Bounty Radar Stats*',
      '',
      `Total: ${total} (${open} open, ${closed} closed)`,
      `Pool remaining: ${poolRemaining}`,
      `Open value: $${Intl.NumberFormat().format(totalUsd)}`,
      `Posts: ${posts24h} (24h) / ${posts7d} (7d)`,
      `Stale (30d unseen): ${stale}`,
    ].join('\n'));
  }

  private async bounties(chatId: number, args: string[]): Promise<void> {
    const n = Math.min(Math.max(parseInt(args[0], 10) || 5, 1), 10);

    const bounties = await this.prisma.bounty.findMany({
      where: { status: 'open', rewardUsd: { not: null } },
      orderBy: { rewardUsd: 'desc' },
      take: n,
    });

    if (!bounties.length) {
      await this.tg.sendTo(chatId, 'No bounties found.');
      return;
    }

    const lines = bounties.map((b, i) => {
      const reward = b.rewardUsd ? `$${Intl.NumberFormat().format(b.rewardUsd)}` : b.rewardText || '?';
      return `${i + 1}. ${b.title.slice(0, 50)} — ${reward}\n   ${b.host || b.source} | ${b.url}`;
    });

    await this.tg.sendTo(chatId, `🏆 *Top ${bounties.length} Bounties*\n\n${lines.join('\n\n')}`);
  }

  private async recent(chatId: number, args: string[]): Promise<void> {
    const n = Math.min(Math.max(parseInt(args[0], 10) || 5, 1), 10);

    const posts = await this.prisma.bountyPost.findMany({
      orderBy: { postedAt: 'desc' },
      take: n,
    });
    if (!posts.length) {
      await this.tg.sendTo(chatId, 'No posts yet.');
      return;
    }

    const uids = [...new Set(posts.map((p) => p.bountyUid))];
    const bounties = await this.prisma.bounty.findMany({
      where: { uid: { in: uids } },
    });
    const map = new Map(bounties.map((b) => [b.uid, b]));

    const lines = posts.map((p) => {
      const b = map.get(p.bountyUid);
      const title = b ? b.title.slice(0, 50) : p.bountyUid.slice(0, 8);
      const reward = b?.rewardUsd ? `$${Intl.NumberFormat().format(b.rewardUsd)}` : b?.rewardText || '';
      return `[${p.feed}] ${title}\n   ${p.postedAt.toISOString().slice(0, 16)}${reward ? ` | ${reward}` : ''}`;
    });

    await this.tg.sendTo(chatId, `📰 *Recent Posts*\n\n${lines.join('\n\n')}`);
  }

  private async sources(chatId: number): Promise<void> {
    const bySource = await this.prisma.bounty.groupBy({
      by: ['source'],
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
    });

    const total = bySource.reduce((s, r) => s + r._count.source, 0);
    const lines = bySource.map((r) => {
      const pct = ((r._count.source / total) * 100).toFixed(1);
      return `${r.source}: ${r._count.source} (${pct}%)`;
    });

    await this.tg.sendTo(chatId, `📂 *Sources* (${total} total)\n\n${lines.join('\n')}`);
  }

  private async feeds(chatId: number): Promise<void> {
    const byFeed = await this.prisma.bountyPost.groupBy({
      by: ['feed'],
      _count: { feed: true },
      orderBy: { _count: { feed: 'desc' } },
    });

    const total = byFeed.reduce((s, r) => s + r._count.feed, 0);
    const lines = byFeed.map((r) => `${r.feed}: ${r._count.feed}`);

    await this.tg.sendTo(chatId, `📤 *Posts by Feed* (${total} total)\n\n${lines.join('\n')}`);
  }
}
