const DEFAULT_PRICES: Record<string, number> = {
  sol: 150.0,
  jup: 1.0,
  eth: 3500.0,
  btc: 65000.0,
};

/**
 * Best-effort USD parse for sorting and stats. Converts stablecoins 1:1 and
 * converts standard crypto tokens (SOL, JUP, etc.) using dynamic or fallback rates.
 */
export function parseRewardUsd(text: string, prices?: Record<string, number>): number | undefined {
  const t = (text ?? '').replace(/,/g, '').toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)\s*([km])?/);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1_000;
  if (m[2] === 'm') n *= 1_000_000;

  // Check for stablecoins / USD denominations
  const isUsd = /\$|usd|usdc|usdt|usdg|dai|pyusd/.test(t);
  if (isUsd) return n;

  // Merge dynamic prices with defaults
  const lookup = { ...DEFAULT_PRICES, ...prices };

  // Check for non-stablecoin tokens with dynamic/fallback rates
  for (const [token, rate] of Object.entries(lookup)) {
    if (t.includes(token)) {
      return n * rate;
    }
  }

  return undefined;
}
