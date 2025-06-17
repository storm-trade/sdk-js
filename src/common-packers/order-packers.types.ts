import { Address, Cell } from '@ton/ton';
import {
  PackAddMarginParams,
  PackCancelOrderParams,
  PackRemoveMarginParams,
  PackSLTPOrderParams,
} from '../base-packers';

/**
 * Parameters for a blockchain transaction
 */
export type TXParams = {
  /**
   * Recipient's address
   */
  to: Address;
  /**
   * Message body to send
   */
  body: Cell;
  /**
   * Amount of Toncoins to send
   */
  value: bigint;
};

export type NativeLimitMarketOrderParams<T> = {
  vaultType: 'native';
  amount: bigint;
  vaultAddress: Address;
  orderParams: T;
}

export type JettonLimitMarketOrderParams<T> = {
  vaultType: 'jetton';
  queryId?: number;
  traderJettonWalletAddress: Address
  traderAddress: Address
  amount: bigint
  vaultAddress: Address
  orderParams: T
}

export type LimitMarketOrderParams<T> = JettonLimitMarketOrderParams<T> | NativeLimitMarketOrderParams<T>

/**
 * Parameters for cancelling an existing order
 */
export type CancelOrderParams = {
  positionManagerAddress: Address;
  orderParams: PackCancelOrderParams;
}

/**
 * Parameters for Stop Loss/Take Profit orders
 */
export type SLTPOrderParams = {
  positionManagerAddress: Address;
  orderParams: PackSLTPOrderParams;
};

/**
 * Base parameters for adding margin using native TON
 */
export type NativeAddMarginParams = {
  vaultType: 'native';
  amount: bigint
  vaultAddress: Address
  orderParams: PackAddMarginParams;
};

/**
 * Parameters for adding margin using Jettons
 */
export type JettonAddMarginParams = {
  vaultType: 'jetton';
  traderJettonWalletAddress: Address
  traderAddress: Address
  amount: bigint
  vaultAddress: Address
  orderParams: PackAddMarginParams;
  queryId?: number
};

export type AddMarginParams = NativeAddMarginParams | JettonAddMarginParams;

/**
 * Base parameters for removing margin
 */
export type RemoveMarginParams = {
  orderParams: PackRemoveMarginParams;
  positionManagerAddress: Address;
};

/**
 * Base parameters for providing liquidity using native TON
 */
export type NativeProvideLiquidityParams = {
  vaultType: 'native';
  amount: bigint
  vaultAddress: Address
};

/**
 * Parameters for providing liquidity using Jettons
 */
export type JettonProvideLiquidityParams = {
  vaultType: 'jetton';
  traderAddress: Address;
  traderJettonWalletAddress: Address;
  amount: bigint;
  vaultAddress: Address;
  queryId?: number;
}

export type ProvideLiquidityParams = NativeProvideLiquidityParams | JettonProvideLiquidityParams

/**
 * Parameters for withdrawing liquidity (unstaking)
 */
export type WithdrawLiquidityParams = {
  amount: bigint;
  userAddress: Address;
  lpWalletAddress: Address;
};
