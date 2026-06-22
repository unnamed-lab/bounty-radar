import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PayoutSource, PayoutRecord } from './payout-source.interface';

const ENDPOINT = 'https://superteam.fun/api/listings';

@Injectable()
export class SuperteamPayoutSource implements PayoutSource {
  readonly name = 'superteam-payouts';
  private readonly logger = new Logger(SuperteamPayoutSource.name);

  constructor(private readonly http: HttpService) {}

  async fetchPayouts(): Promise<PayoutRecord[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(ENDPOINT, {
          params: {
            context: 'home',
            tab: 'all',
            category: 'All',
            status: 'completed',
            sortBy: 'Date',
            order: 'desc',
          },
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 20_000,
        }),
      );

      const items = Array.isArray(data) ? data : [];
      return items.map(
        (it: any): PayoutRecord => {
          const type = String(it.type ?? 'bounty').toLowerCase();
          const rewardAmount = it.rewardAmount ?? '';
          const token = it.token ?? '';
          const amountText = rewardAmount ? `${rewardAmount} ${token}`.trim() : '';
          
          return {
            source: this.name,
            title: it.title ?? 'Untitled Completed Listing',
            url: it.slug
              ? `https://superteam.fun/listings/${type}/${it.slug}`
              : `https://superteam.fun/earn`,
            winner: 'A builder', // Fallback as individual winner usernames are fetched on detail page
            amountText,
            closedAt: it.winnersAnnouncedAt ?? it.deadline ?? new Date().toISOString(),
          };
        },
      );
    } catch (err) {
      this.logger.error(`Failed to fetch Superteam payouts: ${(err as Error).message}`);
      return [];
    }
  }
}
