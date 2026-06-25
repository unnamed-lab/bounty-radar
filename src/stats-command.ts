import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './persistence/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const total = await prisma.bounty.count();
  const open = await prisma.bounty.count({ where: { status: 'open' } });
  const bySource = await prisma.bounty.groupBy({
    by: ['source'],
    _count: { source: true },
    orderBy: { _count: { source: 'desc' } },
  });

  const posts24h = await prisma.bountyPost.count({
    where: { postedAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  const posts7d = await prisma.bountyPost.count({
    where: { postedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
  });

  const topPosts = await prisma.bountyPost.groupBy({
    by: ['bountyUid', 'feed'],
    _count: { bountyUid: true },
    _max: { postedAt: true },
    orderBy: { _count: { bountyUid: 'desc' } },
    take: 10,
  });

  console.log('═══════════════════════════════════════════');
  console.log('  Bounty Radar — Stats');
  console.log('═══════════════════════════════════════════');
  console.log(`  Total bounties: ${total}`);
  console.log(`  Open:           ${open}`);
  console.log(`  Closed:         ${total - open}`);
  console.log('');
  console.log('  Posts — last 24h:  ' + posts24h);
  console.log('  Posts — last 7d:   ' + posts7d);
  console.log('');
  console.log('  By source:');
  for (const s of bySource) {
    console.log(`    ${s.source.padEnd(20)} ${s._count.source}`);
  }
  console.log('');
  console.log('  Top posted bounties (all time):');
  for (const p of topPosts) {
    const bounty = await prisma.bounty.findUnique({ where: { uid: p.bountyUid } });
    const title = bounty?.title?.slice(0, 60) ?? p.bountyUid.slice(0, 8);
    console.log(`    ${String(p._count.bountyUid).padStart(3)}x  ${(p.feed).padEnd(20)} ${title}`);
  }
  console.log('═══════════════════════════════════════════');

  await app.close();
  process.exit(0);
}

main();
