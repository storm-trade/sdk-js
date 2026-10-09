import { Address, Cell } from '@ton/ton';

export enum OrderType {
  StopLoss = 0,
  TakeProfit = 1,
  Limit = 2,
  Market = 3,
  AddMargin = 4,
  RemoveMargin = 5,
  OrderRequest = 8,
}

export type Direction = 0 | 1;
type OpenOrderFields = {
  expiration: number;
  direction: Direction;
  amount: bigint;
  leverage: bigint;
  limitPrice: bigint;
  stopTriggerPrice: bigint;
  takeTriggerPrice: bigint;
};
export type MarketOrder = OpenOrderFields & { type: OrderType.Market; minBaseAssetAmount: bigint };
export type LimitOrder = OpenOrderFields & { type: OrderType.Limit; stopPrice: bigint };
export type OpenOrder = MarketOrder | LimitOrder;
export type UserOrder =
  | OpenOrder
  | {
      type: OrderType.StopLoss | OrderType.TakeProfit;
      expiration: number;
      direction: Direction;
      amount: bigint;
      triggerPrice: bigint;
    }
  | {
      type: OrderType.AddMargin | OrderType.RemoveMargin;
      direction: Direction;
      amount: bigint;
    }
  | {
      type: OrderType.OrderRequest;
      selector: 0 | 1;
      order: OpenOrder;
    };

export interface Intent {
  queryId: number;
  createdAt: number;
  referenceQueryId?: number;
  publicKey: Buffer;
  market: Address;
  smartAccount: Address;
  order: UserOrder;
}

export interface IntentSigner {
  publicKey: Buffer;
  /** Sign the 32-byte Cell representation hash using raw Ed25519. */
  sign(hash: Buffer): Promise<Buffer>;
}

export interface SignedMessage {
  message: string;
  public_key: string;
  signature: string;
}

export interface PlaceOrderRequest extends SignedMessage {
  sa: string;
  builder?: string;
  payment_mode?: 'gasless';
  order_requests?: SignedMessage[];
}

export interface Submission {
  ok: boolean;
  accepted?: boolean;
  intent_hash?: string;
  trace?: unknown;
  intent?: unknown;
}

export interface BuilderInfo {
  builder: string;
  rebate: number;
  fee_earned: string;
  active: boolean;
  created_at: number;
  updated_at: number;
}

export const INTENT_STATUS = {
  accepted: 'accepted',
  executing: 'executing',
  done: 'done',
  failed: 'failed',
  placed: 'placed',
  cancelled: 'cancelled',
} as const;
export type IntentStatusValue = (typeof INTENT_STATUS)[keyof typeof INTENT_STATUS];

export interface IntentStatus {
  status: IntentStatusValue;
  ts: number;
  trace?: unknown;
  error?: string;
  order_hash?: string;
  code?: string;
  contract_interface?: string;
  contract_exit_code?: number;
  vm_exit_code?: number;
}

/** JSON integers beyond Number.MAX_SAFE_INTEGER are preserved as strings. */
export type Integer = number | string;
export interface PreparedOrder {
  hash: string;
  cell: Cell;
  request: PlaceOrderRequest;
  orderRequestHashes: string[];
}
