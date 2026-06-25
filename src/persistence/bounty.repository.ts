import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Bounty, bountyUid } from '../domain/bounty';
import { parseRewardUsd } from '../domain/reward';

@Injectable()
export class BountyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist a never-seen bounty; returns true if it was new. Refreshes lastSeen for existing ones. */
  async upsertIfNew(b: Bounty, prices?: Record<string, number>): Promise<boolean> {
    if (!b.reward) return false;
    if (b.deadline) {
      const age = Date.now() - new Date(b.deadline).getTime();
      if (age > 90 * 86_400_000) return false; // deadline more than 3 months ago
    }
    const uid = bountyUid(b);
    const exists = await this.prisma.bounty.findUnique({ where: { uid } });
    if (exists) {
      // Source still returns this bounty — refresh lastSeen and mutable fields
      const updateData: Record<string, unknown> = { lastSeen: new Date() };
      if (b.deadline) updateData.deadline = new Date(b.deadline);
      if (b.reward) {
        updateData.rewardText = b.reward;
        updateData.rewardUsd = parseRewardUsd(b.reward, prices);
      }
      await this.prisma.bounty.update({ where: { uid }, data: updateData as any });
      return false;
    }
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

  /** Randomised drop from eligible bounties, capped per source. Excludes previously featured and recently posted. */
  async forDrop(limit = 12) {
    const now = new Date();
    const maxAgeDays = parseInt(process.env.BOUNTY_MAX_AGE_DAYS ?? '180', 10);
    const cooldownDays = parseInt(process.env.BOUNTY_COOLDOWN_DAYS ?? '7', 10);
    const minFirstSeen = new Date(now.getTime() - maxAgeDays * 86_400_000);
    const cooldownDate = new Date(now.getTime() - cooldownDays * 86_400_000);

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
        OR: [
          { lastPostedAt: null },
          { lastPostedAt: { lt: cooldownDate } },
        ],
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

  /** Randomised job drop, capped per source. Excludes recently posted. */
  async forDropJobs(limit = 8) {
    const now = new Date();
    const maxAgeDays = parseInt(process.env.BOUNTY_MAX_AGE_DAYS ?? '180', 10);
    const cooldownDays = parseInt(process.env.BOUNTY_COOLDOWN_DAYS ?? '7', 10);
    const minFirstSeen = new Date(now.getTime() - maxAgeDays * 86_400_000);
    const cooldownDate = new Date(now.getTime() - cooldownDays * 86_400_000);

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
        OR: [
          { lastPostedAt: null },
          { lastPostedAt: { lt: cooldownDate } },
        ],
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

  /** Pick one high-value un-featured bounty (lastSeen < 30d, top 3, random). */
  async forTopPick(): Promise<{
    bounty: {
      uid: string; title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string;
      source: string; url: string;
    };
    poolResets: boolean;
  } | null> {
    const now = new Date();
    const cooldownDays = parseInt(process.env.BOUNTY_COOLDOWN_DAYS ?? '7', 10);
    const minLastSeen = new Date(now.getTime() - 30 * 86_400_000);
    const cooldownDate = new Date(now.getTime() - cooldownDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now },
        lastSeen: { gte: minLastSeen },
        tags: { not: { contains: 'job' } },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
        },
        OR: [
          { lastPostedAt: null },
          { lastPostedAt: { lt: cooldownDate } },
        ],
      },
      orderBy: [{ rewardUsd: 'desc' }, { lastSeen: 'desc' }],
      take: 3,
    });

    return this.pickAndMark(candidates);
  }

  /** Pick one un-featured bounty closing within 72h (lastSeen < 60d). */
  async forClosingSoonFeed(): Promise<{
    bounty: {
      uid: string; title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string;
      source: string; url: string;
    };
    poolResets: boolean;
  } | null> {
    const now = new Date();
    const cooldownDays = parseInt(process.env.BOUNTY_COOLDOWN_DAYS ?? '7', 10);
    const minLastSeen = new Date(now.getTime() - 60 * 86_400_000);
    const until = new Date(now.getTime() + 72 * 3_600_000);
    const cooldownDate = new Date(now.getTime() - cooldownDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now, lte: until },
        lastSeen: { gte: minLastSeen },
        tags: { not: { contains: 'job' } },
        OR: [
          { lastPostedAt: null },
          { lastPostedAt: { lt: cooldownDate } },
        ],
      },
      orderBy: { deadline: 'asc' },
      take: 3,
    });

    return this.pickAndMark(candidates);
  }

  /** Pick one un-featured bounty last seen between 3 and 14 days ago (active sweet spot). */
  async forActivePick(): Promise<{
    bounty: {
      uid: string; title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string;
      source: string; url: string;
    };
    poolResets: boolean;
  } | null> {
    const now = new Date();
    const cooldownDays = parseInt(process.env.BOUNTY_COOLDOWN_DAYS ?? '7', 10);
    const minLastSeen = new Date(now.getTime() - 14 * 86_400_000);
    const maxLastSeen = new Date(now.getTime() - 3 * 86_400_000);
    const cooldownDate = new Date(now.getTime() - cooldownDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now },
        lastSeen: { gte: minLastSeen, lte: maxLastSeen },
        tags: { not: { contains: 'job' } },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
        },
        OR: [
          { lastPostedAt: null },
          { lastPostedAt: { lt: cooldownDate } },
        ],
      },
      orderBy: [{ rewardUsd: 'desc' }, { lastSeen: 'desc' }],
      take: 3,
    });

    return this.pickAndMark(candidates);
  }

  /** Pick one un-featured bounty last seen within 48h. */
  async forFreshFind(): Promise<{
    bounty: {
      uid: string; title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string;
      source: string; url: string;
    };
    poolResets: boolean;
  } | null> {
    const now = new Date();
    const cooldownDays = parseInt(process.env.BOUNTY_COOLDOWN_DAYS ?? '7', 10);
    const minLastSeen = new Date(now.getTime() - 48 * 3_600_000);
    const cooldownDate = new Date(now.getTime() - cooldownDays * 86_400_000);

    const candidates = await this.prisma.bounty.findMany({
      where: {
        status: 'open',
        includedInDrop: false,
        deadline: { gte: now },
        lastSeen: { gte: minLastSeen },
        tags: { not: { contains: 'job' } },
        rewardUsd: {
          gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200'),
        },
        OR: [
          { lastPostedAt: null },
          { lastPostedAt: { lt: cooldownDate } },
        ],
      },
      orderBy: [{ rewardUsd: 'desc' }, { lastSeen: 'desc' }],
      take: 3,
    });

    return this.pickAndMark(candidates);
  }

  /** Mark a random candidate as featured. Reset pool if < 5 eligible remain. */
  private async pickAndMark(
    candidates: Array<{
      uid: string; title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string;
      source: string; url: string; firstSeen: Date; status: string;
      alertedClosingSoon: boolean; includedInDrop: boolean;
    }>,
  ): Promise<{
    bounty: {
      uid: string; title: string; host: string; rewardText: string;
      rewardUsd: number | null; deadline: Date | null; tags: string;
      source: string; url: string;
    };
    poolResets: boolean;
  } | null> {
    if (!candidates.length) return null;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    await this.prisma.bounty.update({
      where: { uid: chosen.uid },
      data: { includedInDrop: true },
    });

    const now = new Date();
    const eligibleWhere = {
      status: 'open',
      includedInDrop: false,
      deadline: { gte: now },
      tags: { not: { contains: 'job' } },
      rewardUsd: { gte: parseFloat(process.env.BOUNTY_MIN_USD ?? '200') },
    };

    const remaining = await this.prisma.bounty.count({
      where: eligibleWhere,
    });

    let poolResets = false;
    if (remaining < 5) {
      // Only reset bounties the source has confirmed recently to avoid recycling stale content
      const poolResetCutoff = new Date(Date.now() - 30 * 86_400_000);
      await this.prisma.bounty.updateMany({
        where: {
          includedInDrop: true,
          lastSeen: { gte: poolResetCutoff },
        },
        data: { includedInDrop: false },
      });
      poolResets = true;
      await this.prisma.bounty.update({
        where: { uid: chosen.uid },
        data: { includedInDrop: true },
      });
    }

    return { bounty: chosen, poolResets };
  }

  /** Log that a bounty was posted to a feed. */
  async logBountyPost(bountyUid: string, feed: string): Promise<void> {
    await this.prisma.bountyPost.create({
      data: { bountyUid, feed },
    });
  }

  /** Count how many times a bounty was posted across all feeds since an optional date. */
  async getBountyPostCount(bountyUid: string, since?: Date): Promise<number> {
    return this.prisma.bountyPost.count({
      where: {
        bountyUid,
        ...(since ? { postedAt: { gte: since } } : {}),
      },
    });
  }

  /** Get most-posted bounties across all feeds, ordered by post count. */
  async getPostStats(limit = 20, since?: Date): Promise<Array<{ bountyUid: string; count: number; lastPosted: Date }>> {
    const where = since ? { postedAt: { gte: since } } : {};
    const rows = await this.prisma.bountyPost.groupBy({
      by: ['bountyUid'],
      where,
      _count: { bountyUid: true },
      _max: { postedAt: true },
      orderBy: { _count: { bountyUid: 'desc' } },
      take: limit,
    });

    return rows.map((r) => ({
      bountyUid: r.bountyUid,
      count: r._count.bountyUid,
      lastPosted: r._max.postedAt!,
    }));
  }

  /** Get posts for a given feed in the last N hours. */
  async getRecentPosts(feed: string, hours = 24): Promise<Array<{ bountyUid: string; postedAt: Date }>> {
    const since = new Date(Date.now() - hours * 3_600_000);
    return this.prisma.bountyPost.findMany({
      where: { feed, postedAt: { gte: since } },
      orderBy: { postedAt: 'desc' },
    });
  }

  markAlerted(uids: string[]) {
    return this.prisma.bounty.updateMany({
      where: { uid: { in: uids } },
      data: { alertedClosingSoon: true },
    });
  }

  /** Mark bounties as featured in a daily/job drop so they skip future rotations until pool reset. */
  async markDropFeatured(uids: string[]): Promise<void> {
    await this.prisma.bounty.updateMany({
      where: { uid: { in: uids } },
      data: { includedInDrop: true },
    });
  }

  /** Record when a bounty was last posted to enforce cooldown. */
  async updateLastPostedAt(uid: string): Promise<void> {
    await this.prisma.bounty.update({
      where: { uid },
      data: { lastPostedAt: new Date() },
    });
  }

  /** Summary of bounties first seen in the last N days, for weekly recap. */
  async weeklyRecap(days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const now = new Date();

    const bounties = await this.prisma.bounty.findMany({
      where: {
        firstSeen: { gte: since },
        status: 'open',
        deadline: { gte: now },
        tags: { not: { contains: 'job' } },
      },
      orderBy: { rewardUsd: 'desc' },
    });

    const totalCount = bounties.length;
    const totalUsd = bounties.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);

    const topBounties = bounties
      .filter((b) => b.rewardUsd != null)
      .slice(0, 3)
      .map((b) => ({
        title: b.title,
        host: b.host,
        rewardText: b.rewardText,
        rewardUsd: b.rewardUsd,
        url: b.url,
      }));

    const sourceCount = new Map<string, number>();
    for (const b of bounties) {
      sourceCount.set(b.source, (sourceCount.get(b.source) ?? 0) + 1);
    }
    const topSources = [...sourceCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));

    const catCount = new Map<string, number>();
    for (const b of bounties) {
      const cats = b.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      for (const c of cats) {
        catCount.set(c, (catCount.get(c) ?? 0) + 1);
      }
    }
    const categoryBreakdown = [...catCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count }));

    return { totalCount, totalUsd, topBounties, topSources, categoryBreakdown };
  }
}
