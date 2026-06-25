import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const API_URL = 'https://www.bountycaster.xyz/api/v1/bounties/open';

@Injectable()
export class BountycasterSource implements BountySource {
  readonly name = 'bountycaster';
  private readonly logger = new Logger(BountycasterSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(API_URL, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15_000,
        }),
      );

      const items = Array.isArray(data?.bounties) ? data.bounties : [];
      if (!items.length) {
        this.logger.warn('Bountycaster API returned 0 bounties — likely requires Farcaster/Privy auth');
        return [];
      }

      return items.map(
        (it: any): Bounty => ({
          source: this.name,
          title: it.title ?? 'Untitled Farcaster Bounty',
          url: `https://www.bountycaster.xyz/bounty/${it.id ?? ''}`,
          reward: it.rewardAmount ?? '',
          deadline: it.deadline ? new Date(it.deadline).toISOString() : undefined,
          tags: ['farcaster'],
          host: it.poster?.username ?? 'Farcaster',
        }),
      );
    } catch (err) {
      this.logger.warn(`Bountycaster API unreachable (requires auth): ${(err as Error).message}`);
      return [];
    }
  }
}
