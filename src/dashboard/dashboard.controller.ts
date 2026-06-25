import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../persistence/prisma.service';

const FEED_COLORS: Record<string, string> = {
  'hourly-top-pick': '#f59e0b',
  'hourly-closing-soon': '#ef4444',
  'hourly-fresh-find': '#22c55e',
  'hourly-active-pick': '#3b82f6',
  'daily-drop': '#8b5cf6',
  'job-drop': '#ec4899',
  'thread-digest': '#14b8a6',
};

const FEED_LABELS: Record<string, string> = {
  'hourly-top-pick': 'Top Pick',
  'hourly-closing-soon': 'Closing Soon',
  'hourly-fresh-find': 'Fresh Find',
  'hourly-active-pick': 'Active Pick',
  'daily-drop': 'Daily Drop',
  'job-drop': 'Job Drop',
  'thread-digest': 'Digest',
};

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

    const openBounties = await this.prisma.bounty.findMany({
      where: { status: 'open', rewardUsd: { not: null } },
      select: { rewardUsd: true },
    });
    const totalUsdOpen = openBounties.reduce((s, b) => s + (b.rewardUsd ?? 0), 0);

    const bySource = await this.prisma.bounty.groupBy({
      by: ['source'],
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
    });
    const maxSource = Math.max(...bySource.map((s) => s._count.source), 1);

    const byFeed = await this.prisma.bountyPost.groupBy({
      by: ['feed'],
      _count: { feed: true },
      orderBy: { _count: { feed: 'desc' } },
    });
    const maxFeed = Math.max(...byFeed.map((f) => f._count.feed), 1);

    const poolRemaining = await this.prisma.bounty.count({
      where: { status: 'open', includedInDrop: false, tags: { not: { contains: 'job' } } },
    });

    const stale = await this.prisma.bounty.count({
      where: { status: 'open', lastSeen: { lt: new Date(Date.now() - 30 * 86_400_000) } },
    });

    const recentPosts = await this.prisma.bountyPost.findMany({
      orderBy: { postedAt: 'desc' },
      take: 25,
    });
    const recentUids = [...new Set(recentPosts.map((p) => p.bountyUid))];
    const recentBounties = await this.prisma.bounty.findMany({
      where: { uid: { in: recentUids } },
    });
    const bountyMap = new Map(recentBounties.map((b) => [b.uid, b]));

    const trackDup = new Map<string, number>();
    recentPosts.forEach((p, i) => {
      const key = `${p.bountyUid}::${p.feed}`;
      trackDup.set(key, (trackDup.get(key) ?? 0) + 1);
    });

    const body = `
<div class="stats">
  <div class="card"><div class="num">${total}</div><div class="label">Total Bounties</div></div>
  <div class="card"><div class="num open">${open}</div><div class="label">Open</div></div>
  <div class="card"><div class="num closed">${closed}</div><div class="label">Closed</div></div>
  <div class="card"><div class="num">${poolRemaining}</div><div class="label">Pool Remaining</div></div>
  <div class="card"><div class="num stale">${stale}</div><div class="label">Stale (30d)</div></div>
  <div class="card"><div class="num accent">${Intl.NumberFormat().format(totalUsdOpen)}</div><div class="label">Open Value (USD)</div></div>
  <div class="card"><div class="num accent">${posts24h}</div><div class="label">Posts (24h)</div></div>
  <div class="card"><div class="num accent">${posts7d}</div><div class="label">Posts (7d)</div></div>
</div>

<div class="grid-2">
  <section>
    <h2>By Source</h2>
    <div class="bar-chart">
      ${bySource.map((s) => `
        <div class="bar-row">
          <span class="bar-label">${s.source}</span>
          <div class="bar-track"><div class="bar-fill source" style="width:${(s._count.source / maxSource * 100).toFixed(1)}%"></div></div>
          <span class="bar-count">${s._count.source}</span>
        </div>
      `).join('')}
    </div>
  </section>
  <section>
    <h2>Posts by Feed</h2>
    <div class="bar-chart">
      ${byFeed.map((f) => {
        const color = FEED_COLORS[f.feed] ?? '#64748b';
        return `
        <div class="bar-row">
          <span class="bar-label">${FEED_LABELS[f.feed] ?? f.feed}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(f._count.feed / maxFeed * 100).toFixed(1)}%;background:${color}"></div></div>
          <span class="bar-count">${f._count.feed}</span>
        </div>`;
      }).join('')}
    </div>
  </section>
</div>

<h2>Recent Posts (last 25)</h2>
<div class="table-wrap">
<table>
  <thead><tr><th>Time</th><th>Feed</th><th>Title</th><th>Source</th><th>Reward</th></tr></thead>
  <tbody>
  ${recentPosts.map((p) => {
    const b = bountyMap.get(p.bountyUid);
    const key = `${p.bountyUid}::${p.feed}`;
    const dup = (trackDup.get(key) ?? 0) > 1;
    const feedColor = FEED_COLORS[p.feed] ?? '#64748b';
    return `<tr class="${dup ? 'dup' : ''}">
      <td class="muted">${p.postedAt.toISOString().slice(0, 16)}${dup ? ' <span class="dup-badge">×2</span>' : ''}</td>
      <td><span class="badge" style="background:${feedColor}20;color:${feedColor};border:1px solid ${feedColor}40">${FEED_LABELS[p.feed] ?? p.feed}</span></td>
      <td>${b ? `<a href="${b.url}" target="_blank">${this.esc(b.title.slice(0, 60))}</a>` : `<span class="uid">${p.bountyUid.slice(0, 8)}</span>`}</td>
      <td>${b?.source ? `<span class="source-tag">${this.esc(b.source)}</span>` : '?'}</td>
      <td class="reward">${b?.rewardText ? this.esc(b.rewardText) : b?.rewardUsd ? '$' + Intl.NumberFormat().format(b.rewardUsd) : ''}</td>
    </tr>`;
  }).join('')}
  </tbody>
</table>
</div>
`;

    res.type('text/html; charset=utf-8').send(this.html(body));
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private html(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="60">
<title>Bounty Radar Dashboard</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:system-ui,-apple-system,sans-serif; background:#0b1120; color:#e2e8f0; padding:24px }
  h1 { font-size:1.5rem; font-weight:700; background:linear-gradient(135deg,#38bdf8,#8b5cf6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:4px }
  .subtitle { color:#64748b; font-size:0.85rem; margin-bottom:16px }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin:0 0 20px }
  .card { background:#131c31; border:1px solid #1e293b; border-radius:10px; padding:14px 16px; transition:border-color .15s }
  .card:hover { border-color:#334155 }
  .card .num { font-size:1.6rem; font-weight:700; color:#38bdf8; font-variant-numeric:tabular-nums }
  .card .num.open { color:#22c55e }
  .card .num.closed { color:#ef4444 }
  .card .num.stale { color:#f59e0b }
  .card .num.accent { color:#a78bfa }
  .card .label { color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:.04em; margin-top:2px }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px }
  @media (max-width:800px) { .grid-2 { grid-template-columns:1fr } }
  section { background:#131c31; border:1px solid #1e293b; border-radius:10px; padding:16px }
  section h2 { all:unset; display:block; color:#94a3b8; font-size:0.8rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:12px }
  .bar-chart { display:flex; flex-direction:column; gap:6px }
  .bar-row { display:flex; align-items:center; gap:8px }
  .bar-label { width:120px; font-size:0.8rem; color:#94a3b8; text-align:right; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
  .bar-track { flex:1; height:16px; background:#1e293b; border-radius:8px; overflow:hidden }
  .bar-fill { height:100%; border-radius:8px; background:#3b82f6; transition:width .3s; min-width:2px }
  .bar-fill.source { background:linear-gradient(90deg,#3b82f6,#8b5cf6) }
  .bar-count { width:40px; font-size:0.8rem; color:#e2e8f0; font-variant-numeric:tabular-nums; text-align:right }
  h2 { color:#94a3b8; font-size:0.8rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px }
  .table-wrap { background:#131c31; border:1px solid #1e293b; border-radius:10px; overflow:hidden }
  table { width:100%; border-collapse:collapse; font-size:0.85rem }
  thead { background:#0f172a }
  th { text-align:left; color:#64748b; font-weight:500; padding:10px 10px; border-bottom:1px solid #1e293b; font-size:0.75rem; text-transform:uppercase; letter-spacing:.04em }
  td { padding:8px 10px; border-bottom:1px solid #1e293b; vertical-align:middle }
  tr:last-child td { border-bottom:none }
  tr.dup { background:#f59e0b08 }
  tr.dup td { border-bottom-color:#f59e0b20 }
  a { color:#60a5fa; text-decoration:none }
  a:hover { text-decoration:underline }
  .badge { display:inline-block; border-radius:6px; padding:2px 8px; font-size:0.7rem; font-weight:600 }
  .source-tag { color:#94a3b8; font-size:0.8rem }
  .reward { color:#a78bfa; font-size:0.8rem; font-variant-numeric:tabular-nums }
  .muted { color:#64748b; font-size:0.8rem; white-space:nowrap }
  .uid { color:#475569; font-family:monospace; font-size:0.8rem }
  .dup-badge { display:inline-block; background:#f59e0b20; color:#f59e0b; border-radius:4px; padding:0 5px; font-size:0.7rem; font-weight:700; margin-left:4px }
  footer { margin-top:24px; text-align:center; color:#475569; font-size:0.75rem }
</style>
</head>
<body>
<h1>Bounty Radar</h1>
<div class="subtitle">bounty-radar &middot; auto-refresh 60s</div>
${body}
<footer>Last updated: ${new Date().toISOString()}</footer>
</body>
</html>`;
  }
}
