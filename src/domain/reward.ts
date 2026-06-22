/**
 * Best-effort USD parse for sorting and stats. Returns undefined for
 * crypto-denominated rewards (no price feed in v1) so they still post but
 * don't skew dollar totals.
 */
export function parseRewardUsd(text: string): number | undefined {
  const t = (text ?? '').replace(/,/g, '').toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)\s*([km])?/);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1_000;
  if (m[2] === 'm') n *= 1_000_000;
  const isUsd = /\$|usd|usdc|usdt|dai/.test(t);
  return isUsd ? n : undefined;
}
