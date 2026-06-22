import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '../scraper/browser.service';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

const URL = 'https://www.bountycaster.xyz/';

@Injectable()
export class BountycasterSource implements BountySource {
  readonly name = 'bountycaster';
  private readonly logger = new Logger(BountycasterSource.name);

  constructor(private readonly browser: BrowserService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      return await this.browser.withPage(async (page) => {
        this.logger.log(`Navigating to ${URL}...`);
        await page.goto(URL, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });

        // Let the client-side hydrate the list
        await page.waitForTimeout(4000);

        // Scrape listings cards if they exist
        return page.evaluate(() => {
          // Bountycaster uses a list of casts or cards containing bounty links
          const cards = Array.from(document.querySelectorAll('div.border, div.rounded-lg, li, tr'));
          const results: any[] = [];

          for (const card of cards) {
            const linkEl = card.querySelector('a[href*="/bounty/"], a[href*="/bounties/"], a[href*="/casts/"]');
            if (!linkEl) continue;

            const url = (linkEl as HTMLAnchorElement).href;
            if (!url || results.some((r) => r.url === url)) continue;

            // Try to extract title and reward from text content
            const text = card.textContent?.trim() || '';
            const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
            const title = lines[0] || 'Untitled Farcaster Bounty';
            
            // Try to extract reward (e.g. looking for currency symbols or USD/USDC/ETH/SOL)
            let reward = '';
            const rewardMatch = text.match(/(?:\$|💰|USD|USDC|ETH|SOL|DEGEN)\s*\d+(?:,\d+)*(?:\.\d+)?/i);
            if (rewardMatch) {
              reward = rewardMatch[0];
            }

            results.push({
              source: 'bountycaster',
              title,
              url,
              reward,
              deadline: undefined,
              tags: ['farcaster'],
            });
          }

          // Fallback to checking all anchor links if cards are not standard
          if (results.length === 0) {
            const links = Array.from(document.querySelectorAll('a'));
            for (const a of links) {
              const href = a.href;
              if (href && (href.includes('/bounty/') || href.includes('/casts/'))) {
                const text = a.innerText.trim();
                if (text && !results.some((r) => r.url === href)) {
                  results.push({
                    source: 'bountycaster',
                    title: text,
                    url: href,
                    reward: '',
                    deadline: undefined,
                    tags: ['farcaster'],
                  });
                }
              }
            }
          }

          return results;
        });
      });
    } catch (err) {
      this.logger.error(`Failed to scrape Bountycaster: ${(err as Error).message}`);
      return [];
    }
  }
}
