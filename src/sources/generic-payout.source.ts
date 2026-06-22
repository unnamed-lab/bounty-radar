import { Injectable } from '@nestjs/common';
import { BrowserService } from '../scraper/browser.service';
import { PayoutSource, PayoutRecord } from './payout-source.interface';

// PLACEHOLDERS — point at a site's completed / winners page + selectors.
const WINNERS_URL = 'https://example-bounty-site.xyz/completed';
const CARD = "[data-testid='winner-card']";

@Injectable()
export class GenericPayoutSource implements PayoutSource {
  readonly name = 'generic-payouts';

  constructor(private readonly browser: BrowserService) {}

  async fetchPayouts(): Promise<PayoutRecord[]> {
    return this.browser.withPage(async (page) => {
      await page.goto(WINNERS_URL, {
        waitUntil: 'networkidle',
        timeout: 45_000,
      });
      return page.$$eval(CARD, (cards) =>
        cards.map((c) => ({
          source: 'generic-payouts',
          title: c.querySelector('h3')?.textContent?.trim() ?? '',
          url: (c.querySelector('a') as HTMLAnchorElement)?.href ?? '',
          winner: c.querySelector('.winner')?.textContent?.trim() ?? '',
          amountText: c.querySelector('.amount')?.textContent?.trim() ?? '',
        })),
      );
    });
  }
}
