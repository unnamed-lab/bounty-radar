import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const API = 'https://immunefi.com/public-api/bounties.json';

@Injectable()
export class ImmunefiSource implements BountySource {
  readonly name = 'immunefi';
  private readonly logger = new Logger(ImmunefiSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(API, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 30_000,
        }),
      );

      const programs = Array.isArray(data) ? data : [];
      this.logger.log(`Fetched ${programs.length} Immunefi programs`);

      return programs
        .filter((p: any) => {
          const status = p.status?.toLowerCase?.();
          return status === 'active' || status === 'live' || !status;
        })
        .map((p: any): Bounty => {
          const maxBounty = p.maxBounty ?? 0;
          const reward = maxBounty ? `Up to $${Number(maxBounty).toLocaleString()}` : '';

          const ecosystems = Array.isArray(p.ecosystem) ? p.ecosystem : [];
          const tags = ['bug-bounty', ...ecosystems.map((e: string) => e.toLowerCase())];

          return {
            source: this.name,
            title: p.project ?? p.id ?? 'Untitled Immunefi Program',
            url: p.slug ? `https://immunefi.com/bug-bounty/${p.slug}/` : 'https://immunefi.com',
            reward,
            deadline: undefined,
            tags,
            host: p.project ?? 'Immunefi',
          };
        });
    } catch (err) {
      this.logger.error(`Failed to fetch Immunefi programs: ${(err as Error).message}`);
      return [];
    }
  }
}
