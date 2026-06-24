import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { ZenModule } from '../zen/zen.module';
import { DigestService } from './digest.service';
import { ClosingSoonService } from './closing-soon.service';
import { SpotlightService } from './spotlight.service';
import { StatsService } from './stats.service';
import { DropScheduler } from './drop.scheduler';
import { JobDropScheduler } from './job-drop.scheduler';
import { HourlyFeedService } from './hourly-feed.service';

@Module({
  imports: [TelegramModule, ZenModule],
  providers: [
    DigestService,
    ClosingSoonService,
    SpotlightService,
    StatsService,
    DropScheduler,
    JobDropScheduler,
    HourlyFeedService,
  ],
})
export class ContentModule {}
