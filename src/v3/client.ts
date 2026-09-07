import { Address } from '@ton/ton';
import { packCancel, packIntent, signCell } from './packers';
import {
  BuilderInfo,
  Integer,
  IntentSigner,
  IntentStatus,
  OrderType,
  PlaceOrderRequest,
  PreparedOrder,
  Submission,
  UserOrder,
} from './types';

export const V3_URLS = {
  testnet: 'https://api.stage.stormtrade.dev/v3-node-0',
  mainnet: 'https://api.storm.tg/v3-node-0',
} as const;

export class V3ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`V3 API returned HTTP ${status}`);
    this.name = 'V3ApiError';
  }
}

export function parseV3Json(text: string): unknown {
  // Match JSON strings as whole tokens so digits inside strings are never changed.
  return JSON.parse(
    text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
      if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return `"${token}"`;
      return token;
    }),
  );
}

export class V3Client {
  constructor(
    public readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch,
  ) {}

  /** No automatic retries: a transport failure can occur after the intent was admitted. */
  async request<T = unknown>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await this.fetcher(this.baseUrl.replace(/\/$/, '') + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? parseV3Json(text) : undefined;
    } catch {
      data = text;
    }
    if (!response.ok) throw new V3ApiError(response.status, data);
    if (text && typeof data === 'string') throw new Error('Expected a JSON API response');
    return data as T;
  }

  getStatus(signal?: AbortSignal) {
    return this.request('/status', undefined, signal);
  }
  getBuilders(signal?: AbortSignal) {
    return this.request<BuilderInfo[]>('/builders', undefined, signal);
  }
  getAccountState(sa: string, signal?: AbortSignal) {
    return this.request(this.accountPath(sa, 'state'), undefined, signal);
  }
  getBalances(sa: string, signal?: AbortSignal) {
    return this.request<Record<string, Integer>>(
      this.accountPath(sa, 'balances'),
      undefined,
      signal,
    );
  }
  getPositions(sa: string, signal?: AbortSignal) {
    return this.request(this.accountPath(sa, 'positions'), undefined, signal);
  }
  getQueryID(sa: string, signal?: AbortSignal) {
    return this.request<{ query_id: number }>(this.accountPath(sa, 'queryID'), undefined, signal);
  }
  getIntent(hash: string, signal?: AbortSignal) {
    return this.request(`/intent/${encodeURIComponent(hash)}`, undefined, signal);
  }
  getIntentStatus(hash: string, signal?: AbortSignal) {
    return this.request<IntentStatus>(
      `/intent/${encodeURIComponent(hash)}/status`,
      undefined,
      signal,
    );
  }
  getAccountEvents(sa: string, limit = 20, offset = 0, signal?: AbortSignal) {
    return this.request(
      `${this.accountPath(sa, 'events')}?limit=${limit}&offset=${offset}`,
      undefined,
      signal,
    );
  }
  placeOrder(request: PlaceOrderRequest, signal?: AbortSignal) {
    return this.request<Submission>('/order/place', request, signal);
  }

  async cancelOrder(sa: Address, hash: string, signer: IntentSigner, signal?: AbortSignal) {
    const cell = packCancel(sa, hash);
    const request = { sa: sa.toRawString(), ...(await signCell(cell, signer)) };
    return this.request<Submission>('/order/cancel', request, signal);
  }

  private accountPath(sa: string, endpoint: string) {
    return `/smartaccount/${encodeURIComponent(sa)}/${endpoint}`;
  }
}

/** Prepare before sending so the caller can persist the hash and reconcile uncertain outcomes. */
export async function prepareOrder(params: {
  smartAccount: Address;
  market: Address;
  signer: IntentSigner;
  order: UserOrder;
  queryId: number;
  createdAt: number;
  builder?: string;
  gasless?: boolean;
}): Promise<PreparedOrder> {
  const intent = { ...params, publicKey: params.signer.publicKey };
  const cell = packIntent(intent);
  const request: PlaceOrderRequest = {
    sa: params.smartAccount.toRawString(),
    ...(await signCell(cell, params.signer)),
    ...(params.builder ? { builder: params.builder } : {}),
    ...(params.gasless ? { payment_mode: 'gasless' as const } : {}),
  };
  const orderRequestHashes: string[] = [];
  const order = params.order;
  if (order.type === OrderType.Market || order.type === OrderType.Limit) {
    for (const selector of [0, 1] as const) {
      if ((selector === 0 ? order.stopTriggerPrice : order.takeTriggerPrice) === 0n) continue;
      const child = packIntent({
        ...intent,
        queryId: params.queryId + orderRequestHashes.length + 1,
        referenceQueryId: params.queryId,
        order: { type: OrderType.OrderRequest, selector, order },
      });
      (request.order_requests ??= []).push(await signCell(child, params.signer));
      orderRequestHashes.push(child.hash().toString('hex'));
    }
  }
  return { hash: cell.hash().toString('hex'), cell, request, orderRequestHashes };
}

export async function prepareCancel(sa: Address, hash: string, signer: IntentSigner) {
  const cell = packCancel(sa, hash);
  return {
    hash: cell.hash().toString('hex'),
    request: { sa: sa.toRawString(), ...(await signCell(cell, signer)) },
  };
}
