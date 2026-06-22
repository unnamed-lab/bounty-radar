import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const URL = 'https://immunefi.com/bug-bounty';

@Injectable()
export class ImmunefiSource implements BountySource {
  readonly name = 'immunefi';
  private readonly logger = new Logger(ImmunefiSource.name);

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(URL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 20_000,
        }),
      );

      const html = String(data);
      const bounties = this.extractBounties(html);

      if (!bounties.length) {
        this.logger.warn('No bug bounty programs extracted from Immunefi');
        return [];
      }

      this.logger.log(`Extracted ${bounties.length} bug bounty programs`);

      return bounties.map((b: any): Bounty => {
        const maxBounty = b.maxBounty ?? 0;
        const rewardText = maxBounty ? `$${maxBounty.toLocaleString()} max` : 'Variable';

        const tags = ['bug-bounty'];
        if (Array.isArray(b.tags)) {
          tags.push(...b.tags.map((t: string) => t.toLowerCase().replace(/\s+/g, '-')));
        }
        if (Array.isArray(b.technologies)) {
          tags.push(...b.technologies.map((t: string) => t.toLowerCase().replace(/\s+/g, '-')));
        }

        return {
          source: this.name,
          title: b.project ?? b.slug ?? 'Unknown Bug Bounty',
          url: b.url?.startsWith('http')
            ? b.url
            : `https://immunefi.com${b.url ?? `/bounty/${b.slug ?? ''}`}`,
          reward: rewardText,
          deadline: undefined,
          tags,
          host: b.project,
        };
      });
    } catch (err) {
      this.logger.error(`Failed to fetch Immunefi programs: ${(err as Error).message}`);
      return [];
    }
  }

  private extractBounties(html: string): any[] {
    const chunkRegex = /self\.__next_f\.push\(\[\d+,"([\s\S]*?)"\]\)/g;
    let fullPayload = '';
    let m: RegExpExecArray | null;

    while ((m = chunkRegex.exec(html)) !== null) {
      let decoded = m[1].replace(/\\(.)/g, '$1');
      fullPayload += decoded;
    }

    if (!fullPayload) {
      this.logger.warn('No RSC payload chunks found');

      // Fallback: try __NEXT_DATA__ for static sites
      const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextMatch) {
        try {
          const parsed = JSON.parse(nextMatch[1]);
          const props = parsed.props?.pageProps;
          if (props?.bounties) return props.bounties;
        } catch { /* ignore */ }
      }

      return [];
    }

    const idx = fullPayload.indexOf('"bounties"');
    if (idx < 0) {
      this.logger.warn('No bounties key found in RSC payload');
      return [];
    }

    const arrayStart = fullPayload.indexOf('[', idx);
    if (arrayStart < 0) return [];

    let depth = 0;
    let end = arrayStart;
    for (let i = arrayStart; i < fullPayload.length; i++) {
      const ch = fullPayload[i];
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    try {
      return JSON.parse(fullPayload.slice(arrayStart, end));
    } catch (e) {
      this.logger.error(`Failed to parse bounties JSON: ${(e as Error).message}`);
      return [];
    }
  }
}
