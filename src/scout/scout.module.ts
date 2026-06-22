import { Module } from '@nestjs/common';
import { SourcesModule } from '../sources/sources.module';
import { ScoutService } from './scout.service';

@Module({
  imports: [SourcesModule],
  providers: [ScoutService],
  exports: [ScoutService],
})
export class ScoutModule {}
