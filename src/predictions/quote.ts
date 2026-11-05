import type { PredictionBuyQuote, PredictionSellQuote } from './order';
import type { PredictionExecutionQuote } from './types';

export const predictionBuyQuote = (quote: PredictionExecutionQuote): PredictionBuyQuote => {
  const shares = BigInt(quote.shares);
  const collateral = BigInt(quote.collateralLimit);
  return {
    shares,
    collateral,
    expectedCollateral: BigInt(quote.userDebit),
    fee: BigInt(quote.fee),
    maxPayout: BigInt(quote.margin) + shares - BigInt(quote.gross),
  };
};

export const predictionSellQuote = (quote: PredictionExecutionQuote): PredictionSellQuote => {
  const shares = BigInt(quote.shares);
  const minProceeds = BigInt(quote.collateralLimit);
  return { shares, minProceeds };
};
