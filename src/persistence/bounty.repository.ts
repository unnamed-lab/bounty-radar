import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Bounty, bountyUid } from '../domain/bounty';
import { parseRewardUsd } from '../domain/reward';

@Injectable()
export class BountyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist a never-seen bounty; returns true if it was new. */
  async upsertIfNew(b: Bounty, prices?: Record<string, number>): Promise<boolean> {
    if (!b.reward) return false;
    if (b.deadline) {
      const age = Date.now() - new Date(b.deadline).getTime();
      if (age > 90 * 86_400_000) return false; // deadline more than 3 months ago
    }
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

  /** Randomised drop from eligible bounties, capped per source. */
  async forDrop(limit = 12) {
    const now = new Date();
    const maxAgeDays = parseInt(process.env.BOUNTY_MAX_AGE_DAYS ?? '180', 10);
    const minFirstSeen = new Date(now.getTime() - maxAgeDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        deadline: { gte: now },
        firstSeen: { gte: minFirstSeen },
        tags: { not: { contains: 'job' } },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
          lte: parseFloat(process.env.BOUNTY_MAX_USD ?? '200000'),
        },
      },
      orderBy: [{ rewardUsd: 'desc' }, { deadline: 'asc' }],
      take: limit * 6,
    });

    // Fisher-Yates shuffle so every drop is a different mix
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const PER_SOURCE = 2;
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

  /** Randomised job drop, capped per source. */
  async forDropJobs(limit = 8) {
    const now = new Date();
    const maxAgeDays = parseInt(process.env.BOUNTY_MAX_AGE_DAYS ?? '180', 10);
    const minFirstSeen = new Date(now.getTime() - maxAgeDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        tags: { contains: 'job' },
        deadline: { gte: now },
        firstSeen: { gte: minFirstSeen },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
          lte: parseFloat(process.env.BOUNTY_MAX_USD ?? '200000'),
        },
      },
      orderBy: [{ rewardUsd: 'desc' }, { deadline: 'asc' }],
      take: limit * 6,
    });

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const PER_SOURCE = 2;
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

  /** Pick one un-featured bounty (top 3 by reward, random). Marks it as featured. */
  async forFeaturedDrop(): Promise<{
    bounty: {
      uid: string;
      title: string;
      host: string;
      rewardText: string;
      rewardUsd: number | null;
      deadline: Date | null;
      tags: string;
      source: string;
      url: string;
    };
    poolResets: boolean;
  } | null> {
    const now = new Date();
    const maxAgeDays = parseInt(process.env.BOUNTY_MAX_AGE_DAYS ?? '180', 10);
    const minFirstSeen = new Date(now.getTime() - maxAgeDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now },
        firstSeen: { gte: minFirstSeen },
        tags: { not: { contains: 'job' } },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
          lte: parseFloat(process.env.BOUNTY_MAX_USD ?? '200000'),
        },
      },
      orderBy: [{ rewardUsd: 'desc' }, { firstSeen: 'desc' }],
      take: 3,
    });

    if (!candidates.length) return null;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    await this.prisma.bounty.update({
      where: { uid: chosen.uid },
      data: { includedInDrop: true },
    });

    // Reset pool if too few un-featured bounties remain
    const remaining = await this.prisma.bounty.count({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now },
        firstSeen: { gte: minFirstSeen },
        tags: { not: { contains: 'job' } },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
          lte: parseFloat(process.env.BOUNTY_MAX_USD ?? '200000'),
        },
      },
    });

    let poolResets = false;
    if (remaining < 5) {
      await this.prisma.bounty.updateMany({
        where: { includedInDrop: true },
        data: { includedInDrop: false },
      });
      poolResets = true;
      // Re-mark the one we just picked so it stays featured
      await this.prisma.bounty.update({
        where: { uid: chosen.uid },
        data: { includedInDrop: true },
      });
    }

    return { bounty: chosen, poolResets };
  }

  markAlerted(uids: string[]) {
    return this.prisma.bounty.updateMany({
      where: { uid: { in: uids } },
      data: { alertedClosingSoon: true },
    });
  }
}
