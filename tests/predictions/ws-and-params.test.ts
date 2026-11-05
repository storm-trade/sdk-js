import { describe, expect, it } from 'vitest';
import {
  createPredictionEventsSearchParams,
  createPredictionResolutionsSearchParams,
  parsePredictionWsMessage,
} from '../../src/predictions';
import { pack } from 'msgpackr/pack';

describe('createPredictionEventsSearchParams', () => {
  it('requests market data and count for the full catalog', () => {
    const params = createPredictionEventsSearchParams({ start: 0, end: 20 });

    expect(Object.fromEntries(params)).toEqual({
      includeMarkets: 'true',
      start: '0',
      end: '20',
      includeCount: 'true',
    });
  });

  it('adds category, timeframe tags, and live filter when selected', () => {
    const params = createPredictionEventsSearchParams({
      category: 'crypto',
      tags: ['5m', '15m'],
      filter: 'live',
      start: 20,
      end: 40,
      includeCount: false,
    });

    expect(Object.fromEntries(params)).toEqual({
      includeMarkets: 'true',
      start: '20',
      end: '40',
      includeCount: 'false',
      category: 'crypto',
      tags: '5m,15m',
      filter: 'live',
    });
  });
});

describe('createPredictionResolutionsSearchParams', () => {
  it('requests BTC resolution history for both short timeframes', () => {
    const params = createPredictionResolutionsSearchParams({
      assetId: 'BTC',
      durationMinutes: [5, 15],
      limit: 8,
    });

    expect(Object.fromEntries(params)).toEqual({
      assetId: 'btc',
      durationMinutes: '5,15',
      limit: '8',
    });
  });
});

describe('parsePredictionWsMessage', () => {
  it('parses compact v2 ticker and recovery messages', () => {
    const ready = parsePredictionWsMessage({
      data: JSON.stringify({
        type: 'subscriptionReady',
        v: 2,
        subscriptionId: 1,
        cursor: '42',
        sequence: 0,
      }),
    } as MessageEvent);
    const batch = parsePredictionWsMessage({
      data: JSON.stringify({
        type: 'marketTickerBatch',
        v: 2,
        subscriptionId: 1,
        sequence: 1,
        cursor: '43',
        asOfMs: 1_785_968_412_000,
        markets: [
          {
            marketId: 'polymarket:btc-5m',
            askPriceUsdQ6: [980_000, 990_000],
            probabilityQ6: [495_000, 505_000],
          },
        ],
      }),
    } as MessageEvent);
    const catalogChanged = parsePredictionWsMessage({
      data: JSON.stringify({
        type: 'catalogChanged',
        v: 2,
        subscriptionId: 1,
        sequence: 2,
        cursor: '44',
        eventIds: ['btc-5m'],
        reason: 'rotation',
      }),
    } as MessageEvent);
    const resync = parsePredictionWsMessage({
      data: JSON.stringify({
        type: 'resyncRequired',
        v: 2,
        subscriptionId: 1,
        reason: 'cursorExpired',
      }),
    } as MessageEvent);

    expect(ready).toEqual({
      type: 'subscriptionReady',
      v: 2,
      subscriptionId: 1,
      cursor: '42',
      sequence: 0,
    });
    expect(batch).toEqual({
      type: 'marketTickerBatch',
      v: 2,
      subscriptionId: 1,
      sequence: 1,
      cursor: '43',
      asOfMs: 1_785_968_412_000,
      markets: [
        {
          marketId: 'polymarket:btc-5m',
          askPriceUsdQ6: [980_000, 990_000],
          probabilityQ6: [495_000, 505_000],
        },
      ],
    });
    expect(catalogChanged).toEqual({
      type: 'catalogChanged',
      v: 2,
      subscriptionId: 1,
      sequence: 2,
      cursor: '44',
      eventIds: ['btc-5m'],
      reason: 'rotation',
    });
    expect(resync).toEqual({
      type: 'resyncRequired',
      v: 2,
      subscriptionId: 1,
      reason: 'cursorExpired',
    });
  });

  it('parses a compact MessagePack ticker batch with its negotiated market slots', () => {
    const data = pack([1, 1, 7, '43', 1_785_968_412_000, [[1, 980_000, 990_000, 495_000]]]);

    expect(
      parsePredictionWsMessage(
        {
          data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        } as MessageEvent,
        ['polymarket:btc-5m', 'polymarket:eth-5m'],
      ),
    ).toEqual({
      type: 'marketTickerBatch',
      v: 2,
      subscriptionId: 1,
      sequence: 7,
      cursor: '43',
      asOfMs: 1_785_968_412_000,
      markets: [
        {
          marketId: 'polymarket:eth-5m',
          askPriceUsdQ6: [980_000, 990_000],
          probabilityQ6: [495_000, 505_000],
        },
      ],
    });
  });

  it('ignores malformed messages', () => {
    expect(parsePredictionWsMessage({ data: '{' } as MessageEvent)).toBeNull();
    expect(
      parsePredictionWsMessage({
        data: JSON.stringify({
          type: 'marketTickerBatch',
          v: 2,
          subscriptionId: 1,
          sequence: 1,
          cursor: '43',
          asOfMs: 1_785_968_412_000,
          markets: [{ marketId: 'polymarket:btc-5m', askPriceUsdQ6: [512_000] }],
        }),
      } as MessageEvent),
    ).toBeNull();
    expect(
      parsePredictionWsMessage({
        data: JSON.stringify({
          type: 'marketTickerBatch',
          v: 2,
          subscriptionId: 1,
          sequence: 1,
          cursor: '43',
          asOfMs: 1_785_968_412_000,
          markets: [
            {
              marketId: 'polymarket:btc-5m',
              askPriceUsdQ6: [980_000, 990_000],
              probabilityQ6: [990_000, 990_000],
            },
          ],
        }),
      } as MessageEvent),
    ).toBeNull();
  });
});

describe('parsePredictionWsMessage rejects every malformed field', () => {
  const ticker = {
    marketId: 'polymarket:btc-5m',
    askPriceUsdQ6: [980_000, 990_000],
    probabilityQ6: [495_000, 505_000],
  };
  const batch = {
    type: 'marketTickerBatch',
    v: 2,
    subscriptionId: 1,
    sequence: 1,
    cursor: '43',
    asOfMs: 1_785_968_412_000,
    markets: [ticker],
  };
  const json = (value: object) =>
    parsePredictionWsMessage({ data: JSON.stringify(value) } as MessageEvent);
  const msgpack = (value: unknown[], marketIds = ['polymarket:btc-5m']) => {
    const data = pack(value);
    return parsePredictionWsMessage(
      {
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      } as MessageEvent,
      marketIds,
    );
  };

  it.each([
    ['an unknown type', { type: 'hello', subscriptionId: 1 }],
    ['a fractional subscription id', { type: 'subscribed', subscriptionId: 1.5 }],
    ['an error that is not text', { type: 'subscriptionError', subscriptionId: 1, error: 42 }],
    [
      'a ready message of another version',
      { type: 'subscriptionReady', v: 1, subscriptionId: 1, cursor: '1', sequence: 0 },
    ],
    [
      'a negative sequence',
      { type: 'subscriptionReady', v: 2, subscriptionId: 1, cursor: '1', sequence: -1 },
    ],
    [
      'an unknown encoding',
      {
        type: 'subscriptionReady',
        v: 2,
        subscriptionId: 1,
        cursor: '1',
        sequence: 0,
        encoding: 'cbor',
      },
    ],
    [
      'msgpack without market ids',
      {
        type: 'subscriptionReady',
        v: 2,
        subscriptionId: 1,
        cursor: '1',
        sequence: 0,
        encoding: 'msgpack',
      },
    ],
    [
      'a market id that is not text',
      {
        type: 'subscriptionReady',
        v: 2,
        subscriptionId: 1,
        cursor: '1',
        sequence: 0,
        encoding: 'msgpack',
        marketIds: [1],
      },
    ],
    ['a batch without a time', { ...batch, asOfMs: undefined }],
    [
      'a fractional ask',
      { ...batch, markets: [{ ...ticker, askPriceUsdQ6: [980_000.5, 990_000] }] },
    ],
    [
      'a negative probability',
      { ...batch, markets: [{ ...ticker, probabilityQ6: [-1, 1_000_001] }] },
    ],
    [
      'probabilities that do not add up',
      { ...batch, markets: [{ ...ticker, probabilityQ6: [495_000, 495_000] }] },
    ],
    ['a ticker without its market', { ...batch, markets: [{ ...ticker, marketId: 7 }] }],
    [
      'an unknown catalog reason',
      {
        type: 'catalogChanged',
        v: 2,
        subscriptionId: 1,
        sequence: 2,
        cursor: '44',
        eventIds: ['a'],
        reason: 'other',
      },
    ],
    [
      'an event id that is not text',
      {
        type: 'catalogChanged',
        v: 2,
        subscriptionId: 1,
        sequence: 2,
        cursor: '44',
        eventIds: [1],
        reason: 'status',
      },
    ],
    ['a resync without a reason', { type: 'resyncRequired', v: 2, subscriptionId: 1 }],
  ])('a JSON message with %s', (_, value) => {
    expect(json(value)).toBeNull();
  });

  it.each([
    ['another version', [2, 1, 7, '43', 1, [[0, 1, 2, 3]]]],
    ['a short envelope', [1, 1, 7, '43', 1]],
    ['a slot outside the negotiated markets', [1, 1, 7, '43', 1, [[5, 980_000, 990_000, 495_000]]]],
    ['an Up probability over one', [1, 1, 7, '43', 1, [[0, 980_000, 990_000, 1_000_001]]]],
    ['a short row', [1, 1, 7, '43', 1, [[0, 980_000, 990_000]]]],
  ])('a MessagePack batch with %s', (_, value) => {
    expect(msgpack(value)).toBeNull();
  });

  it('reads a msgpack-encoded ready message with its market slots', () => {
    expect(
      json({
        type: 'subscriptionReady',
        v: 2,
        subscriptionId: 1,
        cursor: '1',
        sequence: 0,
        encoding: 'msgpack',
        marketIds: ['a'],
      }),
    ).toEqual({
      type: 'subscriptionReady',
      v: 2,
      subscriptionId: 1,
      cursor: '1',
      sequence: 0,
      encoding: 'msgpack',
      marketIds: ['a'],
    });
  });
});
