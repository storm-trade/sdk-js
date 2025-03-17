import { Direction, OraclePayload, OrderType } from '../base-packers';

export type CollateralAssets = 'TON' | 'USDT' | 'NOT'

export type MarketOpenOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will be used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * Amount of collateral asset to use, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
  /**
   * Leverage for this order, 9 decimals
   */
  leverage: bigint;
  /**
   * Minimal base asset amount, that will be added to position after order executed, 9 decimals
   */
  minBaseAssetAmount?: bigint;
  /**
   * If set will create stop loss order with specified trigger price, once market order is executed, 9 decimals
   */
  stopTriggerPrice?: bigint;
  /**
   * If set will create take profit order with specified trigger price, once market order is executed, 9 decimals
   */
  takeTriggerPrice?: bigint;
  /**
   * Order TTL, seconds, default to 15 minutes
   */
  expiration?: number;
};

export type MarketCloseOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will was used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * How much base asset will be swapped back to collateral asset, 9 decimals
   */
  size: bigint,
};

export type LimitOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will be used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * Amount of collateral asset to use, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
  /**
   * Leverage for this order, 9 decimals
   */
  leverage: bigint;
  /**
   * Price to trigger limit order execution, 9 decimals
   */
  limitPrice: bigint;
  /**
   * If set will create stop loss order with specified trigger price, once limit order is executed, 9 decimals
   */
  stopTriggerPrice?: bigint;
  /**
   * If set will create take profit order with specified trigger price, once limit order is executed, 9 decimals
   */
  takeTriggerPrice?: bigint;
  /**
   * Order TTL, seconds, default to 60 days
   */
  expiration?: number;
}

export type StopLimitOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will be used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * Amount of collateral asset to use, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
  /**
   * Leverage for this order, 9 decimals
   */
  leverage: bigint;
  /**
   * Price to trigger limit order creation, 9 decimals
   */
  stopPrice: bigint;
  /**
   * Price to trigger limit order execution, 9 decimals
   */
  limitPrice: bigint;
  /**
   * If set will create stop loss order with specified trigger price, once limit order is executed, 9 decimals
   */
  stopTriggerPrice?: bigint;
  /**
   * If set will create take profit order with specified trigger price, once limit order is executed, 9 decimals
   */
  takeTriggerPrice?: bigint;
  /**
   * Order TTL, seconds, default to 60 days
   */
  expiration?: number;
}

export type StopMarketOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will be used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * Amount of collateral asset to use, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
  /**
   * Leverage for this order, 9 decimals
   */
  leverage: bigint;
  /**
   * Price to trigger market order creation, 9 decimals
   */
  stopPrice: bigint;
  /**
   * If set will create stop loss order with specified trigger price, once limit order is executed, 9 decimals
   */
  stopTriggerPrice?: bigint;
  /**
   * If set will create take profit order with specified trigger price, once limit order is executed, 9 decimals
   */
  takeTriggerPrice?: bigint;
  /**
   * Order TTL, seconds, default to 60 days
   */
  expiration?: number;
}

export type StopLossOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will was used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * How much base asset will be swapped back to collateral asset, 9 decimals
   */
  amount: bigint
  /**
   * Price to trigger order execution, 9 decimals
   */
  triggerPrice: bigint
}

export type TakeProfitOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will was used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * How much base asset will be swapped back to collateral asset, 9 decimals
   */
  amount: bigint
  /**
   * Price to trigger order execution, 9 decimals
   */
  triggerPrice: bigint
}

export type CancelOrderParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will was used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction
  /**
   * Which order type will be cancelled
   */
  orderType: OrderType
  /**
   * Order index in position manager storage.
   * Get this from API, or from contract directly via getPositionManagerData method
   */
  orderIndex: number
}

export type AddMarginParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will was used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * Amount of collateral asset to add, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
  /**
   * If set will provide oracle prices for base and collateral assets, otherwise sdk will request them on it's own
   */
  oraclePayload?: OraclePayload;
}

export type RemoveMarginParams = {
  /**
   * Market's base asset, e.g BTC
   */
  baseAssetName: string;
  /**
   * Which asset will was used as collateral, e.g TON
   */
  collateralAssetName: CollateralAssets;
  /**
   * Position direction short/long
   */
  direction: Direction;
  /**
   * Amount of collateral asset to remove, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
  /**
   * If set will provide oracle prices for base and collateral assets, otherwise sdk will request them on it's own
   */
  oraclePayload?: OraclePayload;
}

export interface AddMarginWithOraclePayload extends AddMarginParams {
  oraclePayload: OraclePayload;
}

export interface RemoveMarginWithOraclePayload extends RemoveMarginParams {
  oraclePayload: OraclePayload;
}

export type ProvideLiquidityParams = {
  /**
   * Which asset will be used as collateral, e.g TON
   */
  assetName: CollateralAssets;
  /**
   * Amount of collateral asset to use, set decimals based on collateral. E.g 9 for TON, 6 for USDT, 9 for NOT
   */
  amount: bigint;
}

export type WithdrawLiquidityParams = {
  /**
   * Which asset will was used as collateral, e.g TON
   */
  assetName: CollateralAssets;
  /**
   * Amount of SLP tokens to swap back to collateral assets, 9 decimals
   */
  amountOfSLP: bigint;
}

export type CreateAnyLimitOrderParams = {
  baseAssetName: string;
  collateralAssetName: string;
  direction: Direction;
  amount: bigint;
  leverage: bigint;
  stopPrice: bigint;
  limitPrice: bigint;
  stopTriggerPrice?: bigint;
  takeTriggerPrice?: bigint;
  expiration?: number;
}

export type CreateSLTPOrderParams = {
  baseAssetName: string;
  collateralAssetName: string;
  direction: Direction;
  type: OrderType.stopLoss | OrderType.takeProfit
  amount: bigint
  triggerPrice: bigint
}
