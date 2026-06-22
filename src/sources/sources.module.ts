import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScraperModule } from '../scraper/scraper.module';
import { BOUNTY_SOURCES } from './bounty-source.interface';
import { PAYOUT_SOURCES } from './payout-source.interface';
import { SuperteamSource } from './superteam.source';
import { BountycasterSource } from './bountycaster.source';
import { DevpostSource } from './devpost.source';
import { GenericPayoutSource } from './generic-payout.source';

@Module({
  imports: [HttpModule, ScraperModule],
  providers: [
    SuperteamSource,
    BountycasterSource,
    DevpostSource,
    GenericPayoutSource,
    {
      provide: BOUNTY_SOURCES,
      useFactory: (...sources) => sources,
      inject: [SuperteamSource, BountycasterSource, DevpostSource], // <- bounty sources injected here
    },
    {
      provide: PAYOUT_SOURCES,
      useFactory: (...sources) => sources,
      inject: [GenericPayoutSource], // <- payout sources injected here
    },
  ],
  exports: [BOUNTY_SOURCES, PAYOUT_SOURCES],
})
export class SourcesModule {}
