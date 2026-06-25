import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TelegramService } from './telegram.service';
import { BotCommandsService } from './bot-commands.service';

@Module({
  imports: [HttpModule],
  providers: [TelegramService, BotCommandsService],
  exports: [TelegramService],
})
export class TelegramModule {}
