import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const ENDPOINT = 'https://devpost.com/api/hackathons';

@Injectable()
export class DevpostSource implements BountySource {
  readonly name = 'devpost';
  private readonly logger = new Logger(DevpostSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(ENDPOINT, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 20_000,
        }),
      );

      const items = Array.isArray(data?.hackathons) ? data.hackathons : [];
      return items.map(
        (it: any): Bounty => {
          // Parse HTML tags out of prize amount, e.g. "$<span data-currency-value>2,000,000</span>" -> "$2,000,000"
          const rewardRaw = it.prize_amount ?? '';
          const rewardText = rewardRaw.replace(/<[^>]*>/g, '').trim();

          // Parse deadline date from the end of the submission period dates, e.g. "May 19 - Aug 17, 2026"
          let deadline: string | undefined = undefined;
          if (it.submission_period_dates) {
            const parts = it.submission_period_dates.split(' - ');
            const endDateStr = parts[1] || parts[0];
            if (endDateStr) {
              const d = new Date(endDateStr);
              if (!isNaN(d.getTime())) {
                deadline = d.toISOString();
              }
            }
          }

          const tags = Array.isArray(it.themes)
            ? it.themes.map((t: any) => String(t.name).toLowerCase())
            : [];

          return {
            source: this.name,
            title: it.title ?? 'Untitled Hackathon',
            url: it.url ?? 'https://devpost.com',
            reward: rewardText,
            deadline,
            tags,
            host: it.organization_name,
          };
        },
      );
    } catch (err) {
      this.logger.error(`Failed to fetch Devpost listings: ${(err as Error).message}`);
      return [];
    }
  }
}
