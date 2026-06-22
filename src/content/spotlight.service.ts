import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class SpotlightService {
  private readonly handle: string;

  constructor(
    private readonly prisma: PrismaService,
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

    const who = p.winner ? `👏 ${p.winner}` : '👏 A builder';
    const amt = p.amountText
      ? ` just earned ${p.amountText}`
      : ' just won a bounty';

    const tweets: string[] = [];

    // Hook
    tweets.push(
      `💰 Someone just scored big in web3\n\n` +
      `Proof builders are getting paid in this ecosystem. Here's what happened 👇`,
    );

    // Body
    tweets.push(
      `${who}${amt} for: ${p.title}\n\n` +
      `This is what's possible right now. ${p.url}\n\n` +
      `Want in? Bounty Radar drops open opportunities daily. ` +
      `Follow ${this.handle} + turn on notifs.`,
    );

    await this.tg.sendThread(tweets, 'WINNER SPOTLIGHT');
    await this.prisma.payout.update({
      where: { id: p.id },
      data: { spotlighted: true },
    });
  }
}
