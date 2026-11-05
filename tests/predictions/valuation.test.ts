import { describe, expect, it } from 'vitest';
import type { PredictionMarket, PredictionPositionView } from '../../src/predictions';
import { pnlReturnBps, valuePosition } from '../../src/predictions';

const position = (overrides: Partial<PredictionPositionView> = {}): PredictionPositionView =>
  ({
    outcomes: {
      yes: { shares: '100000000', costBasis: '50000000' },
      no: { shares: '0', costBasis: '0' },
    },
    costBasis: '50000000',
    realizedPnl: '1000000',
    markValue: '55000000',
    ...overrides,
  }) as unknown as PredictionPositionView;

const market = (yesBid: number | null, noBid: number | null) =>
  ({
    outcomes: [{ pricing: { bidPriceUsd: yesBid } }, { pricing: { bidPriceUsd: noBid } }],
  }) as unknown as PredictionMarket;

describe('valuePosition', () => {
  it('prefers the position result over missing or conflicting recent resolution history', () => {
    for (const historyResult of [null, 'no'] as const) {
      const resolvedPosition = { ...position(), result: 'yes' as const };
      expect(valuePosition(resolvedPosition, market(600000, 400000), historyResult)).toMatchObject({
        markValue: 100000000n,
        source: 'resolved',
        result: 'yes',
      });
    }
  });

  it('pays one collateral unit per winning claim once the market resolved', () => {
    expect(valuePosition(position(), null, 'yes')).toEqual({
      markValue: 100000000n,
      unrealizedPnl: 50000000n,
      totalPnl: 51000000n,
      source: 'resolved',
      result: 'yes',
    });
    expect(valuePosition(position(), market(600000, 400000), 'no')).toMatchObject({
      markValue: 0n,
      unrealizedPnl: -50000000n,
      source: 'resolved',
    });
    expect(valuePosition(position(), null, 'void')).toMatchObject({
      markValue: 50000000n,
      unrealizedPnl: 0n,
      source: 'resolved',
    });
  });

  it('marks open positions by the live bid', () => {
    expect(valuePosition(position(), market(600000, 400000), null)).toMatchObject({
      markValue: 60000000n,
      unrealizedPnl: 10000000n,
      totalPnl: 11000000n,
      source: 'live',
    });
  });

  it('prefers the live ticker and recovers the bid from mid and ask', () => {
    expect(
      valuePosition(position(), market(600000, 400000), null, {
        askPriceUsdQ6: [700000, 350000],
        probabilityQ6: [650000, 350000],
      }),
    ).toMatchObject({
      markValue: 60000000n,
      source: 'live',
    });
  });

  it('falls back to the backend snapshot and then to nothing', () => {
    expect(valuePosition(position(), market(null, 400000), null)).toMatchObject({
      markValue: 55000000n,
      source: 'backend',
    });
    expect(valuePosition(position({ markValue: null }), null, null)).toBeNull();
  });
});

describe('pnlReturnBps', () => {
  it('relates the PnL to the cost basis of a position that never sold', () => {
    expect(pnlReturnBps(-41_620_000n, { costBasis: '42720000', realizedPnl: '0' })).toBe(-9_742n);
  });
  it('has no percentage once shares were sold: the cost basis left no longer covers the realized part', () => {
    // the reported row: -$71.61 total on a $42.72 basis read as -167.60%
    expect(
      pnlReturnBps(-71_610_000n, { costBasis: '42720000', realizedPnl: '-29990000' }),
    ).toBeNull();
    expect(pnlReturnBps(5_000_000n, { costBasis: '0', realizedPnl: '0' })).toBeNull();
  });
});
