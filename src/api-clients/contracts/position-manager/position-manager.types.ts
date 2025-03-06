import { Address } from '@ton/ton';
import { Direction, OrderType } from '../../../base-packers';

export type PositionData = {
  /**
   * Position size, in 9 decimals.
   */
  size: bigint;
  /**
   * Position direction. 0 if long, 1 if short.
   */
  direction: Direction;
  /**
   * Position margin, in 9 decimals.
   */
  margin: bigint;
  /**
   * Position open notional, in 9 decimals.
   */
  openNotional: bigint;
  /**
   * Position last updated cumulative premium, in 9 decimals.
   */
  lastUpdatedCumulativePremium: bigint;
  /**
   * Position fee, in 9 decimals.
   */
  fee: bigint;
  /**
   * Position discount. 0 if no referrer. in 9 decimals.
   */
  discount: bigint;
  /**
   * Position rebate. 0 if no referrer. in 9 decimals.
   */
  rebate: bigint;
  /**
   * Position last updated timestamp.
   */
  lastUpdatedTimestamp: bigint;
};

/**
 * Contains actual position data, position's Take-profit/Stop-limit orders.
 */
export type PositionRecord = {
  /**
   * Is position currently locked (is processing or not).
   */
  isLocked: boolean;
  /**
   * Redirect addrress in case if position is processing. Null if position is unlocked .
   */
  redirectAddress?: Address | null;
  positionOrdersBitset: number;
  /**
   * Position's Take-profit/Stop-limit orders.
   */
  positionOrders: Map<number, OrderData>;
  /**
   * Actual position data.
   */
  positionData: PositionData;
};

export type SLTPOrder = {
  orderType: OrderType.stopLoss | OrderType.takeProfit;
  /**
   * Order position direction. 0 if long, 1 if short.
   */
  direction: Direction;
  /**
   * Order position size to close. In 9 decimals.
   */
  amount: bigint;
  /**
   * Order expiration time. In seconds.
   */
  expiration: number;
  /**
   * Order trager price. In 9 decimals.
   */
  triggerPrice: bigint;
};

export type LimitOrderCommon = {
  /**
   * Order position direction. 0 if long, 1 if short.
   */
  direction: Direction;
  /**
   * Order margin amount to open. In 9 decimals.
   */
  amount: bigint;
  /**
   * Order leverage. In 9 decimals.
   */
  leverage: bigint;
  /**
   * Order expiration time. In seconds.
   */
  expiration: number;
  /**
   * Order limit price. In 9 decimals.
   */
  limitPrice: bigint;
  /**
   * Next stop-loss triger price. In 9 decimals.
   */
  stopTriggerPrice: bigint;
  /**
   * Next take-profit triger price. In 9 decimals.
   */
  takeTriggerPrice: bigint;
};

type StopLimitOrder = {
  orderType: OrderType.limit;
  /**
   * Order stop  price. In 9 decimals.
   */
  stopPrice: bigint;
};

type MarketOrder = {
  orderType: OrderType.market;
  /**
   * Minimal base asset amount (oprional). In 9 decimals.
   */
  minBaseAssetAmount?: bigint;
};

export type LimitOrMarketOrder = StopLimitOrder | MarketOrder;

export type LimitOrder = LimitOrMarketOrder & LimitOrderCommon;

export type PositionReferralData = {
  referralAddress: Address | null;
  discount: number;
  rebate: number;
};

export type OrderData = SLTPOrder | LimitOrder;

export type PositionManagerData = {
  /**
   * Positions' Trader address
   */
  traderAddress: Address;
  /**
   * Positions' Vault address
   */
  vaultAddress: Address;
  /**
   * Positions' Market address
   */
  vammAddress: Address;
  /**
   * Long position record. Null if empty
   */
  longPosition: PositionRecord | null | undefined;
  /**
   * Short position record. Null if empty
   */
  shortPosition: PositionRecord | null | undefined;
  /**
   * Position account referral data. Null if position is not inited
   */
  referralData: PositionReferralData | null | undefined;
  /**
   * Position account limit orders map.
   */
  limitOrders: Map<number, OrderData>;
  limitOrdersBitset: number;
};
