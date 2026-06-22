import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const ENDPOINT = 'https://api.github.com/orgs/code-423n4/repos';

@Injectable()
export class Code4renaSource implements BountySource {
  readonly name = 'code4rena';
  private readonly logger = new Logger(Code4renaSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(ENDPOINT, {
          params: { per_page: 30, sort: 'pushed', direction: 'desc' },
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'BountyRadar/1.0',
          },
          timeout: 20_000,
        }),
      );

      const repos = Array.isArray(data) ? data : [];
      this.logger.log(`Fetched ${repos.length} repos from code-423n4 org`);

      const audits = repos.filter(
        (r: any) =>
          r.name.match(/^\d{4}-\d{2}/) ||
          r.name.includes('audit') ||
          r.name.includes('findings'),
      );

      this.logger.log(`Filtered to ${audits.length} audit repos`);

      return audits.map((r: any): Bounty => {
        const reward = this.extractReward(r.name, r.description);
        return {
          source: this.name,
          title: r.description
            ? `${r.name}: ${r.description.slice(0, 200)}`
            : `Code4rena Audit — ${r.name}`,
          url: r.html_url ?? `https://github.com/code-423n4/${r.name}`,
          reward,
          deadline: r.pushed_at ? new Date(r.pushed_at).toISOString() : undefined,
          tags: ['bug-bounty', 'audit', 'code4rena'],
          host: r.name.includes('-') ? r.name.split('-').slice(1).join(' ')?.replace(/-/g, ' ') || 'Code4rena' : 'Code4rena',
        };
      });
    } catch (err) {
      this.logger.error(`Failed to fetch Code4rena repos: ${(err as Error).message}`);
      return [];
    }
  }

  private extractReward(name: string, description: string | null): string {
    const desc = description ?? '';
    const m = desc.match(/(\d[\d,]*)\s*(ETH|USDC|USDT|USD)?/i);
    if (m) return `${m[1]} ${m[2] ?? ''}`.trim();

    const nameMatch = name.match(/-(?:q1|q2|q3|q4|bonus|primary|secondary)\b/i);
    if (nameMatch) return 'Variable prize pool';

    return '';
  }
}
