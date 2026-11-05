import { describe, expect, it } from 'vitest';
import type {
  PredictionExecutionQuote,
  PredictionOnchainMarket,
  PredictionMarket,
} from '../../src/predictions';
import { predictionBuyQuote, predictionSellQuote } from '../../src/predictions';
import { validatePredictionQuote } from '../../src/predictions-vault';
import { buildPredictionBuyOrder, buildPredictionSellOrder } from '../../src/predictions';

const route = {
  marketId: 'test',
  network: 'testnet',
  vaultAddress: `0:${'1'.repeat(64)}`,
  marketIndex: '42',
  marketEpoch: 1,
} as PredictionOnchainMarket;
const request = { action: 'buy' as const, outcome: 'yes' as const, collateralBudget: '50000000' };
const quote = {
  ...request,
  marketId: 'test',
  network: 'testnet',
  vault: `0:${'1'.repeat(64)}`,
  marketIndex: '42',
  marketEpoch: 1,
  shares: '250000000',
  gross: '25000000',
  margin: '24750000',
  vaultFinancing: '0',
  payout: '0',
  leverage: '1000000000',
  maxLeverage: '1000000000',
  fee: '250000',
  userDebit: '25000000',
  userCredit: '0',
  collateralLimit: '50000000',
  expiresAt: 1005,
} as PredictionExecutionQuote;

describe('prediction execution quote', () => {
  it('deducts the opening fee from the winning payout using margin and notional', () => {
    expect(predictionBuyQuote(quote)).toMatchObject({ maxPayout: 249_750_000n });
  });
  it('uses server shares and the budget limit without recalculating from the feed', () => {
    expect(predictionBuyQuote(quote)).toEqual({
      shares: 250000000n,
      collateral: 50000000n,
      expectedCollateral: 25000000n,
      fee: 250000n,
      maxPayout: 249750000n,
    });
    expect(
      predictionSellQuote({ ...quote, action: 'sell', collateralLimit: '12500000' }),
    ).toMatchObject({
      shares: 250000000n,
      minProceeds: 12500000n,
    });
  });
  it.each([
    { expiresAt: 1000 },
    { marketEpoch: 2 },
    { outcome: 'no' },
    { collateralLimit: '50000001' },
    { shares: '0' },
    { userDebit: '50000001' },
    { shares: 'NaN' },
    { leverage: '2000000000' },
    { margin: '25000000' },
    { margin: '19750000', userDebit: '20000000' },
    { marketIndex: '43' },
  ])('rejects stale or mismatched quote %j', change => {
    expect(() =>
      validatePredictionQuote(
        { ...quote, ...change } as PredictionExecutionQuote,
        route,
        request,
        1000,
      ),
    ).toThrow();
  });
  it('accepts a matching fresh quote', () => {
    expect(() => validatePredictionQuote(quote, route, request, 1000)).not.toThrow();
  });
  it('puts quoted shares and limits into the actual order builders', () => {
    const market = {
      marketId: 'test',
      status: 'open',
      result: null,
      openTime: 900,
      closeTime: 1200,
    } as PredictionMarket;
    const onchain = {
      ...route,
      provider: 'polymarket' as const,
      providerMarketId: '42',
      tradeCloseAt: 1200,
      deploymentStatus: 'active' as const,
    };
    const buy = buildPredictionBuyOrder({
      market,
      onchain,
      quote: predictionBuyQuote(quote),
      outcomeIndex: 0,
      now: 1000,
      queryId: 1n,
    });
    expect(buy).toMatchObject({ shares: 250000000n, collateralLimit: 50000000n });
    const sell = buildPredictionSellOrder({
      market,
      onchain,
      quote: predictionSellQuote({ ...quote, collateralLimit: '12500000' }),
      outcome: 'yes',
      now: 1000,
      queryId: 2n,
    });
    expect(sell).toMatchObject({ shares: 250000000n, collateralLimit: 12500000n });
  });
});

it('validates sell proceeds from the runtime position payout, including margin and fees', () => {
  const trader = `0:${'2'.repeat(64)}`;
  const sell = { action: 'sell' as const, outcome: 'yes' as const, shares: quote.shares, trader };
  const closeQuote = {
    ...quote,
    ...sell,
    collateralLimit: '19000000',
    margin: '20000000',
    payout: '20000000',
    userDebit: '0',
    userCredit: '20000000',
  };
  expect(() => validatePredictionQuote(closeQuote, route, sell, 1000)).not.toThrow();
  expect(() =>
    validatePredictionQuote({ ...closeQuote, userCredit: '24750000' }, route, sell, 1000),
  ).toThrow();
});

describe('validatePredictionQuote checks every field', () => {
  const MISMATCH = 'Prediction quote is expired or does not match the order';
  const OVER_LIMIT = 'Prediction quote exceeds the order limit';
  const trader = `0:${'2'.repeat(64)}`;
  const sell = { action: 'sell' as const, outcome: 'yes' as const, shares: quote.shares, trader };
  const sellQuote = {
    ...quote,
    ...sell,
    collateralLimit: '19000000',
    payout: '20000000',
    userDebit: '0',
    userCredit: '20000000',
  };

  it.each([
    ['another market', { marketId: 'other' }, MISMATCH],
    ['another network', { network: 'mainnet' }, MISMATCH],
    ['another vault', { vault: `0:${'3'.repeat(64)}` }, MISMATCH],
    ['an unreadable vault', { vault: 'not an address' }, MISMATCH],
    ['another market index', { marketIndex: '43' }, MISMATCH],
    ['another epoch', { marketEpoch: 2 }, MISMATCH],
    ['another leverage', { leverage: '2000000000' }, MISMATCH],
    ['another action', { action: 'sell' }, MISMATCH],
    ['another outcome', { outcome: 'no' }, MISMATCH],
    ['a trader the request has none of', { trader }, MISMATCH],
    ['a fractional expiry', { expiresAt: 1000.5 }, MISMATCH],
    ['an expired quote', { expiresAt: 1000 }, MISMATCH],
    ['an amount that is not an integer', { fee: '1.5' }, MISMATCH],
    ['an amount with a leading zero', { payout: '00' }, MISMATCH],
    ['no shares', { shares: '0' }, MISMATCH],
    ['no collateral limit', { collateralLimit: '0' }, MISMATCH],
    ['a fee that eats the gross', { gross: '250000', userDebit: '250000' }, MISMATCH],
    ['a limit other than the budget', { collateralLimit: '50000001' }, OVER_LIMIT],
    [
      'a debit over the budget',
      { userDebit: '50000001', gross: '50000001', margin: '49750001' },
      OVER_LIMIT,
    ],
    ['a debit other than the gross', { userDebit: '24000000' }, OVER_LIMIT],
    ['a debit other than margin plus fee', { margin: '25000000' }, OVER_LIMIT],
    ['vault financing on a buy', { vaultFinancing: '1' }, OVER_LIMIT],
    ['fewer shares than the gross can pay for', { shares: '24999999' }, OVER_LIMIT],
  ])('rejects a buy quote with %s', (_, change, message) => {
    expect(() =>
      validatePredictionQuote(
        { ...quote, ...change } as PredictionExecutionQuote,
        route,
        request,
        1000,
      ),
    ).toThrow(message);
  });

  it.each([
    ['other shares', { shares: '1' }, OVER_LIMIT],
    ['a limit over the credit', { collateralLimit: '20000001' }, OVER_LIMIT],
    ['a credit other than the payout', { userCredit: '19500000' }, OVER_LIMIT],
    [
      'a payout over the shares',
      { payout: '250000001', userCredit: '250000001', collateralLimit: '250000000' },
      OVER_LIMIT,
    ],
    ['a limit below the default 10% slippage', { collateralLimit: '17999999' }, OVER_LIMIT],
    ['another trader', { trader: `0:${'4'.repeat(64)}` }, MISMATCH],
  ])('rejects a sell quote with %s', (_, change, message) => {
    expect(() =>
      validatePredictionQuote(
        { ...sellQuote, ...change } as PredictionExecutionQuote,
        route,
        sell,
        1000,
      ),
    ).toThrow(message);
  });

  it('accepts a sell limit at the slippage bound the caller allows', () => {
    const quote = { ...sellQuote, collateralLimit: '18000000' };
    expect(() => validatePredictionQuote(quote, route, sell, 1000)).not.toThrow();
    expect(() =>
      validatePredictionQuote(quote, route, sell, 1000, { maxSellSlippageBps: 999 }),
    ).toThrow(OVER_LIMIT);
  });

  it('accepts a matching sell quote', () => {
    expect(() => validatePredictionQuote(sellQuote, route, sell, 1000)).not.toThrow();
  });
});
