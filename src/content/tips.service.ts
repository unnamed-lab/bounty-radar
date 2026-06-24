import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';

const TOPICS = [
  'How to write a winning bounty submission — 3 key elements judges look for',
  'How to find bounties that match your exact skill set',
  'Common mistakes in bounty submissions and how to avoid them',
  'How to price your work for web3 bounties',
  'What judges actually look for in hackathon submissions',
  'How to stand out in a crowded bounty application pool',
  'The smart way to research a bounty before submitting',
  'How to build a portfolio that wins bounties',
  'Time management tips for bounty hunters juggling multiple projects',
  'How to get feedback and improve your next submission',
];

@Injectable()
export class TipsService {
  private readonly logger = new Logger(TipsService.name);
  private topicIndex = 0;

  constructor(
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.TIPS_CRON ?? '0 0 12 * * 2,4')
  async run(): Promise<void> {
    const topic = TOPICS[this.topicIndex % TOPICS.length];
    this.topicIndex++;

    const ai = await this.writer.tipThread(topic);

    if (ai && ai.length >= 3) {
      await this.tg.sendThread(ai, 'TIP THREAD');
    } else {
      await this.tg.sendThread(this.fallback(topic), 'TIP THREAD');
    }

    this.logger.log(`tip thread sent — topic: ${topic.slice(0, 40)}...`);
  }

  private fallback(topic: string): string[] {
    const handle = process.env.X_HANDLE ?? '@unnamedcodes';
    const base = topic.replace(/^How to /i, '').replace(/^What /i, '').replace(/^The /i, '');

    return [
      `💡 ${topic}\n\nHere is a quick breakdown 👇`,

      `1. Start with the requirements. Read the full bounty description twice before you write anything.\n\n` +
      `2. Tailor your approach to what the host asked for, not what you want to build.\n\n` +
      `3. Keep it concise and clear. Judges read dozens of submissions.`,

      `Master this and you will win more than you lose.\n\n` +
      `Follow ${handle} for more bounty tips and opportunities. ♻️ RT to help a friend.`,
    ];
  }
}
