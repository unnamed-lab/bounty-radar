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
    const draft =
      `${who}${amt} for: ${p.title}\n\n` +
      `This is what's possible in web3 right now. ${p.url}\n\n` +
      `Want in? Bounty Radar drops open opportunities daily. ` +
      `Follow ${this.handle} + turn on notifs.`;

    await this.tg.sendRaw(`📝 SPOTLIGHT DRAFT\n\n${draft}`);
    await this.prisma.payout.update({
      where: { id: p.id },
      data: { spotlighted: true },
    });
  }
}
