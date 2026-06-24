import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import { BountyFetcherService } from '../zen/bounty-fetcher.service';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

@Injectable()
export class SpotlightService {
  private readonly logger = new Logger(SpotlightService.name);
  private readonly handle: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: BountyFetcherService,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
  }

  @Cron(process.env.SPOTLIGHT_CRON ?? '0 0 16 * * 2,5')
  async run(): Promise<void> {
    const p = await this.prisma.payout.findFirst({
      where: { spotlighted: false },
      orderBy: { closedAt: 'desc' },
    });
    if (!p) return;

    // Try AI-generated spotlight
    const displayUrl = normaliseUrl(p.url);
    const pageContent = await this.fetcher.fetch(p.url);
    const ai = await this.writer.spotlight(
      {
        title: p.title,
        winner: p.winner,
        amountText: p.amountText,
        amountUsd: p.amountUsd,
        url: displayUrl,
        source: p.source,
      },
      pageContent,
    );

    if (ai && ai.length >= 2) {
      await this.tg.sendThread(ai, 'WINNER SPOTLIGHT');
    } else {
      // Fallback template
      const who = p.winner ? `👏 ${p.winner}` : '👏 A builder';
      const amt = p.amountText
        ? ` just earned ${p.amountText}`
        : ' just won a bounty';

      const tweets: string[] = [
        `💰 Someone just scored big in web3\n\n` +
        `Proof builders are getting paid in this ecosystem. Here's what happened 👇`,
        `${who}${amt} for: ${p.title}\n\n` +
        `This is what's possible right now. ${displayUrl}\n\n` +
        `Want in? Bounty Radar drops open opportunities daily. ` +
        `Follow ${this.handle} + turn on notifs.`,
      ];
      await this.tg.sendThread(tweets, 'WINNER SPOTLIGHT');
    }

    await this.prisma.payout.update({
      where: { id: p.id },
      data: { spotlighted: true },
    });
    this.logger.log(`spotlight sent: ${p.title}`);
  }
}
