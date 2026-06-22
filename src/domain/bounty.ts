import { createHash } from 'node:crypto';

export interface Bounty {
  source: string; // "superteam", "layer3", ...
  title: string;
  url: string; // canonical listing link
  reward?: string; // text: "5,000 USDC", "Up to $10k"
  deadline?: string; // ISO or site text
  tags?: string[];
  host?: string; // e.g. XPRIZE, Superteam Germany
}

/**
 * Stable dedupe key. Normalises URL to prevent trailing-slash / protocol dupes.
 */
export function bountyUid(b: Bounty): string {
  let url = b.url.trim();
  // strip trailing slash
  if (url.endsWith('/')) url = url.slice(0, -1);
  // normalise protocol
  url = url.replace(/^https?:\/\//, 'https://');
  const basis = `${b.source}|${url.toLowerCase()}`;
  return createHash('sha256').update(basis).digest('hex');
}
