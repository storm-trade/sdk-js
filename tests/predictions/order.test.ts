import { describe, expect, it } from 'vitest';
import type { PredictionMarket, PredictionOnchainMarket } from '../../src/predictions';
import {
  buildPredictionBuyOrder,
  buildPredictionSellOrder,
  isPredictionMarketOpenForTrading,
  parsePredictionCollateral,
} from '../../src/predictions';

const market = {
  marketId: 'polymarket:btc-5m',
  status: 'open',
  result: null,
  openTime: 100,
  closeTime: 400,
} as PredictionMarket;

const onchain = {
  marketId: market.marketId,
  address: 'EQMarket',
  provider: 'polymarket',
  providerMarketId: '42',
  marketIndex: '18446744073709551615',
  marketEpoch: 3,
  tradeCloseAt: 340,
  deploymentStatus: 'active',
} as PredictionOnchainMarket;

describe('prediction order', () => {
  it('parses USDT without floating-point rounding', () => {
    expect(parsePredictionCollateral('10.123456')).toBe(10_123_456n);
    expect(parsePredictionCollateral('0.000001')).toBe(1n);
    expect(parsePredictionCollateral('1.0000001')).toBeNull();
    expect(parsePredictionCollateral('0')).toBeNull();
  });

  it('builds a market buy bounded by the on-chain trade close', () => {
    const quote = {
      collateral: 10_000_000n,
      expectedCollateral: 9_000_000n,
      fee: 0n,
      shares: 33_333_333n,
      maxPayout: 33_243_333n,
    };
    expect(
      buildPredictionBuyOrder({ market, onchain, outcomeIndex: 1, quote, now: 300, queryId: 7n }),
    ).toEqual({
      queryId: 7n,
      market: { marketIndex: 18446744073709551615n, marketEpoch: 3 },
      kind: 'market',
      action: 'buy',
      outcome: 'no',
      shares: quote.shares,
      collateralLimit: quote.collateral,
      deadline: 340,
    });
  });

  it('keeps a market order executable until the on-chain trade close', () => {
    const quote = {
      collateral: 10_000_000n,
      expectedCollateral: 9_000_000n,
      fee: 0n,
      shares: 33_333_333n,
      maxPayout: 33_243_333n,
    };
    const order = buildPredictionBuyOrder({
      market,
      onchain: { ...onchain, tradeCloseAt: 390 },
      outcomeIndex: 0,
      quote,
      now: 200,
      queryId: 8n,
    });

    expect(order.deadline).toBe(390);
  });

  it.each(['EQMarket', undefined])(
    'accepts buys until the last 15 seconds with market address %s',
    address => {
      const route = { ...onchain, address, tradeCloseAt: market.closeTime };
      expect(isPredictionMarketOpenForTrading(market, route, market.closeTime - 60)).toBe(true);
      expect(isPredictionMarketOpenForTrading(market, route, market.closeTime - 16)).toBe(true);
      expect(isPredictionMarketOpenForTrading(market, route, market.closeTime - 15)).toBe(false);
      expect(isPredictionMarketOpenForTrading(market, route, market.closeTime - 14)).toBe(false);
      expect(isPredictionMarketOpenForTrading(market, route, market.closeTime)).toBe(false);
      expect(isPredictionMarketOpenForTrading(market, route, market.openTime - 1)).toBe(false);

      const quote = {
        collateral: 10_000_000n,
        expectedCollateral: 9_000_000n,
        fee: 0n,
        shares: 33_333_333n,
        maxPayout: 33_243_333n,
      };
      expect(
        buildPredictionBuyOrder({
          market,
          onchain: route,
          outcomeIndex: 0,
          quote,
          now: market.closeTime - 16,
          queryId: 9n,
        }).deadline,
      ).toBe(market.closeTime);
      expect(() =>
        buildPredictionBuyOrder({
          market,
          onchain: route,
          outcomeIndex: 0,
          quote,
          now: market.closeTime - 15,
          queryId: 9n,
        }),
      ).toThrow('closed for trading');
    },
  );

  it('respects an earlier on-chain close and never accepts past the event cutoff', () => {
    expect(isPredictionMarketOpenForTrading(market, onchain, onchain.tradeCloseAt - 16)).toBe(true);
    expect(isPredictionMarketOpenForTrading(market, onchain, onchain.tradeCloseAt - 15)).toBe(
      false,
    );
    expect(
      isPredictionMarketOpenForTrading(
        market,
        { ...onchain, tradeCloseAt: 500 },
        market.closeTime - 15,
      ),
    ).toBe(false);
  });

  it('rejects stale or mismatched mappings before opening TON Connect', () => {
    const quote = {
      collateral: 10_000_000n,
      expectedCollateral: 9_000_000n,
      fee: 0n,
      shares: 33_333_333n,
      maxPayout: 33_243_333n,
    };
    expect(() =>
      buildPredictionBuyOrder({
        market,
        onchain: { ...onchain, marketId: 'other' },
        outcomeIndex: 0,
        quote,
        now: 200,
        queryId: 7n,
      }),
    ).toThrow('mapping mismatch');
    expect(() =>
      buildPredictionBuyOrder({ market, onchain, outcomeIndex: 0, quote, now: 331, queryId: 7n }),
    ).toThrow('closed for trading');
  });

  it('builds a market sell of the whole side, bounded by the on-chain trade close', () => {
    const quote = { shares: 100_000_000n, minProceeds: 50_000_000n };
    expect(
      buildPredictionSellOrder({ market, onchain, outcome: 'yes', quote, now: 300, queryId: 7n }),
    ).toEqual({
      queryId: 7n,
      market: { marketIndex: 18446744073709551615n, marketEpoch: 3 },
      kind: 'market',
      action: 'sell',
      outcome: 'yes',
      shares: 100_000_000n,
      collateralLimit: 50_000_000n,
      deadline: 340,
    });
    expect(() =>
      buildPredictionSellOrder({ market, onchain, outcome: 'yes', quote, now: 330, queryId: 7n }),
    ).toThrow('Market is closed for trading');
  });

  it('ends a market order when trading ends, not at a later on-chain close', () => {
    const quote = { shares: 100_000_000n, minProceeds: 50_000_000n };
    const order = buildPredictionSellOrder({
      market,
      onchain: { ...onchain, tradeCloseAt: 500 },
      outcome: 'yes',
      quote,
      now: 300,
      queryId: 7n,
    });

    expect(order.deadline).toBe(market.closeTime);
  });

  it.each([
    ['a closed market', { status: 'closed' }],
    ['a market with a result', { result: 'yes' }],
  ])('refuses to trade %s', (_, change) => {
    expect(
      isPredictionMarketOpenForTrading({ ...market, ...change } as PredictionMarket, onchain, 200),
    ).toBe(false);
  });

  it('trades a market whose first buy still deploys it on-chain', () => {
    expect(
      isPredictionMarketOpenForTrading(market, { ...onchain, deploymentStatus: 'pending' }, 200),
    ).toBe(true);
  });
});
