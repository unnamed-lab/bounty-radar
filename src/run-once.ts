import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ScoutService } from './scout/scout.service';

// One-shot: run a single scan and exit. For k8s CronJob / external schedulers.
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.get(ScoutService).run();
  await app.close();
  process.exit(0);
}

main();
