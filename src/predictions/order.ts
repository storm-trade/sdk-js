import type { PredictionMarket, PredictionOnchainMarket } from './types';
import type { PredictionOrderRequest } from '../predictions-vault/intents';

const COLLATERAL_UNIT = 1_000_000n;
const MIN_EXECUTION_LEAD_TIME_SECONDS = 15;

export interface PredictionBuyQuote {
  collateral: bigint;
  expectedCollateral: bigint;
  /** The protocol fee inside expectedCollateral. */
  fee: bigint;
  maxPayout: bigint;
  shares: bigint;
}

export interface PredictionSellQuote {
  shares: bigint;
  /** Minimum collateral returned after the protocol fee. */
  minProceeds: bigint;
}

export const parsePredictionCollateral = (value: string): bigint | null => {
  if (!/^(0|[1-9]\d*)(\.\d{0,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * COLLATERAL_UNIT + BigInt(fraction.padEnd(6, '0'));
  return amount > 0n ? amount : null;
};

const tradingClosesAt = (market: PredictionMarket, onchain: PredictionOnchainMarket) =>
  Math.min(market.closeTime, onchain.tradeCloseAt);

export const isPredictionMarketOpenForTrading = (
  market: PredictionMarket,
  onchain: PredictionOnchainMarket,
  now: number,
) =>
  market.status === 'open' &&
  market.result === null &&
  now >= market.openTime &&
  now < tradingClosesAt(market, onchain) - MIN_EXECUTION_LEAD_TIME_SECONDS;

type OrderContext = {
  market: PredictionMarket;
  onchain: PredictionOnchainMarket;
  now: number;
  queryId: bigint;
};

/** A market order on the mapped on-chain market, refused once the market no longer trades. */
const marketOrder = (
  { market, onchain, now, queryId }: OrderContext,
  order: Pick<PredictionOrderRequest, 'action' | 'outcome' | 'shares' | 'collateralLimit'>,
): PredictionOrderRequest => {
  if (onchain.marketId !== market.marketId) throw new Error('On-chain market mapping mismatch');
  if (!isPredictionMarketOpenForTrading(market, onchain, now))
    throw new Error('Market is closed for trading');
  return {
    queryId,
    market: { marketIndex: BigInt(onchain.marketIndex), marketEpoch: onchain.marketEpoch },
    kind: 'market',
    ...order,
    deadline: tradingClosesAt(market, onchain),
  };
};

export const buildPredictionBuyOrder = ({
  outcomeIndex,
  quote,
  ...context
}: OrderContext & { outcomeIndex: 0 | 1; quote: PredictionBuyQuote }) =>
  marketOrder(context, {
    action: 'buy',
    outcome: outcomeIndex === 0 ? 'yes' : 'no',
    shares: quote.shares,
    collateralLimit: quote.collateral,
  });

export const buildPredictionSellOrder = ({
  outcome,
  quote,
  ...context
}: OrderContext & { outcome: 'yes' | 'no'; quote: PredictionSellQuote }) =>
  marketOrder(context, {
    action: 'sell',
    outcome,
    shares: quote.shares,
    collateralLimit: quote.minProceeds,
  });
