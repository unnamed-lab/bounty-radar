import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { DigestService } from './digest.service';
import { ClosingSoonService } from './closing-soon.service';
import { SpotlightService } from './spotlight.service';
import { StatsService } from './stats.service';
import { DropScheduler } from './drop.scheduler';
import { JobDropScheduler } from './job-drop.scheduler';
import { FeaturedDropService } from './featured-drop.service';

@Module({
  imports: [TelegramModule],
  providers: [
    DigestService,
    ClosingSoonService,
    SpotlightService,
    StatsService,
    DropScheduler,
    JobDropScheduler,
    FeaturedDropService,
  ],
})
export class ContentModule {}
