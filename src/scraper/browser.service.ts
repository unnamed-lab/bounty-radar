import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import type { Browser, Page } from 'playwright';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser?: Browser;

  private async get(): Promise<Browser> {
    if (!this.browser) {
      const { chromium } = await import('playwright');
      this.browser = await chromium.launch({ headless: true });
      this.logger.log('Chromium launched');
    }
    return this.browser;
  }

  /** Run work against a fresh page; always closes the context afterwards. */
  async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.get();
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; BountyRadar/1.0)',
    });
    const page = await ctx.newPage();
    try {
      return await fn(page);
    } finally {
      await ctx.close();
    }
  }

  async onModuleDestroy() {
    await this.browser?.close();
  }
}
