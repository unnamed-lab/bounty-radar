import './load-env';
import 'reflect-metadata';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = parseInt(process.env.DASHBOARD_PORT ?? '3456', 10);

function html(body: string): string {
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
  .nav { display: flex; gap: 16px; margin: 12px 0 20px; }
  .nav a { color: #94a3b8; }
  .nav a.active { color: #38bdf8; border-bottom: 2px solid #38bdf8; }
  .muted { color: #64748b; font-size: 0.85rem; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1e293b; color: #475569; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>🔭 Bounty Radar</h1>
${body}
<footer>Last updated: ${new Date().toISOString()}</footer>
</body>
</html>`;
}

async function handleDashboard(req: http.IncomingMessage, res: http.ServerResponse) {
  const parts = (req.url ?? '/').split('?')[0].replace(/\/$/, '') || '/';

  if (parts === '/api/posts.json') {
    const since = parseInt(String(req.url?.match(/since=(\d+)/)?.[1] ?? (Date.now() - 7 * 86_400_000).toString()), 10);
    const posts = await prisma.bountyPost.findMany({
      where: { postedAt: { gte: new Date(since) } },
      orderBy: { postedAt: 'desc' },
      take: 200,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(posts));
    return;
  }

  if (parts === '/api/bounties.json') {
    const bounties = await prisma.bounty.findMany({
      orderBy: { rewardUsd: 'desc' },
      take: 500,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(bounties));
    return;
  }

  if (parts === '/api/blacklist' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { uid } = JSON.parse(body);
    if (uid) {
      await prisma.bounty.update({ where: { uid }, data: { status: 'closed' } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(400);
    res.end('{"error":"uid required"}');
    return;
  }

  // Dashboard HTML
  const total = await prisma.bounty.count();
  const open = await prisma.bounty.count({ where: { status: 'open' } });
  const closed = total - open;

  const posts24h = await prisma.bountyPost.count({
    where: { postedAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  const posts7d = await prisma.bountyPost.count({
    where: { postedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
  });

  const bySource = await prisma.bounty.groupBy({
    by: ['source'],
    _count: { source: true },
    orderBy: { _count: { source: 'desc' } },
  });

  const byFeed = await prisma.bountyPost.groupBy({
    by: ['feed'],
    _count: { feed: true },
    orderBy: { _count: { feed: 'desc' } },
  });

  const poolRemaining = await prisma.bounty.count({
    where: { status: 'open', includedInDrop: false, tags: { not: { contains: 'job' } } },
  });

  const stale = await prisma.bounty.count({
    where: { status: 'open', lastSeen: { lt: new Date(Date.now() - 30 * 86_400_000) } },
  });

  const recentPosts = await prisma.bountyPost.findMany({
    orderBy: { postedAt: 'desc' },
    take: 20,
  });
  const recentUids = [...new Set(recentPosts.map((p) => p.bountyUid))];
  const recentBounties = await prisma.bounty.findMany({
    where: { uid: { in: recentUids } },
  });
  const bountyMap = new Map(recentBounties.map((b) => [b.uid, b]));

  const body = `
<div class="nav">
  <a href="/" class="active">Dashboard</a>
  <a href="/api/bounties.json">Bounties JSON</a>
  <a href="/api/posts.json">Posts JSON</a>
</div>

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

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html(body));
}

async function main() {
  await prisma.$connect();
  const server = http.createServer(handleDashboard);
  server.listen(PORT, () => {
    console.log(`🔭 Bounty Radar Dashboard → http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Dashboard failed:', err);
  process.exit(1);
});
