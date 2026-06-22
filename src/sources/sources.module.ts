import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScraperModule } from '../scraper/scraper.module';
import { BOUNTY_SOURCES } from './bounty-source.interface';
import { PAYOUT_SOURCES } from './payout-source.interface';
import { SuperteamSource } from './superteam.source';
import { GenericScrapeSource } from './generic-scrape.source';
import { GenericPayoutSource } from './generic-payout.source';

@Module({
  imports: [HttpModule, ScraperModule],
  providers: [
    SuperteamSource,
    GenericScrapeSource,
    GenericPayoutSource,
    {
      provide: BOUNTY_SOURCES,
      useFactory: (...sources) => sources,
      inject: [SuperteamSource, GenericScrapeSource], // <- add new bounty sources here
    },
    {
      provide: PAYOUT_SOURCES,
      useFactory: (...sources) => sources,
      inject: [GenericPayoutSource], // <- add new payout sources here
    },
  ],
  exports: [BOUNTY_SOURCES, PAYOUT_SOURCES],
})
export class SourcesModule {}
