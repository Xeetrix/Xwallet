// Maps common ticker symbols to CoinGecko API IDs. Admins can add any
// symbol as an Asset, so coverage here is necessarily partial — assets
// outside this list simply have no USD conversion available, and callers
// must degrade gracefully (omit from totals) rather than guess.
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  TON: "the-open-network",
  DOT: "polkadot",
  MATIC: "matic-network",
  LTC: "litecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  SHIB: "shiba-inu",
  DAI: "dai",
  ATOM: "cosmos",
  UNI: "uniswap",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  ETC: "ethereum-classic",
  FIL: "filecoin",
  APT: "aptos",
  NEAR: "near",
  ARB: "arbitrum",
  OP: "optimism",
  ICP: "internet-computer",
  XMR: "monero",
};

/**
 * Fetches USD spot prices for the given ticker symbols from CoinGecko's
 * public API. Never throws — on any failure (network, rate limit, timeout)
 * it returns an empty map so callers can render "price unavailable" rather
 * than crash the page over a third-party outage.
 */
export async function fetchUsdPrices(symbols: string[]): Promise<Record<string, number>> {
  const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const ids = uniqueSymbols
    .map((symbol) => SYMBOL_TO_COINGECKO_ID[symbol])
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return {};

    const data = (await res.json()) as Record<string, { usd?: number }>;
    const prices: Record<string, number> = {};

    for (const symbol of uniqueSymbols) {
      const id = SYMBOL_TO_COINGECKO_ID[symbol];
      const price = id ? data[id]?.usd : undefined;
      if (typeof price === "number") prices[symbol] = price;
    }
    return prices;
  } catch {
    return {};
  }
}
