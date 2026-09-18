// Internal client-to-client transfers move value between two ledger rows —
// no blockchain transaction is actually broadcast. This fee is still
// enforced as a deliberate platform policy (modeled on real network costs),
// not a technical necessity, so it's a configurable flat table rather than
// anything derived from live gas prices.
const NETWORK_GAS_FEES: Record<string, number> = {
  "USDT:TRC20": 2,
  "USDT:ERC20": 8,
  "USDT:BEP20": 1,
  "USDC:TRC20": 2,
  "USDC:ERC20": 8,
  "USDC:BEP20": 1,
  "BTC:BTC": 0.0001,
  "ETH:ERC20": 0.002,
  "SOL:SOL": 0.005,
  "BNB:BEP20": 0.0005,
  "XRP:XRP": 0.2,
  "ADA:ADA": 1,
  "TRX:TRC20": 5,
};

// Fallback when the specific asset+network pair isn't in the table above,
// keyed by asset symbol alone.
const DEFAULT_GAS_FEE_BY_SYMBOL: Record<string, number> = {
  BTC: 0.0001,
  ETH: 0.002,
  SOL: 0.005,
  BNB: 0.0005,
  XRP: 0.2,
  ADA: 1,
  TRX: 5,
};

/** Flat platform spread applied to every in-portal asset conversion. */
export const SWAP_FEE_RATE = 0.01;

export function getNetworkGasFee(symbol: string, networkName: string): number {
  const key = `${symbol.toUpperCase()}:${networkName.toUpperCase()}`;
  if (key in NETWORK_GAS_FEES) return NETWORK_GAS_FEES[key];
  return DEFAULT_GAS_FEE_BY_SYMBOL[symbol.toUpperCase()] ?? 0.5;
}
