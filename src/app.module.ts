import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PersistenceModule } from './persistence/persistence.module';
import { TelegramModule } from './telegram/telegram.module';
import { SourcesModule } from './sources/sources.module';
import { ScoutModule } from './scout/scout.module';
import { ContentModule } from './content/content.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    PersistenceModule,
    TelegramModule,
    SourcesModule,
    ScoutModule,
    ContentModule,
    DashboardModule,
  ],
})
export class AppModule {}
