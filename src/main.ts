import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  try {
    const tg = app.get(TelegramService);
    await tg.sendRaw(
      '✅ *bounty-radar* deployed successfully — schedules armed.',
    );
  } catch {
    // non-critical; don't crash startup
  }

  new Logger('BountyRadar').log('Bounty Radar is live — schedules armed.');
}

bootstrap();
