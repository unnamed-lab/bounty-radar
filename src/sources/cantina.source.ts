import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const API = 'https://cantina.xyz/api/v0/repositories/public';

@Injectable()
export class CantinaSource implements BountySource {
  readonly name = 'cantina';
  private readonly logger = new Logger(CantinaSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(API, {
          params: { status: 'live' },
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 30_000,
        }),
      );

      const repos = Array.isArray(data) ? data : [];
      this.logger.log(`Fetched ${repos.length} Cantina repos`);

      return repos
        .filter((r: any) => r.kind === 'public_bounty' || r.kind === 'competition')
        .map((r: any): Bounty => {
          const reward = r.totalRewardPot
            ? `${parseInt(r.totalRewardPot, 10).toLocaleString()} ${r.currencyCode ?? 'USDC'}`
            : '';

          let deadline: string | undefined;
          if (r.timeframe?.end) {
            const d = new Date(r.timeframe.end);
            if (!isNaN(d.getTime())) deadline = d.toISOString();
          }

          const tags = [r.kind === 'competition' ? 'audit' : 'bug-bounty'];
          return {
            source: this.name,
            title: r.name ?? 'Untitled Cantina Program',
            url: `https://cantina.xyz/portfolio/${r.id ?? ''}`,
            reward,
            deadline,
            tags,
            host: r.company?.name ?? 'Cantina',
          };
        });
    } catch (err) {
      this.logger.error(`Failed to fetch Cantina repos: ${(err as Error).message}`);
      return [];
    }
  }
}
