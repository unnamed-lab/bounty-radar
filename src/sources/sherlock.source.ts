import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const BASE = 'https://audits.sherlock.xyz/api/contests';

@Injectable()
export class SherlockSource implements BountySource {
  readonly name = 'sherlock';
  private readonly logger = new Logger(SherlockSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const all: any[] = [];
      let page = 1;

      while (page) {
        const { data } = await firstValueFrom(
          this.http.get(BASE, {
            params: { page },
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 20_000,
          }),
        );

        if (data?.items?.length) {
          all.push(...data.items);
          this.logger.log(`Page ${page}: ${data.items.length} contests`);
          page = data.next_page ?? 0;
        } else {
          page = 0;
        }
      }

      return all.map((c: any): Bounty => {
        const rewardAmount = c.rewards ?? c.prize_pool ?? 0;
        const token = c.token ?? '';
        const rewardText = rewardAmount ? `${rewardAmount} ${token}`.trim() : '';

        let deadline: string | undefined;
        if (c.ends_at) {
          const d = new Date(c.ends_at);
          if (!isNaN(d.getTime())) deadline = d.toISOString();
        }

        const tags = ['bug-bounty', 'audit'];
        if (c.type_label) tags.push(c.type_label.toLowerCase().replace(/\s+/g, '-'));

        return {
          source: this.name,
          title: c.title ?? 'Untitled Contest',
          url: `https://audits.sherlock.xyz/contests/${c.id ?? ''}`,
          reward: rewardText,
          deadline,
          tags,
          host: 'Sherlock',
        };
      });
    } catch (err) {
      this.logger.error(`Failed to fetch Sherlock contests: ${(err as Error).message}`);
      return [];
    }
  }
}
