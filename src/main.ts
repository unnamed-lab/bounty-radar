import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  // Process stays alive on the scheduler's timers; cron jobs fire internally.
  new Logger('BountyRadar').log('Bounty Radar is live — schedules armed.');
}

bootstrap();
