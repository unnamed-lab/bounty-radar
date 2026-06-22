import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClosingSoonService } from './content/closing-soon.service';
import { DropScheduler } from './content/drop.scheduler';
import { SpotlightService } from './content/spotlight.service';
import { StatsService } from './content/stats.service';
import { JobDropScheduler } from './content/job-drop.scheduler';

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

  console.log('✓ all content sent');
  await app.close();
  process.exit(0);
}

main();
