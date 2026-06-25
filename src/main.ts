import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';

const PORT = parseInt(process.env.DASHBOARD_PORT ?? '3456', 10);
const HOST = process.env.DASHBOARD_HOST ?? '0.0.0.0';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  await app.listen(PORT, HOST);
  new Logger('BountyRadar').log(`Dashboard → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);

  try {
    const tg = app.get(TelegramService);
    await tg.sendRaw(
      '✅ *bounty-radar* deployed successfully — schedules armed.',
    );
  } catch {
    // non-critical; don't crash startup
  }
}

bootstrap();
