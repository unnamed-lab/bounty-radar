import { createHash } from 'node:crypto';

export interface Bounty {
  source: string; // "superteam", "layer3", ...
  title: string;
  url: string; // canonical listing link
  reward?: string; // text: "5,000 USDC", "Up to $10k"
  deadline?: string; // ISO or site text
  tags?: string[];
}

/**
 * Stable dedupe key. URL is the best basis when permanent. If a site rotates
 * URLs/query params, switch the basis to `${source}|${title}|${reward}`.
 */
export function bountyUid(b: Bounty): string {
  const basis = `${b.source}|${b.url.trim().toLowerCase()}`;
  return createHash('sha256').update(basis).digest('hex');
}
