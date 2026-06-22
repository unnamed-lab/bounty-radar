import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const ENDPOINT = 'https://superteam.fun/api/listings';

@Injectable()
export class SuperteamSource implements BountySource {
  readonly name = 'superteam';

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    const { data } = await firstValueFrom(
      this.http.get(ENDPOINT, {
        params: {
          context: 'home',
          tab: 'all',
          category: 'All',
          status: 'open',
          sortBy: 'Date',
          order: 'desc', // get latest first
        },
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 30_000,
      }),
    );

    const items = Array.isArray(data) ? data : [];
    return items.map(
      (it: any): Bounty => {
        const type = String(it.type ?? 'bounty').toLowerCase();
        const rewardAmount = it.rewardAmount ?? '';
        const token = it.token ?? '';
        const rewardText = rewardAmount ? `${rewardAmount} ${token}`.trim() : '';

        return {
          source: this.name,
          title: it.title ?? 'Untitled',
          url: it.slug
            ? `https://superteam.fun/earn/listing/${it.slug}/`
            : `https://superteam.fun/earn`,
          reward: rewardText,
          deadline: it.deadline ? new Date(it.deadline).toISOString() : undefined,
          tags: [type].filter(Boolean),
          host: it.sponsor?.name,
        };
      },
    );
  }
}
