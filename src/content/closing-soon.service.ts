import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ClosingSoonService {
  private readonly logger = new Logger(ClosingSoonService.name);

  constructor(
    private readonly repo: BountyRepository,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.CLOSING_SOON_CRON ?? '0 0 */6 * * *')
  async run(): Promise<void> {
    const soon = await this.repo.closingSoon(72);
    if (!soon.length) return;

    const lines = soon
      .slice(0, 5)
      .map(
        (b) =>
          `⏳ ${b.title}${b.rewardText ? ` — ${b.rewardText}` : ''}\n${b.url}`,
      );
    const draft =
      `🚨 Closing soon (next 72h) — don't sleep on these:\n\n` +
      lines.join('\n\n') +
      `\n\nMore on the radar.`;

    await this.tg.sendRaw(`📝 CLOSING-SOON DRAFT\n\n${draft}`);
    await this.repo.markAlerted(soon.map((b) => b.uid));
    this.logger.log(`alerted ${soon.length} closing-soon bounties`);
  }
}
