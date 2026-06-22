import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Bounty } from '../domain/bounty';

@Injectable()
export class TelegramService {
  private readonly api: string;
  private readonly chatId: string;

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.api = `https://api.telegram.org/bot${cfg.get('TG_TOKEN')}/sendMessage`;
    this.chatId = cfg.get<string>('TG_CHAT_ID')!;
  }

  private esc(s: string) {
    return (s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Send text. Plain text by default, which is safe for arbitrary draft content
   * (titles/URLs with & < > won't break the message). Pass { html: true } only
   * when the caller has already escaped its content.
   */
  async sendRaw(
    text: string,
    opts: { html?: boolean; preview?: boolean } = {},
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
      disable_web_page_preview: !opts.preview,
    };
    if (opts.html) payload.parse_mode = 'HTML';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await firstValueFrom(
          this.http.post(this.api, payload, { timeout: 20_000 }),
        );
        return;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
  }

  /** Send a thread as numbered, separate plain-text messages for copy-paste. */
  async sendThread(tweets: string[], header: string): Promise<void> {
    await this.sendRaw(`📝 ${header} — ${tweets.length} tweets, copy in order:`);
    for (let i = 0; i < tweets.length; i++) {
      await this.sendRaw(`[${i + 1}/${tweets.length}]\n\n${tweets[i]}`);
      await new Promise((r) => setTimeout(r, 400)); // keep order, avoid flood
    }
  }

  /** Optional: per-bounty alert (not used by the curated-drop flow). */
  async send(b: Bounty): Promise<void> {
    const lines = [`<b>${this.esc(b.title)}</b>`, `<i>${this.esc(b.source)}</i>`];
    if (b.reward) lines.push(`💰 ${this.esc(b.reward)}`);
    if (b.deadline) lines.push(`⏳ ${this.esc(b.deadline)}`);
    if (b.tags?.length) {
      lines.push(b.tags.map((t) => `#${this.esc(t)}`).join(' '));
    }
    lines.push(`<a href="${this.esc(b.url)}">Open listing</a>`);
    await this.sendRaw(lines.join('\n'), { html: true, preview: true });
  }
}
