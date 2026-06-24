import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ZenService {
  private readonly logger = new Logger(ZenService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://opencode.ai/zen/v1/chat/completions';
  private readonly model = 'big-pickle';

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.apiKey = cfg.get<string>('ZEN_API_KEY') ?? '';
  }

  async generate(
    prompt: string,
    opts?: { system?: string; maxTokens?: number },
  ): Promise<string | null> {
    if (!this.apiKey) {
      this.logger.warn('ZEN_API_KEY not set, skipping AI generation');
      return null;
    }

    const messages: { role: string; content: string }[] = [];
    if (opts?.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data } = await firstValueFrom(
          this.http.post(
            this.apiUrl,
            {
              model: this.model,
              messages,
              max_tokens: opts?.maxTokens ?? 1000,
              temperature: 0.7,
              stream: false,
            },
            {
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: opts?.maxTokens
                ? Math.max(opts.maxTokens * 50, 120_000)
                : 120_000,
            },
          ),
        );
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return text;

        const reason = data?.choices?.[0]?.finish_reason;
        if (reason === 'length') {
          this.logger.warn('Zen response truncated by max_tokens');
        } else {
          this.logger.warn('Zen returned empty content');
        }
      } catch (err) {
        this.logger.error(
          `Zen API attempt ${attempt} failed: ${(err as Error).message}`,
        );
        if (attempt === 2) return null;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    return null;
  }
}
