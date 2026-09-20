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

// Fallback oracle when CoinGecko is unreachable or rate-limited. Only
// symbols with a liquid USDT pair on Binance are listed — stablecoins are
// handled separately (see STABLECOIN_SYMBOLS) since SYMBOLUSDT against
// itself isn't a real pair.
const SYMBOL_TO_BINANCE_PAIR: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  BNB: "BNBUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  TRX: "TRXUSDT",
  TON: "TONUSDT",
  DOT: "DOTUSDT",
  MATIC: "MATICUSDT",
  LTC: "LTCUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  SHIB: "SHIBUSDT",
  ATOM: "ATOMUSDT",
  UNI: "UNIUSDT",
  BCH: "BCHUSDT",
  XLM: "XLMUSDT",
  ETC: "ETCUSDT",
  FIL: "FILUSDT",
  APT: "APTUSDT",
  NEAR: "NEARUSDT",
  ARB: "ARBUSDT",
  OP: "OPUSDT",
  ICP: "ICPUSDT",
  XMR: "XMRUSDT",
};

// USD-pegged stablecoins are treated as exactly $1 rather than depending on
// any price oracle at all — this alone removes oracle risk for the asset
// most commonly used to pay fees and move value on the platform.
const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI"]);

interface CachedPrice {
  price: number;
  updatedAt: number;
}

// Last-known-good snapshot, updated on every successful lookup from either
// oracle. Lives only for the lifetime of a warm serverless instance (same
// caveat as the bootstrap flags in lib/bootstrap.ts) — it's a resilience
// backstop for a same-instance outage window, not a durable cache. Entries
// older than CACHE_MAX_AGE_MS are treated as gone rather than risking a
// badly stale price on a fee calculation.
const priceCache = new Map<string, CachedPrice>();
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getCached(symbol: string): number | undefined {
  const entry = priceCache.get(symbol);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > CACHE_MAX_AGE_MS) return undefined;
  return entry.price;
}

function setCached(symbol: string, price: number): void {
  priceCache.set(symbol, { price, updatedAt: Date.now() });
}

async function fetchFromCoinGecko(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols
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
    for (const symbol of symbols) {
      const id = SYMBOL_TO_COINGECKO_ID[symbol];
      const price = id ? data[id]?.usd : undefined;
      if (typeof price === "number") prices[symbol] = price;
    }
    return prices;
  } catch {
    return {};
  }
}

async function fetchFromBinance(symbols: string[]): Promise<Record<string, number>> {
  const pairs = symbols
    .map((symbol) => SYMBOL_TO_BINANCE_PAIR[symbol])
    .filter((pair): pair is string => Boolean(pair));
  if (pairs.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(pairs))}`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return {};

    const data = (await res.json()) as Array<{ symbol: string; price: string }>;
    const pairToPrice = new Map(data.map((row) => [row.symbol, Number(row.price)]));

    const prices: Record<string, number> = {};
    for (const symbol of symbols) {
      const pair = SYMBOL_TO_BINANCE_PAIR[symbol];
      const price = pair ? pairToPrice.get(pair) : undefined;
      if (typeof price === "number" && Number.isFinite(price)) prices[symbol] = price;
    }
    return prices;
  } catch {
    return {};
  }
}

/**
 * Fetches USD spot prices for the given ticker symbols. Never throws, and
 * never depends on a single provider being up: stablecoins resolve to $1
 * without any network call, CoinGecko is tried first for everything else,
 * anything it couldn't price falls back to Binance's public ticker, and
 * anything neither could price falls back to the last successful price
 * seen for that symbol (if not older than 24h). A symbol only ends up
 * missing from the result if it has never been priced by either oracle in
 * this warm instance's lifetime — callers must still treat that as "price
 * unavailable" rather than assume full coverage.
 */
export async function fetchUsdPrices(symbols: string[]): Promise<Record<string, number>> {
  const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const prices: Record<string, number> = {};
  const remaining = new Set(uniqueSymbols);

  for (const symbol of remaining) {
    if (STABLECOIN_SYMBOLS.has(symbol)) {
      prices[symbol] = 1;
      remaining.delete(symbol);
    }
  }

  if (remaining.size > 0) {
    const coingeckoPrices = await fetchFromCoinGecko(Array.from(remaining));
    for (const [symbol, price] of Object.entries(coingeckoPrices)) {
      prices[symbol] = price;
      setCached(symbol, price);
      remaining.delete(symbol);
    }
  }

  if (remaining.size > 0) {
    const binancePrices = await fetchFromBinance(Array.from(remaining));
    for (const [symbol, price] of Object.entries(binancePrices)) {
      prices[symbol] = price;
      setCached(symbol, price);
      remaining.delete(symbol);
    }
  }

  if (remaining.size > 0) {
    for (const symbol of Array.from(remaining)) {
      const cached = getCached(symbol);
      if (cached !== undefined) {
        prices[symbol] = cached;
        remaining.delete(symbol);
      }
    }
  }

  return prices;
}
