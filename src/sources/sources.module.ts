import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScraperModule } from '../scraper/scraper.module';
import { BOUNTY_SOURCES } from './bounty-source.interface';
import { PAYOUT_SOURCES } from './payout-source.interface';
import { SuperteamSource } from './superteam.source';
// import { BountycasterSource } from './bountycaster.source';
import { DevpostSource } from './devpost.source';
import { CryptoJobsListSource } from './cryptojobslist.source';
import { SherlockSource } from './sherlock.source';
import { Code4renaSource } from './code4rena.source';
import { SuperteamPayoutSource } from './superteam-payout.source';

@Module({
  imports: [HttpModule, ScraperModule],
  providers: [
    SuperteamSource,
    // BountycasterSource — disabled: site requires Farcaster/Privy auth (no public API)
    DevpostSource,
    CryptoJobsListSource,
    SherlockSource,
    Code4renaSource,
    SuperteamPayoutSource,
    {
      provide: BOUNTY_SOURCES,
      useFactory: (...sources) => sources,
      inject: [
        SuperteamSource,
        /*BountycasterSource,*/
        DevpostSource,
        CryptoJobsListSource,
        SherlockSource,
        Code4renaSource,
      ],
    },
    {
      provide: PAYOUT_SOURCES,
      useFactory: (...sources) => sources,
      inject: [SuperteamPayoutSource],
    },
  ],
  exports: [BOUNTY_SOURCES, PAYOUT_SOURCES],
})
export class SourcesModule {}
