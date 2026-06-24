import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BountyRepository } from '../persistence/bounty.repository';
import { ContentWriterService } from '../zen/content-writer.service';
import { TelegramService } from '../telegram/telegram.service';
import { normaliseUrl } from '../utils/normalise-url';

const TOPICS = [
  'Tag a builder who should enter this bounty. Who comes to mind?',
  'Which bounty from this week would you enter and why?',
  'What is the most underrated bounty type in web3 right now?',
  'RT if you are actively looking for web3 bounties right now.',
  'Drop a link to a bounty you are eyeing. Let others discover it too.',
  'What skill should every bounty hunter learn in 2026?',
  'If you could design the perfect bounty, what would it look like?',
  'What is your biggest challenge when starting a bounty submission?',
  'Which ecosystem has the best bounty opportunities right now?',
  'Tag a friend who needs to see this bounty opportunity.',
];

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);
  private topicIndex = 0;

  constructor(
    private readonly repo: BountyRepository,
    private readonly writer: ContentWriterService,
    private readonly tg: TelegramService,
  ) {}

  @Cron(process.env.ENGAGEMENT_CRON ?? '0 0 14 * * 1,3,5')
  async run(): Promise<void> {
    const bounty = await this.repo.forTopPick();
    const topic = TOPICS[this.topicIndex % TOPICS.length];
    this.topicIndex++;

    const ctx = bounty
      ? { title: bounty.bounty.title, host: bounty.bounty.host, url: normaliseUrl(bounty.bounty.url) }
      : undefined;

    const ai = await this.writer.engagementPost(topic, ctx);
    const post = ai ?? this.fallback(topic, ctx);

    await this.tg.sendRaw(`📝 ENGAGEMENT POST — 1 tweet 👇\n\n${post}`);
    this.logger.log(`engagement post sent — topic: ${topic.slice(0, 40)}...`);
  }

  private fallback(topic: string, bounty?: { title: string; host: string; url: string }): string {
    const handle = process.env.X_HANDLE ?? '@unnamedcodes';
    const ctx = bounty ? `\n\n${bounty.title} by ${bounty.host}\n${bounty.url}` : '';
    const question = topic.endsWith('?') ? topic : topic + '?';
    return `${question}${ctx}\n\n👇 Reply below. Like, RT, and follow ${handle} for daily bounty drops.`;
  }
}
