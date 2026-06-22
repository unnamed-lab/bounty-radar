import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { BrowserService } from '../scraper/browser.service';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

// PLACEHOLDERS — replace with the real site's URL + selectors.
const LISTING_URL = 'https://example-bounty-site.xyz/bounties';
const CARD = "[data-testid='bounty-card']";
const MAX_SCROLLS = 25;

@Injectable()
export class GenericScrapeSource implements BountySource {
  readonly name = 'generic';

  constructor(private readonly browser: BrowserService) {}

  async fetch(): Promise<Bounty[]> {
    return this.browser.withPage(async (page) => {
      await page.goto(LISTING_URL, {
        waitUntil: 'networkidle',
        timeout: 45_000,
      });
      await this.scrollUntilStable(page);

      return page.$$eval(CARD, (cards) =>
        cards.map((c) => ({
          source: 'generic',
          title: c.querySelector('h3')?.textContent?.trim() ?? '',
          url: (c.querySelector('a') as HTMLAnchorElement)?.href ?? '',
          reward: c.querySelector('.reward')?.textContent?.trim() ?? '',
        })),
      );
    });
  }

  private async scrollUntilStable(page: Page): Promise<void> {
    let prev = -1;
    for (let i = 0; i < MAX_SCROLLS; i++) {
      const count = await page.locator(CARD).count();
      if (count === prev) break;
      prev = count;
      await page.mouse.wheel(0, 20_000);
      await page.waitForTimeout(1200); // let new items hydrate
      // If the site uses a button instead of scroll:
      // const more = page.locator('text=Load more');
      // if (await more.count()) await more.first().click();
    }
  }
}
