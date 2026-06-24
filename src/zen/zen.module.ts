import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZenService } from './zen.service';
import { BountyFetcherService } from './bounty-fetcher.service';
import { ContentWriterService } from './content-writer.service';

@Module({
  imports: [HttpModule],
  providers: [ZenService, BountyFetcherService, ContentWriterService],
  exports: [ZenService, BountyFetcherService, ContentWriterService],
})
export class ZenModule {}
