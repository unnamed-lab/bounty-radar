import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DigestService } from './digest.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class DropScheduler {
  private readonly logger = new Logger(DropScheduler.name);

  constructor(
    private readonly digest: DigestService,
    private readonly tg: TelegramService,
  ) {}

  // Daily drop draft (default 09:00). Override with DROP_CRON.
  @Cron(process.env.DROP_CRON ?? '0 0 9 * * *')
  async dailyDrop(): Promise<void> {
    const thread = await this.digest.buildDrop();
    if (!thread.length) {
      this.logger.log('No fresh bounties for today’s drop, skipping');
      return;
    }
    await this.tg.sendThread(thread, 'DAILY DROP DRAFT');
    this.logger.log(`daily drop drafted — ${thread.length} tweets`);
  }
}
