import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Bounty } from '../domain/bounty';

@Injectable()
export class TelegramService {
  private readonly apiBase: string;
  private readonly chatId: string;

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.apiBase = `https://api.telegram.org/bot${cfg.get('TG_TOKEN')}`;
    this.chatId = cfg.get<string>('TG_CHAT_ID')!;
  }

  private esc(s: string) {
    return (s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private async call(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await firstValueFrom(
          this.http.post(`${this.apiBase}/${method}`, payload, { timeout: 20_000 }),
        );
        return;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
  }

  /** Send to the configured channel/chat (plain text, HTML-safe). */
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
    await this.call('sendMessage', payload);
  }

  /** Send a reply to an arbitrary chat (used for bot DM responses). */
  async sendTo(chatId: number | string, text: string): Promise<void> {
    await this.call('sendMessage', {
      chat_id: String(chatId),
      text,
    });
  }

  /** Fetch updates for bot command polling. */
  async getUpdates(offset?: number): Promise<any[]> {
    const payload: Record<string, unknown> = { timeout: 5 };
    if (offset != null) payload.offset = offset;
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.apiBase}/getUpdates`, payload, { timeout: 10_000 }),
      );
      return data.ok ? (data.result ?? []) : [];
    } catch {
      return [];
    }
  }

  /** Send a thread as numbered, separate plain-text messages for copy-paste. */
  async sendThread(tweets: string[], header: string): Promise<void> {
    await this.sendRaw(`📝 ${header} — copy ${tweets.length} tweets in order 👇`);
    for (let i = 0; i < tweets.length; i++) {
      await this.sendRaw(`— ${i + 1}/${tweets.length} —\n\n${tweets[i]}`);
      await new Promise((r) => setTimeout(r, 400));
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
