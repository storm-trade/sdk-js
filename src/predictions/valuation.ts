import type {
  PredictionMarket,
  PredictionMarketTickerUpdate,
  PredictionPositionView,
  PredictionResolutionResult,
} from './types';

const PRICE_Q6 = 1_000_000n;

type PositionValuationSource = 'resolved' | 'live' | 'backend';

export interface PositionValuation {
  markValue: bigint;
  unrealizedPnl: bigint;
  totalPnl: bigint;
  source: PositionValuationSource;
  result: PredictionResolutionResult | null;
}

// Backend marks positions by the catalog bid and returns null once a market leaves the catalog.
// The UI keeps valuing them: resolved markets pay 1.00 per winning claim (VOID refunds cost),
// open markets use the live bid, and only then the backend snapshot is trusted.
// The ticker socket carries ask and mid (probability); the bid is recovered as 2 * mid - ask.
export const liveBidsQ6 = (
  ticker: Pick<PredictionMarketTickerUpdate, 'askPriceUsdQ6' | 'probabilityQ6'>,
): [number, number] => [
  Math.min(Number(PRICE_Q6), Math.max(0, 2 * ticker.probabilityQ6[0] - ticker.askPriceUsdQ6[0])),
  Math.min(Number(PRICE_Q6), Math.max(0, 2 * ticker.probabilityQ6[1] - ticker.askPriceUsdQ6[1])),
];

export const valuePosition = (
  position: PredictionPositionView,
  market: PredictionMarket | null | undefined,
  result: PredictionResolutionResult | null | undefined,
  ticker?: Pick<PredictionMarketTickerUpdate, 'askPriceUsdQ6' | 'probabilityQ6'> | null,
): PositionValuation | null => {
  result = position.result ?? result;
  const yesShares = BigInt(position.outcomes.yes.shares);
  const noShares = BigInt(position.outcomes.no.shares);
  const costBasis = BigInt(position.costBasis);
  const realizedPnl = BigInt(position.realizedPnl);
  const finish = (markValue: bigint, source: PositionValuationSource): PositionValuation => {
    const unrealizedPnl = markValue - costBasis;
    return {
      markValue,
      unrealizedPnl,
      totalPnl: realizedPnl + unrealizedPnl,
      source,
      result: result ?? null,
    };
  };

  if (yesShares === 0n && noShares === 0n) return finish(0n, 'backend');

  if (result === 'yes') return finish(yesShares, 'resolved');
  if (result === 'no') return finish(noShares, 'resolved');
  if (result === 'void') return finish(costBasis, 'resolved');

  if (ticker) {
    const bids = liveBidsQ6(ticker);
    return finish((yesShares * BigInt(bids[0]) + noShares * BigInt(bids[1])) / PRICE_Q6, 'live');
  }

  const yesBid = market?.outcomes[0].pricing.bidPriceUsd;
  const noBid = market?.outcomes[1].pricing.bidPriceUsd;
  if (market && yesBid !== null && yesBid !== undefined && noBid !== null && noBid !== undefined) {
    return finish((yesShares * BigInt(yesBid) + noShares * BigInt(noBid)) / PRICE_Q6, 'live');
  }

  return position.markValue === null ? null : finish(BigInt(position.markValue), 'backend');
};

/**
 * PnL as basis points of what was paid for the shares held. The cost basis only covers the shares left,
 * so once some were sold the realized part has no basis to relate to and there is no honest percentage.
 */
export const pnlReturnBps = (
  pnl: bigint,
  position: Pick<PredictionPositionView, 'costBasis' | 'realizedPnl'>,
): bigint | null => {
  const costBasis = BigInt(position.costBasis);
  return costBasis > 0n && BigInt(position.realizedPnl) === 0n ? (pnl * 10_000n) / costBasis : null;
};
