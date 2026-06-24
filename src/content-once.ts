import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClosingSoonService } from './content/closing-soon.service';
import { DropScheduler } from './content/drop.scheduler';
import { SpotlightService } from './content/spotlight.service';
import { StatsService } from './content/stats.service';
import { JobDropScheduler } from './content/job-drop.scheduler';
import { HourlyFeedService } from './content/hourly-feed.service';
import { WeeklyRecapService } from './content/weekly-recap.service';
import { EngagementService } from './content/engagement.service';
import { TipsService } from './content/tips.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  console.log('→ Daily bounty drop...');
  await app.get(DropScheduler).dailyDrop();

  console.log('→ Job drop...');
  await app.get(JobDropScheduler).jobDrop();

  console.log('→ Closing soon...');
  await app.get(ClosingSoonService).run();

  console.log('→ Spotlight...');
  await app.get(SpotlightService).run();

  console.log('→ Monthly stats...');
  await app.get(StatsService).run();

  console.log('→ Hourly feed...');
  await app.get(HourlyFeedService).run();

  console.log('→ Weekly recap...');
  await app.get(WeeklyRecapService).run();

  console.log('→ Engagement post...');
  await app.get(EngagementService).run();

  console.log('→ Tips thread...');
  await app.get(TipsService).run();

  console.log('✓ all content sent');
  await app.close();
  process.exit(0);
}

main();
