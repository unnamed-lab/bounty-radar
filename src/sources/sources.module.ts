import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BOUNTY_SOURCES } from './bounty-source.interface';
import { PAYOUT_SOURCES } from './payout-source.interface';
import { SuperteamSource } from './superteam.source';
import { BountycasterSource } from './bountycaster.source';
import { DevpostSource } from './devpost.source';
import { CryptoJobsListSource } from './cryptojobslist.source';
import { SherlockSource } from './sherlock.source';
import { Code4renaSource } from './code4rena.source';
import { CantinaSource } from './cantina.source';
import { ImmunefiSource } from './immunefi.source';
import { SuperteamPayoutSource } from './superteam-payout.source';

@Module({
  imports: [HttpModule],
  providers: [
    SuperteamSource,
    BountycasterSource,
    DevpostSource,
    CryptoJobsListSource,
    SherlockSource,
    Code4renaSource,
    CantinaSource,
    ImmunefiSource,
    SuperteamPayoutSource,
    {
      provide: BOUNTY_SOURCES,
      useFactory: (...sources) => sources,
      inject: [
        SuperteamSource,
        BountycasterSource,
        DevpostSource,
        CryptoJobsListSource,
        SherlockSource,
        Code4renaSource,
        CantinaSource,
        ImmunefiSource,
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
