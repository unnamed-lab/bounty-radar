import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HourlyFeedService } from './content/hourly-feed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('→ Hourly feed...');
  await app.get(HourlyFeedService).run();
  console.log('✓ done');
  await app.close();
  process.exit(0);
}

main();
