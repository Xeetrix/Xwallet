import { fetchUsdPrices } from "@/lib/pricing";

// Maps each network to the asset that actually pays its on-chain gas in
// real life — e.g. TRX pays for every TRC20 transfer no matter which token
// moves. Transfers, withdrawals, and conversions all charge their platform
// fee in this asset, never the asset being moved, mirroring real gas: a
// client needs a balance of the network's native asset to use it at all.
const GAS_ASSET_BY_NETWORK: Record<string, string> = {
  TRC20: "TRX",
  ERC20: "ETH",
  BEP20: "BNB",
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  XRP: "XRP",
  ADA: "ADA",
  TRX: "TRX",
  BNB: "BNB",
};

export const TRANSFER_FEE_RATE = 0.005; // 0.5%
export const WITHDRAWAL_FEE_RATE = 0.01; // 1%
export const CONVERT_FEE_RATE = 0.005; // 0.5%

export function getGasAssetSymbol(networkName: string): string | null {
  return GAS_ASSET_BY_NETWORK[networkName.trim().toUpperCase()] ?? null;
}

export interface NetworkFeeQuote {
  gasAssetSymbol: string;
  feeInGasAsset: number;
}

/**
 * Computes a network fee as `feeRate` of the USD value of `amount` (priced
 * in `assetSymbol`), converted into the network's native gas asset via live
 * pricing. Never throws — returns an { error } object if the network isn't
 * recognized or live pricing is unavailable for either asset, so callers
 * can surface a clear message instead of mis-charging silently.
 */
export async function computeNetworkFee(
  amount: number,
  assetSymbol: string,
  networkName: string,
  feeRate: number
): Promise<NetworkFeeQuote | { error: string }> {
  const gasAssetSymbol = getGasAssetSymbol(networkName);
  if (!gasAssetSymbol) {
    return { error: `"${networkName}" is not a supported network.` };
  }

  const prices = await fetchUsdPrices([assetSymbol, gasAssetSymbol]);
  const assetPrice = prices[assetSymbol.toUpperCase()];
  const gasPrice = prices[gasAssetSymbol.toUpperCase()];

  if (!assetPrice || !gasPrice) {
    return { error: "Live pricing is unavailable right now — please try again shortly." };
  }

  const feeUsd = amount * assetPrice * feeRate;
  const feeInGasAsset = feeUsd / gasPrice;

  return { gasAssetSymbol, feeInGasAsset };
}
