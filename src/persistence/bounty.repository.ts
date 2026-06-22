import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Bounty, bountyUid } from '../domain/bounty';
import { parseRewardUsd } from '../domain/reward';

@Injectable()
export class BountyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist a never-seen bounty; returns true if it was new. */
  async upsertIfNew(b: Bounty, prices?: Record<string, number>): Promise<boolean> {
    const uid = bountyUid(b);
    const exists = await this.prisma.bounty.findUnique({ where: { uid } });
    if (exists) return false;
    await this.prisma.bounty.create({
      data: {
        uid,
        source: b.source,
        title: b.title,
        url: b.url,
        rewardText: b.reward ?? '',
        rewardUsd: parseRewardUsd(b.reward ?? '', prices),
        deadline: b.deadline ? new Date(b.deadline) : null,
        tags: (b.tags ?? []).join(','),
        host: b.host ?? '',
      },
    });
    return true;
  }

  /** Open bounties with a deadline inside the window, not yet alerted. */
  closingSoon(hours: number) {
    const now = new Date();
    const until = new Date(now.getTime() + hours * 3_600_000);
    return this.prisma.bounty.findMany({
      where: {
        status: 'open',
        alertedClosingSoon: false,
        deadline: { gte: now, lte: until },
      },
      orderBy: { deadline: 'asc' },
    });
  }

  /** Best open bounties for the next drop (richest first), excluding expired and stale. */
  async forDrop(limit = 8) {
    const now = new Date();
    const maxAgeDays = parseInt(process.env.BOUNTY_MAX_AGE_DAYS ?? '180', 10);
    const minFirstSeen = new Date(now.getTime() - maxAgeDays * 86_400_000);
    const PER_SOURCE = 3;

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now },
        firstSeen: { gte: minFirstSeen },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '20000'),
          lte: parseFloat(process.env.BOUNTY_MAX_USD ?? '150000'),
        },
      },
      orderBy: [{ rewardUsd: 'desc' }, { deadline: 'asc' }],
      take: limit * 6,
    });

    const counts = new Map<string, number>();
    const result: typeof candidates = [];
    for (const b of candidates) {
      const n = counts.get(b.source) ?? 0;
      if (n < PER_SOURCE) {
        result.push(b);
        counts.set(b.source, n + 1);
      }
      if (result.length >= limit) break;
    }
    return result;
  }

  markAlerted(uids: string[]) {
    return this.prisma.bounty.updateMany({
      where: { uid: { in: uids } },
      data: { alertedClosingSoon: true },
    });
  }

  markInDrop(uids: string[]) {
    return this.prisma.bounty.updateMany({
      where: { uid: { in: uids } },
      data: { includedInDrop: true },
    });
  }
}
