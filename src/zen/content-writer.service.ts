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

  async activePick(data: {
    title: string;
    host: string;
    rewardText: string;
    rewardUsd: number | null;
    deadline: Date | null;
    tags: string;
    source: string;
    url: string;
  }, pageContent?: string): Promise<string | null> {
    const reward =
      data.rewardText ||
      (data.rewardUsd ? `$${data.rewardUsd.toLocaleString()}` : '');

    const context = pageContent
      ? `\n\nPage content from the bounty URL:\n${pageContent}`
      : '';

    const prompt = `Write a long-form X post for a verified active web3 bounty that has been live for a while and still accepting submissions.

UK English. No em dashes.

Title: ${data.title}
Reward: ${reward}
Host: ${data.host || data.source}
Deadline: ${data.deadline ? data.deadline.toISOString().slice(0, 10) : 'N/A'}

Structure: hook highlighting that this bounty is still open and actively accepting submissions | what the opportunity is | a clear DETAILS block showing Reward, Host (tag with @ if you know the handle), Deadline | what needs to be built | link | CTA asking to like, RT, follow ${this.handle}, and reply with thoughts

No hashtags. Emphasise that this is a live, active opportunity that people should still apply for. Output only the post text.
${data.url}${context}`;

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

  async weeklyRecap(data: {
    totalCount: number;
    totalUsd: number;
    topBounties: Array<{ title: string; host: string; rewardText: string; rewardUsd: number | null; url: string }>;
    topSources: Array<{ source: string; count: number }>;
    categoryBreakdown: Array<{ category: string; count: number }>;
  }): Promise<string[] | null> {
    const top = data.topBounties
      .map((b, i) => `${i + 1}. ${b.title} — ${b.host} — ${b.rewardText || (b.rewardUsd ? `$${b.rewardUsd.toLocaleString()}` : 'N/A')}`)
      .join('\n');
    const sources = data.topSources
      .map((s) => `${s.source} (${s.count})`)
      .join(', ');
    const cats = data.categoryBreakdown
      .map((c) => `${c.category} (${c.count})`)
      .join(', ');

    const prompt = `Write a 3-tweet thread summarising the past week in web3 bounties.

UK English. No em dashes.

Stats:
- ${data.totalCount} new bounties added
- Total value: $${Math.round(data.totalUsd).toLocaleString()}
- Top 3: ${top}
- Top sources: ${sources}
- Category breakdown: ${cats}

Structure:
Tweet 1: Hook — big picture on the week. Total value and count.
Tweet 2: Breakdown — top sources and most common categories.
Tweet 3: Call to action — follow ${this.handle} for daily bounty radar updates.

No hashtags. Separate each tweet with "---" on its own line. Output only the thread.`;

    const result = await this.zen.generate(prompt, { maxTokens: 8000 });
    if (!result) return null;

    const parts = result.split(/---/).map((s) => s.trim()).filter(Boolean);
    return parts.length >= 2 ? parts : null;
  }

  async engagementPost(topic: string, bounty?: { title: string; host: string; url: string }): Promise<string | null> {
    const ctx = bounty
      ? `\nReference bounty for context:\nTitle: ${bounty.title}\nHost: ${bounty.host}\nURL: ${bounty.url}`
      : '';

    const prompt = `Write a single engaging X post (not a thread) for a web3 bounty radar account.

UK English. No em dashes. No hashtags.

Topic: ${topic}${ctx}

Make it conversation-starting. Ask a question or invite people to share their thoughts. End with a CTA to like, RT, follow ${this.handle}, and reply.

Output only the post.`;

    return this.zen.generate(prompt, { maxTokens: 6000 });
  }

  async tipThread(topic: string): Promise<string[] | null> {
    const prompt = `Write a 4-tweet educational thread for a web3 bounty radar account.

UK English. No em dashes. No hashtags.

Topic: ${topic}

Make it practical and actionable. Each tweet should build on the previous one.
Tweet 1: Hook — why this matters
Tweet 2-3: The actual tips or steps
Tweet 4: Summary + CTA to follow ${this.handle} for more

Separate each tweet with "---" on its own line. Output only the thread.`;

    const result = await this.zen.generate(prompt, { maxTokens: 8000 });
    if (!result) return null;

    const parts = result.split(/---/).map((s) => s.trim()).filter(Boolean);
    return parts.length >= 3 ? parts : null;
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
