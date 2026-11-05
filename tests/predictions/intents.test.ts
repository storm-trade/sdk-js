import { describe, expect, it } from 'vitest';
import fixture from './intents.fixture.json';
import {
  buildCancelPredictionOrderIntent,
  buildCreatePredictionOrderIntent,
  buildRedeemPredictionPositionIntent,
} from '../../src/predictions-vault';

const market = { marketIndex: (1n << 64n) - 1n, marketEpoch: 2 };
const order = {
  queryId: 7n,
  market,
  kind: 'market' as const,
  action: 'buy' as const,
  outcome: 'yes' as const,
  shares: 12_345_678n,
  collateralLimit: 10_000_000n,
  deadline: 1_786_113_306,
};

// Wire layout of the deployed Vault contract.
describe('user intents', () => {
  it.each(['buy', 'sell'] as const)(
    'serializes %s with uint64 feed ID and the deployed order terms',
    action => {
      const cell = buildCreatePredictionOrderIntent({ ...order, action });
      expect(cell.toBoc().toString('base64')).toBe(fixture[action]);
      const intent = cell.beginParse();
      expect(intent.loadUint(32)).toBe(0x62af8f6c);
      expect(intent.loadUintBig(64)).toBe(7n);
      expect(intent.loadUintBig(64)).toBe(market.marketIndex);
      const payload = intent.loadRef().beginParse();
      intent.endParse();
      expect(payload.loadUint(2)).toBe(0);
      const body = payload.loadRef().beginParse();
      payload.endParse();
      expect(body.loadUint(1)).toBe(0);
      expect(body.loadCoins()).toBe(order.shares);
      expect(body.loadUint(32)).toBe(order.deadline);
      expect(body.loadUint(32)).toBe(market.marketEpoch);
      expect(body.loadUint(1)).toBe(action === 'buy' ? 0 : 1);
      expect(body.loadCoins()).toBe(order.collateralLimit);
      if (action === 'buy') expect(body.loadUintBig(64)).toBe(1_000_000_000n);
      expect(body.loadUint(2)).toBe(0);
      body.endParse();
    },
  );

  it('serializes cancel-order exactly as the deployed contract expects', () => {
    const intent = buildCancelPredictionOrderIntent({
      queryId: 1_700_000_000_000n,
      marketIndex: 42n,
      orderId: 0,
      traderAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
    });
    expect(intent.toBoc().toString('base64')).toBe(fixture.cancel);
  });

  it('cancels monotonically increasing uint32 order IDs, including IDs above seven', () => {
    const intent = buildCancelPredictionOrderIntent({
      queryId: 7n,
      marketIndex: market.marketIndex,
      orderId: 0xffff_ffff,
      traderAddress: '',
    }).beginParse();
    intent.skip(32 + 64);
    expect(intent.loadUintBig(64)).toBe(market.marketIndex);
    const payload = intent.loadRef().beginParse();
    intent.endParse();
    expect(payload.loadUint(2)).toBe(1);
    expect(payload.loadUint(32)).toBe(0xffff_ffff);
    payload.endParse();
  });

  it('redeems using the backend feed ID', () => {
    const cell = buildRedeemPredictionPositionIntent({ queryId: 7n, market });
    expect(cell.toBoc().toString('base64')).toBe(fixture.redeem);
    const intent = cell.beginParse();
    intent.skip(32 + 64);
    expect(intent.loadUintBig(64)).toBe(market.marketIndex);
    const payload = intent.loadRef().beginParse();
    intent.endParse();
    expect(payload.loadUint(2)).toBe(3);
    payload.endParse();
  });

  it.each(['limit', 'stop'] as const)(
    'encodes %s entry prices as uint32 with the NO sell terms',
    kind => {
      const intent = buildCreatePredictionOrderIntent({
        ...order,
        action: 'sell',
        outcome: 'no',
        kind,
        triggerProbability: 600_000_000n,
      }).beginParse();
      intent.skip(32 + 64 + 64);
      const payload = intent.loadRef().beginParse();
      payload.skip(2);
      const body = payload.loadRef().beginParse();
      expect(body.loadUint(1)).toBe(1);
      expect(body.loadCoins()).toBe(order.shares);
      body.skip(32 + 32);
      expect(body.loadUint(1)).toBe(1);
      expect(body.loadCoins()).toBe(order.collateralLimit);
      expect(body.loadUint(2)).toBe(kind === 'limit' ? 1 : 2);
      expect(body.loadUint(32)).toBe(600_000_000);
      body.endParse();
    },
  );

  it.each([-1, 0x1_0000_0000, 1.5])('rejects invalid cancel order ID %s', orderId => {
    expect(() =>
      buildCancelPredictionOrderIntent({
        queryId: 7n,
        marketIndex: market.marketIndex,
        orderId,
        traderAddress: '',
      }),
    ).toThrow('orderId');
  });

  it('rejects IDs outside uint64 instead of truncating or hashing them', () => {
    expect(() =>
      buildCreatePredictionOrderIntent({ ...order, market: { ...market, marketIndex: 1n << 64n } }),
    ).toThrow('marketIndex');
  });
});
