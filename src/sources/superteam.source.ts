import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

// PLACEHOLDER: find the real endpoint in DevTools -> Network -> Fetch/XHR.
const ENDPOINT = 'https://earn.superteam.fun/api/listings';

@Injectable()
export class SuperteamSource implements BountySource {
  readonly name = 'superteam';

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    const { data } = await firstValueFrom(
      this.http.get(ENDPOINT, {
        params: { type: 'bounty', status: 'open', take: 50 },
        headers: { Accept: 'application/json' },
        timeout: 30_000,
      }),
    );
    const items = Array.isArray(data) ? data : (data.listings ?? []);
    return items.map(
      (it: any): Bounty => ({
        source: this.name,
        title: it.title ?? 'Untitled',
        url: it.slug
          ? `https://earn.superteam.fun/listing/${it.slug}/`
          : it.url,
        reward: String(it.rewardAmount ?? it.reward ?? ''),
        deadline: String(it.deadline ?? ''),
        tags: (it.skills ?? []).filter(Boolean),
      }),
    );
  }
}
