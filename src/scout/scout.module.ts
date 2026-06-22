import { Module } from '@nestjs/common';
import { SourcesModule } from '../sources/sources.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ScoutService } from './scout.service';

@Module({
  imports: [SourcesModule, TelegramModule],
  providers: [ScoutService],
  exports: [ScoutService],
})
export class ScoutModule {}
