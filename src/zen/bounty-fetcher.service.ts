import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BountyFetcherService {
  private readonly logger = new Logger(BountyFetcherService.name);

  constructor(private readonly http: HttpService) {}

  async fetch(url: string): Promise<string> {
    url = url.replace(
      /^https:\/\/superteam\.fun\/listings\/bounty\/(.+)$/,
      'https://superteam.fun/earn/listing/$1/',
    );
    try {
      const { data } = await firstValueFrom(
        this.http.get(url, {
          timeout: 10_000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BountyRadar/1.0)',
            Accept: 'text/html,application/json',
          },
        }),
      );

      if (typeof data === 'string') {
        const text = data
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[^;]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000);
        return text || '';
      }

      if (typeof data === 'object') {
        return JSON.stringify(data).slice(0, 3000);
      }

      return '';
    } catch (err) {
      this.logger.warn(`Failed to fetch ${url}: ${(err as Error).message}`);
      return '';
    }
  }
}
