import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../persistence/prisma.service';

@Controller()
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/api/bounties.json')
  async bountiesJson() {
    const bounties = await this.prisma.bounty.findMany({
      orderBy: { rewardUsd: 'desc' },
      take: 500,
    });
    return bounties;
  }

  @Get('/api/posts.json')
  async postsJson(@Req() req: Request) {
    const since = parseInt(String(req.query.since ?? String(Date.now() - 7 * 86_400_000)), 10);
    return this.prisma.bountyPost.findMany({
      where: { postedAt: { gte: new Date(since) } },
      orderBy: { postedAt: 'desc' },
      take: 200,
    });
  }

  @Post('/api/blacklist')
  async blacklist(@Req() req: Request, @Res() res: Response) {
    const { uid } = req.body ?? {};
    if (!uid) return res.status(400).json({ error: 'uid required' });
    await this.prisma.bounty.update({ where: { uid }, data: { status: 'closed' } });
    return res.json({ ok: true });
  }

  @Get('/')
  async dashboard(@Res() res: Response) {
    const total = await this.prisma.bounty.count();
    const open = await this.prisma.bounty.count({ where: { status: 'open' } });
    const closed = total - open;

    const posts24h = await this.prisma.bountyPost.count({
      where: { postedAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    const posts7d = await this.prisma.bountyPost.count({
      where: { postedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    });

    const bySource = await this.prisma.bounty.groupBy({
      by: ['source'],
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
    });

    const byFeed = await this.prisma.bountyPost.groupBy({
      by: ['feed'],
      _count: { feed: true },
      orderBy: { _count: { feed: 'desc' } },
    });

    const poolRemaining = await this.prisma.bounty.count({
      where: { status: 'open', includedInDrop: false, tags: { not: { contains: 'job' } } },
    });

    const stale = await this.prisma.bounty.count({
      where: { status: 'open', lastSeen: { lt: new Date(Date.now() - 30 * 86_400_000) } },
    });

    const recentPosts = await this.prisma.bountyPost.findMany({
      orderBy: { postedAt: 'desc' },
      take: 20,
    });
    const recentUids = [...new Set(recentPosts.map((p) => p.bountyUid))];
    const recentBounties = await this.prisma.bounty.findMany({
      where: { uid: { in: recentUids } },
    });
    const bountyMap = new Map(recentBounties.map((b) => [b.uid, b]));

    const body = `
<div class="stats">
  <div class="card"><div class="num">${total}</div><div class="label">Total Bounties</div></div>
  <div class="card"><div class="num">${open}</div><div class="label">Open</div></div>
  <div class="card"><div class="num">${closed}</div><div class="label">Closed</div></div>
  <div class="card"><div class="num">${poolRemaining}</div><div class="label">Pool Remaining</div></div>
  <div class="card"><div class="num">${stale}</div><div class="label">Stale (30d unseen)</div></div>
  <div class="card"><div class="num">${posts24h}</div><div class="label">Posts (24h)</div></div>
  <div class="card"><div class="num">${posts7d}</div><div class="label">Posts (7d)</div></div>
</div>

<h2>By Source</h2>
<table>
  <tr><th>Source</th><th>Count</th></tr>
  ${bySource.map((s) => `<tr><td>${s.source}</td><td>${s._count.source}</td></tr>`).join('')}
</table>

<h2>Posts by Feed</h2>
<table>
  <tr><th>Feed</th><th>Count</th></tr>
  ${byFeed.map((f) => `<tr><td>${f.feed}</td><td>${f._count.feed}</td></tr>`).join('')}
</table>

<h2>Recent Posts (last 20)</h2>
<table>
  <tr><th>Time</th><th>Feed</th><th>Title</th><th>Source</th><th>Reward</th></tr>
  ${recentPosts.map((p) => {
    const b = bountyMap.get(p.bountyUid);
    return `<tr>
      <td class="muted">${p.postedAt.toISOString().slice(0, 16)}</td>
      <td><span class="badge">${p.feed}</span></td>
      <td>${b ? `<a href="${b.url}" target="_blank">${b.title.slice(0, 60)}</a>` : p.bountyUid.slice(0, 8)}</td>
      <td>${b?.source ?? '?'}</td>
      <td>${b?.rewardText ?? ''}</td>
    </tr>`;
  }).join('')}
</table>
`;

    res.type('text/html; charset=utf-8').send(this.html(body));
  }

  private html(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bounty Radar Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
  h1 { color: #38bdf8; margin-bottom: 8px; }
  h2 { color: #94a3b8; font-size: 1.1rem; margin: 24px 0 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 16px 0; }
  .card { background: #1e293b; border-radius: 8px; padding: 16px; }
  .card .num { font-size: 2rem; font-weight: 700; color: #38bdf8; }
  .card .label { color: #64748b; font-size: 0.85rem; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; color: #64748b; padding: 8px 4px; border-bottom: 1px solid #334155; }
  td { padding: 6px 4px; border-bottom: 1px solid #1e293b; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .badge { display: inline-block; background: #334155; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; color: #94a3b8; }
  .muted { color: #64748b; font-size: 0.85rem; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1e293b; color: #475569; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Bounty Radar</h1>
${body}
<footer>Last updated: ${new Date().toISOString()}</footer>
</body>
</html>`;
  }
}
