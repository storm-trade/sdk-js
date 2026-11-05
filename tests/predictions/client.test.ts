import { describe, expect, it, vi } from 'vitest';
import {
  fetchTransport,
  isQuoteOutsideBounds,
  PredictionsClient,
  PredictionsHttpError,
  type PredictionsRequest,
} from '../../src/predictions';

const recording = (...responses: unknown[]) => {
  const transport = vi.fn<(request: PredictionsRequest) => Promise<unknown>>(async () => {
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return { client: new PredictionsClient(transport as never), transport };
};

describe('catalog pagination', () => {
  it('loads later pages and retains the first cursor for live recovery', async () => {
    const { client, transport } = recording(
      {
        data: [{ eventId: 'round' }],
        pagination: { start: 0, end: 100, hasNext: true },
        snapshotCursor: '1',
      },
      {
        data: [{ eventId: 'crypto-event' }],
        pagination: { start: 100, end: 101, hasNext: false },
        snapshotCursor: '2',
      },
    );
    const catalog = await client.catalog();
    expect(catalog.data.map(({ eventId }) => eventId)).toEqual(['round', 'crypto-event']);
    expect(catalog.snapshotCursor).toBe('1');
    expect(Object.fromEntries(transport.mock.calls[1][0].params!)).toMatchObject({
      start: '100',
      end: '200',
    });
  });
});

describe('account requests', () => {
  it('uses the ambient session unless a token is given', async () => {
    const { client, transport } = recording({});
    await client.portfolio();
    await client.activity({ cursor: 'next', limit: 10 }, 'subwallet-token');
    expect(transport.mock.calls[0][0]).toMatchObject({
      path: '/v1/predictions/me/portfolio',
      account: { accessToken: undefined },
      timeout: 10_000,
    });
    expect(transport.mock.calls[1][0]).toMatchObject({
      path: '/v1/predictions/me/activity',
      account: { accessToken: 'subwallet-token' },
    });
    expect(Object.fromEntries(transport.mock.calls[1][0].params!)).toEqual({
      limit: '10',
      cursor: 'next',
    });
  });

  it('does not fall back to the ambient session while a selected session is loading', async () => {
    const { client, transport } = recording({});
    await expect(client.portfolio(null)).rejects.toThrow('Prediction wallet session is not ready');
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('public requests', () => {
  it('encodes the provider market id for the market detail route', async () => {
    const { client, transport } = recording({});
    await client.market('polymarket:market/id');
    expect(transport.mock.calls[0][0]).toMatchObject({
      path: '/v1/predictions/markets/polymarket%3Amarket%2Fid',
      timeout: 10_000,
    });
    expect(transport.mock.calls[0][0].account).toBeUndefined();
  });

  it('sends public activity filters as query parameters', async () => {
    const { client, transport } = recording({});
    await client.publicActivity({
      marketId: 'polymarket:market/id',
      trader: 'EQTrader',
      actions: ['buy', 'claim'],
      cursor: 'next',
      limit: 10,
    });
    expect(transport.mock.calls[0][0].path).toBe('/v1/predictions/activity');
    expect(Object.fromEntries(transport.mock.calls[0][0].params!)).toEqual({
      limit: '10',
      marketId: 'polymarket:market/id',
      trader: 'EQTrader',
      action: 'buy,claim',
      cursor: 'next',
    });
  });
});

describe('quotes', () => {
  it('posts exact atomic amounts and propagates cancellation', async () => {
    const input = { action: 'buy' as const, outcome: 'yes' as const, collateralBudget: '50000000' };
    const signal = new AbortController().signal;
    const { client, transport } = recording({ shares: '250000000' });
    expect(await client.quote('polymarket:a/b', input, signal)).toEqual({ shares: '250000000' });
    expect(transport.mock.calls[0][0]).toMatchObject({
      path: '/v1/predictions/markets/polymarket%3Aa%2Fb/quote',
      method: 'POST',
      body: { ...input, leverage: '1000000000' },
      signal,
    });
  });

  it('reports a controlled error for an empty upstream 502', async () => {
    const { client } = recording(new PredictionsHttpError(502, ''));
    await expect(
      client.quote('market', { action: 'buy', outcome: 'yes', collateralBudget: '1' }),
    ).rejects.toThrow('Prediction quote is unavailable');
  });

  it('keeps a known refusal and its code without classifying a stale quote as unfillable', async () => {
    const { client } = recording(
      new PredictionsHttpError(409, {
        code: 'quote_stale',
        message: 'Prediction quote is stale; waiting for a fresh update',
      }),
    );
    const error = await client
      .quote('market', { action: 'buy', outcome: 'yes', collateralBudget: '10000000' })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({
      code: 'quote_stale',
      message: 'Prediction quote is stale; waiting for a fresh update',
    });
    expect(isQuoteOutsideBounds(error)).toBe(false);
  });
});

describe('fetchTransport', () => {
  const respond = (status: number, body: string) =>
    vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

  it('sends a query, a JSON body and the session token, and reads the JSON response', async () => {
    const fetcher = respond(200, '{"ok":true}');
    const client = new PredictionsClient(
      fetchTransport('https://api.test/', fetcher, () => 'primary'),
    );
    expect(await client.activity({ limit: 5 })).toEqual({ ok: true });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/v1/predictions/me/activity?limit=5');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer primary' });
  });

  it('sends no session to a public route', async () => {
    const fetcher = respond(200, '{}');
    await new PredictionsClient(
      fetchTransport('https://api.test', fetcher, () => 'primary'),
    ).market('m');
    expect(
      (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers.Authorization,
    ).toBeUndefined();
  });

  it('times out a response whose body never finishes', async () => {
    vi.useFakeTimers();
    const fetcher = (async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      text: () =>
        new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    })) as unknown as typeof fetch;
    const pending = new PredictionsClient(fetchTransport('https://api.test', fetcher)).market('m');
    const settled = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(10_000);
    await settled;
    vi.useRealTimers();
  });

  it('rejects a non-2xx response with its status and body', async () => {
    const client = new PredictionsClient(
      fetchTransport('https://api.test', respond(404, '{"code":"not_found"}')),
    );
    await expect(client.market('m')).rejects.toMatchObject({
      status: 404,
      body: { code: 'not_found' },
    });
  });
});
