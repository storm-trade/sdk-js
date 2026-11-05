import { Address } from '@ton/core';
import { predictionExecutionQuoteSchema } from '../predictions/schemas';
import type {
  PredictionExecutionQuote,
  PredictionOnchainMarket,
  PredictionQuoteRequest,
} from '../predictions/types';
import { PREDICTION_LEVERAGE } from './intents';

const rawAddress = (value: string) => {
  try {
    return Address.parse(value).toRawString();
  } catch {
    return '';
  }
};

type BuyRequest = Extract<PredictionQuoteRequest, { action: 'buy' }>;
type SellRequest = Extract<PredictionQuoteRequest, { action: 'sell' }>;

const isForRoute = (quote: PredictionExecutionQuote, route: PredictionOnchainMarket) => {
  const vault = rawAddress(quote.vault);
  return (
    quote.marketId === route.marketId &&
    quote.network === route.network &&
    Boolean(vault) &&
    vault === rawAddress(route.vaultAddress) &&
    quote.marketIndex === route.marketIndex &&
    quote.marketEpoch === route.marketEpoch &&
    quote.leverage === PREDICTION_LEVERAGE.toString()
  );
};

const isForRequest = (quote: PredictionExecutionQuote, request: PredictionQuoteRequest) =>
  quote.action === request.action &&
  quote.outcome === request.outcome &&
  (quote.trader ?? '') === (request.trader ?? '');

// the shape is the schema's; these are the amounts an order can actually be built from
const hasUsableAmounts = (quote: PredictionExecutionQuote) =>
  BigInt(quote.shares) > 0n &&
  BigInt(quote.collateralLimit) > 0n &&
  BigInt(quote.gross) > BigInt(quote.fee);

const BPS = 10_000n;

// a buy spends at most the budget, all of it the trader's: gross = margin + fee, nothing financed by the vault;
// a share pays at most one collateral unit, so it never costs more than one
const isWithinBuyLimit = (quote: PredictionExecutionQuote, { collateralBudget }: BuyRequest) =>
  BigInt(quote.shares) >= BigInt(quote.gross) &&
  quote.collateralLimit === collateralBudget &&
  BigInt(quote.userDebit) <= BigInt(collateralBudget) &&
  quote.userDebit === quote.gross &&
  BigInt(quote.userDebit) === BigInt(quote.margin) + BigInt(quote.fee) &&
  quote.vaultFinancing === '0';

// a sell closes exactly the requested shares, pays at most one unit per share, is credited the whole payout,
// and its limit sits between the payout and the slippage the caller accepts
const isWithinSellLimit = (
  quote: PredictionExecutionQuote,
  { shares }: SellRequest,
  maxSlippageBps: number,
) =>
  quote.shares === shares &&
  BigInt(quote.payout) <= BigInt(quote.shares) &&
  BigInt(quote.collateralLimit) <= BigInt(quote.userCredit) &&
  BigInt(quote.collateralLimit) * BPS >=
    BigInt(quote.userCredit) * (BPS - BigInt(maxSlippageBps)) &&
  quote.userCredit === quote.payout;

/**
 * Throws unless the quote is for this route and this order, still live, well-formed and within the order's limit.
 * A sell's minimum proceeds may sit at most `maxSellSlippageBps` (default 10%) below the quoted credit.
 */
export const validatePredictionQuote = (
  quote: PredictionExecutionQuote,
  route: PredictionOnchainMarket,
  request: PredictionQuoteRequest,
  now = Date.now() / 1_000,
  { maxSellSlippageBps = 1_000 }: { maxSellSlippageBps?: number } = {},
) => {
  if (
    !predictionExecutionQuoteSchema.safeParse(quote).success ||
    !isForRoute(quote, route) ||
    !isForRequest(quote, request) ||
    quote.expiresAt <= now ||
    !hasUsableAmounts(quote)
  )
    throw new Error('Prediction quote is expired or does not match the order');
  if (
    request.action === 'buy'
      ? !isWithinBuyLimit(quote, request)
      : !isWithinSellLimit(quote, request, maxSellSlippageBps)
  )
    throw new Error('Prediction quote exceeds the order limit');
};
