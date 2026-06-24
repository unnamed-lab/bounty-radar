import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZenService } from './zen.service';

@Injectable()
export class ContentWriterService {
  private readonly handle: string;

  constructor(
    private readonly zen: ZenService,
    cfg: ConfigService,
  ) {
    this.handle = cfg.get<string>('X_HANDLE') ?? '@unnamedcodes';
  }

  async featuredBounty(
    data: {
      title: string;
      host: string;
      rewardText: string;
      rewardUsd: number | null;
      deadline: Date | null;
      tags: string;
      source: string;
      url: string;
    },
    pageContent: string,
  ): Promise<string | null> {
    const deadline = data.deadline
      ? data.deadline.toISOString().slice(0, 10)
      : 'N/A';
    const reward =
      data.rewardText ||
      (data.rewardUsd ? `$${data.rewardUsd.toLocaleString()}` : 'N/A');

    const details = `Title: ${data.title}
Host: ${data.host || data.source}
Reward: ${reward}
Deadline: ${deadline}
Tags: ${data.tags}
Source: ${data.source}
Link: ${data.url}`;

    const context = pageContent
      ? `\n\nPage content from the bounty URL:\n${pageContent}`
      : '';

    const prompt = `Write a long-form X post for this bounty. UK English. No em dashes.

${details}${context}

Structure: urgency hook with prize | what this bounty is | a clear DETAILS block showing Reward, Host (tag with @ if you know the handle), Deadline | 2-4 paragraph challenge explaining what to build and any key context | what to submit | URL | closing line | CTA asking to like, RT, follow ${this.handle}, and reply with thoughts

No hashtags. Output only the post. No explanation.`;

    const full = await this.zen.generate(prompt, { maxTokens: 10000 });
    if (full) return full;

    const simple = await this.zen.generate(
      `Write a long-form X post about this bounty. UK English. No em dashes.

${details}

Show Reward, Host, Deadline in a clear DETAILS block. Tag the host with @ if you can. No hashtags. End with a CTA asking to like, RT, follow, and reply. Post it now.`,
      { maxTokens: 8000 },
    );
    if (simple) return simple;

    return null;
  }

  async closingSoon(data: {
    title: string;
    host: string;
    rewardText: string;
    rewardUsd: number | null;
    deadline: Date | null;
    source: string;
    url: string;
  }): Promise<string | null> {
    const deadline = data.deadline
      ? data.deadline.toISOString().slice(0, 10)
      : 'N/A';
    const reward =
      data.rewardText ||
      (data.rewardUsd ? `$${data.rewardUsd.toLocaleString()}` : '');
    const daysLeft =
      data.deadline != null
        ? Math.ceil((data.deadline.getTime() - Date.now()) / 86_400_000)
        : null;

    const prompt = `Write a long-form X post for this web3 bounty closing soon.

UK English. No em dashes.

Title: ${data.title}
Reward: ${reward}
Deadline: ${deadline}${daysLeft != null ? ` (${daysLeft}d left)` : ''}
Host: ${data.host || data.source}

Structure: urgency hook | what this bounty is | a clear DETAILS block showing Reward, Host (tag with @ if you know the handle), Deadline with countdown | what needs to be built | link | CTA asking to like, RT, follow ${this.handle}, and reply with thoughts

No hashtags. Make it feel urgent but informative, not spammy. Output only the post text.

${data.url}`;

    const result = await this.zen.generate(prompt, { maxTokens: 8000 });
    if (result) return result;

    return null;
  }

  async freshFind(data: {
    title: string;
    host: string;
    rewardText: string;
    rewardUsd: number | null;
    deadline: Date | null;
    tags: string;
    source: string;
    url: string;
  }): Promise<string | null> {
    const reward =
      data.rewardText ||
      (data.rewardUsd ? `$${data.rewardUsd.toLocaleString()}` : '');

    const prompt = `Write a long-form X post for a newly listed web3 bounty.

UK English. No em dashes.

Title: ${data.title}
Reward: ${reward}
Host: ${data.host || data.source}
Deadline: ${data.deadline ? data.deadline.toISOString().slice(0, 10) : 'N/A'}

Structure: fresh-discovery hook | what this opportunity is | a clear DETAILS block showing Reward, Host (tag with @ if you know the handle), Deadline | what needs to be built | link | CTA asking to like, RT, follow ${this.handle}, and reply with thoughts

No hashtags. Make it feel like a fresh find that people should jump on. Output only the post text.

${data.url}`;

    const result = await this.zen.generate(prompt, { maxTokens: 8000 });
    if (result) return result;

    return null;
  }

  async dailyDropHook(
    count: number,
    totalUsd: number,
  ): Promise<string | null> {
    const prompt = `Write a punchy hook tweet (max 280 chars) for a daily bounty radar.

Today we have ${count} open bounties${totalUsd ? ` worth $${totalUsd.toLocaleString()}+` : ''}.

Make it exciting. Use minimal emojis. Mention Solana and multi-chain. End with a call to follow.

UK English. No em dashes. Just the hook text.`;

    return this.zen.generate(prompt, { maxTokens: 3000 });
  }

  async dailyDropBodyItems(
    items: Array<{
      title: string;
      host: string;
      rewardText: string;
      rewardUsd: number | null;
      deadline: Date | null;
      tags: string;
      url: string;
    }>,
  ): Promise<string[] | null> {
    const lines = items
      .map(
        (b, i) =>
          `${i + 1}. ${b.title} | Reward: ${b.rewardText || (b.rewardUsd ? `$${b.rewardUsd.toLocaleString()}` : 'N/A')} | Host: ${b.host || 'N/A'} | Deadline: ${b.deadline ? b.deadline.toISOString().slice(0, 10) : 'N/A'} | Tags: ${b.tags} | ${b.url}`,
      )
      .join('\n');

    const prompt = `Write ${items.length} short X posts (each max 280 chars) for a daily bounty radar thread.

Each post is one numbered entry in a thread listing open web3 bounties.

Make each one concise and varied. Use minimal emojis. Include the link near the end of each.

Here are the bounties:
${lines}

Output each post separated by "---" on its own line. UK English. No em dashes.`;

    const result = await this.zen.generate(prompt, { maxTokens: 8000 });
    if (!result) return null;

    const parts = result
      .split(/---/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === items.length) return parts;
    return null;
  }

  async dailyDropCTA(): Promise<string | null> {
    const prompt = `Write a short call-to-action tweet (max 280 chars) for a daily bounty radar post.

The post lists open web3 bounties. Ask readers to RT and follow ${this.handle} for more.

UK English. No em dashes. Vary it from "That's today's radar. ♻️ RT to put these on more builders' screens."

Just the CTA text.`;

    return this.zen.generate(prompt, { maxTokens: 3000 });
  }

  async spotlight(
    data: {
      title: string;
      winner: string;
      amountText: string;
      amountUsd: number | null;
      url: string;
      source: string;
    },
    pageContent: string,
  ): Promise<string[] | null> {
    const amt =
      data.amountText ||
      (data.amountUsd ? `$${data.amountUsd.toLocaleString()}` : 'a bounty');
    const who = data.winner || 'A builder';

    const prompt = `Write a short 2-tweet thread celebrating a web3 builder who just got paid.

First tweet: hook announcing "${who} just earned ${amt} for: ${data.title}"
Second tweet: brief explanation of what was achieved + link + CTA to follow ${this.handle}.

UK English. No em dashes. Only URL is ${data.url}.
Inspiring but factual tone.

Page content: ${pageContent || '(unavailable)'}

Separate the two tweets with "---" on its own line.`;

    const result = await this.zen.generate(prompt, { maxTokens: 6000 });
    if (!result) return null;

    const parts = result
      .split(/---/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts.slice(0, 2) : [result];
  }

  async stats(
    total: number,
    count: number,
    topSource: string | null,
  ): Promise<string[] | null> {
    const prompt = `Write a short 2-tweet thread summarising monthly web3 bounty stats.

$${Math.round(total).toLocaleString()} paid out, ${count} bounties closed${topSource ? `, top source: ${topSource}` : ''}.

First tweet: hook with the total paid out. Exciting, big-picture.
Second tweet: breakdown + CTA to follow ${this.handle}.

UK English. No em dashes. Separate the two tweets with "---" on its own line.`;

    const result = await this.zen.generate(prompt, { maxTokens: 4000 });
    if (!result) return null;

    const parts = result
      .split(/---/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts.slice(0, 2) : [result];
  }
}
