import type {
  PredictionActivityResponse,
  PredictionEventsQuery,
  PredictionEventsResponse,
  PredictionExecutionQuote,
  PredictionMarket,
  PredictionOnchainMarket,
  PredictionPortfolioResponse,
  PredictionProbabilityHistoryResponse,
  PredictionQuoteRequest,
  PredictionResolutionHistoryQuery,
  PredictionResolutionHistoryResponse,
  PredictionTimeline,
  PublicPredictionActivityQuery,
  PublicPredictionActivityResponse,
} from './types';

/** One HTTP call of the predictions API, described so any client can make it. */
export interface PredictionsRequest {
  path: string;
  method: 'GET' | 'POST';
  params?: URLSearchParams;
  body?: unknown;
  timeout: number;
  signal?: AbortSignal;
  /**
   * A trader's own data. `undefined` sends the caller's ambient session; a token is sent as a Bearer header.
   */
  account?: { accessToken?: string };
}

/** Makes a request and resolves to the JSON body; a non-2xx response rejects with a PredictionsHttpError. */
export type PredictionsTransport = <T>(request: PredictionsRequest) => Promise<T>;

export class PredictionsHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message = `Predictions API returned HTTP ${status}`,
  ) {
    super(message);
    this.name = 'PredictionsHttpError';
  }
}

/** A transport over fetch: the session is a Bearer token the caller hands in, if any. */
export const fetchTransport =
  (
    baseUrl: string,
    fetcher: typeof fetch = globalThis.fetch,
    session?: () => string | undefined,
  ): PredictionsTransport =>
  async <T>({ path, method, params, body, timeout, signal, account }: PredictionsRequest) => {
    const token = account ? (account.accessToken ?? session?.()) : undefined;
    const query = params?.toString();
    const url = baseUrl.replace(/\/$/, '') + path + (query ? `?${query}` : '');
    // AbortSignal.any is too new for older WebViews
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeout);
    signal?.addEventListener('abort', abort);
    // the timeout and the caller's signal cover reading the body too, not only the headers
    let response: Response;
    let text: string;
    try {
      response = await fetcher(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      text = await response.text();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // a non-JSON body is kept as text for the error
    }
    if (!response.ok) throw new PredictionsHttpError(response.status, data);
    return data as T;
  };

/** The quote service's code for a side the market cannot fill at this price or size. */
export const QUOTE_OUTSIDE_BOUNDS = 'quote_outside_bounds';

const QUOTE_ERRORS = [
  'invalid_quote_request',
  'quote_unavailable',
  'quote_stale',
  'market_closed',
  QUOTE_OUTSIDE_BOUNDS,
  'insufficient_shares',
];

export const isQuoteOutsideBounds = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && (error as { code?: unknown }).code === QUOTE_OUTSIDE_BOUNDS;

export const createPredictionEventsSearchParams = ({
  category,
  tags,
  filter,
  start,
  end,
  includeCount = true,
}: PredictionEventsQuery) => {
  const params = new URLSearchParams({
    includeMarkets: 'true',
    start: String(start),
    end: String(end),
    includeCount: String(includeCount),
  });

  if (category) params.set('category', category);
  if (tags?.length) params.set('tags', tags.join(','));
  if (filter) params.set('filter', filter);

  return params;
};

export const createPredictionResolutionsSearchParams = ({
  assetId,
  durationMinutes,
  limit,
}: PredictionResolutionHistoryQuery) =>
  new URLSearchParams({
    assetId: assetId.toLowerCase(),
    durationMinutes: durationMinutes.join(','),
    limit: String(limit),
  });

const marketPath = (marketId: string, rest = '') =>
  `/v1/predictions/markets/${encodeURIComponent(marketId)}${rest}`;

/** The predictions API: the catalog, a market and its quotes, a trader's portfolio and activity, resolutions. */
export class PredictionsClient {
  constructor(private readonly transport: PredictionsTransport) {}

  private get<T>(path: string, timeout: number, params?: URLSearchParams) {
    return this.transport<T>({ path, method: 'GET', params, timeout });
  }

  /** A trader's own data: `undefined` is the ambient session, `null` or '' a session that is not ready yet. */
  private account<T>(
    path: string,
    accessToken: string | null | undefined,
    params?: URLSearchParams,
  ) {
    if (accessToken !== undefined && !accessToken)
      return Promise.reject(new Error('Prediction wallet session is not ready'));
    return this.transport<T>({
      path,
      method: 'GET',
      params,
      timeout: 10_000,
      account: { accessToken: accessToken ?? undefined },
    });
  }

  events(query: PredictionEventsQuery) {
    return this.get<PredictionEventsResponse>(
      '/v1/predictions/events',
      10_000,
      createPredictionEventsSearchParams(query),
    );
  }

  /** Every live event, page by page. */
  async catalog(): Promise<PredictionEventsResponse> {
    const first = await this.events({ filter: 'live', start: 0, end: 100, includeCount: false });
    const events = new Map(first.data.map(event => [event.eventId, event]));
    let page = first;
    while (page.pagination.hasNext) {
      const start = page.pagination.end;
      page = await this.events({ filter: 'live', start, end: start + 100, includeCount: false });
      if (page.pagination.hasNext && page.pagination.end <= start)
        throw new Error('Prediction catalog pagination did not advance');
      for (const event of page.data) events.set(event.eventId, event);
    }
    return { ...first, data: [...events.values()], pagination: { ...page.pagination, start: 0 } };
  }

  market(marketId: string) {
    return this.get<PredictionMarket>(marketPath(marketId), 10_000);
  }

  onchainMarket(marketId: string) {
    return this.get<PredictionOnchainMarket>(marketPath(marketId, '/onchain'), 10_000);
  }

  timeline(marketId: string) {
    return this.get<PredictionTimeline>(marketPath(marketId, '/timeline'), 5_000);
  }

  probabilityHistory(marketId: string) {
    return this.get<PredictionProbabilityHistoryResponse>(
      marketPath(marketId, '/probability-history'),
      10_000,
    );
  }

  /** A quote to sign against; a known refusal keeps the service's message and code. */
  async quote(marketId: string, input: PredictionQuoteRequest, signal?: AbortSignal) {
    try {
      return await this.transport<PredictionExecutionQuote>({
        path: marketPath(marketId, '/quote'),
        method: 'POST',
        body: input.action === 'buy' ? { ...input, leverage: '1000000000' } : input,
        timeout: 8_000,
        signal,
      });
    } catch (error) {
      const body = (error instanceof PredictionsHttpError ? error.body : undefined) as
        | { code?: string; message?: unknown }
        | undefined;
      const message =
        QUOTE_ERRORS.includes(body?.code ?? '') && typeof body?.message === 'string'
          ? body.message
          : 'Prediction quote is unavailable';
      throw Object.assign(new Error(message), { code: body?.code, cause: error });
    }
  }

  portfolio(accessToken?: string | null) {
    return this.account<PredictionPortfolioResponse>('/v1/predictions/me/portfolio', accessToken);
  }

  activity(
    { cursor, limit = 20 }: { cursor?: string; limit?: number } = {},
    accessToken?: string | null,
  ) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return this.account<PredictionActivityResponse>(
      '/v1/predictions/me/activity',
      accessToken,
      params,
    );
  }

  publicActivity({
    marketId,
    trader,
    actions,
    cursor,
    limit = 20,
  }: PublicPredictionActivityQuery = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (marketId) params.set('marketId', marketId);
    if (trader) params.set('trader', trader);
    if (actions?.length) params.set('action', actions.join(','));
    if (cursor) params.set('cursor', cursor);
    return this.get<PublicPredictionActivityResponse>('/v1/predictions/activity', 10_000, params);
  }

  resolutions(query: PredictionResolutionHistoryQuery) {
    return this.get<PredictionResolutionHistoryResponse>(
      '/v1/predictions/resolutions',
      10_000,
      createPredictionResolutionsSearchParams(query),
    );
  }
}
