import { Address, Cell } from '@ton/ton';
import { OraclePayload } from './oracle-packer.types';

export enum OrderType {
  stopLoss = 0,
  takeProfit = 1,
  limit = 2,
  market = 3,
}

export enum Direction {
  long = 0,
  short = 1,
}

export type PackMarketOrderParams = {
  assetId: number
  gasToAddress?: Address
  initPositionManager: boolean
  leverage: bigint
  expiration: number
  direction: Direction
  limitPrice: bigint
  minBaseAssetAmount: bigint
  stopTriggerPrice: bigint
  takeTriggerPrice: bigint
  referralId?: number
}

export type PackLimitOrderParams = {
  assetId: number
  gasToAddress?: Address
  initPositionManager: boolean
  leverage: bigint
  expiration: number
  direction: Direction
  limitPrice: bigint
  stopPrice: bigint
  stopTriggerPrice: bigint
  takeTriggerPrice: bigint
  referralId?: number
}

export type PackSLTPOrderParams = {
  gasToAddress?: Address
  type: OrderType.stopLoss | OrderType.takeProfit
  expiration: number
  direction: Direction
  amount: bigint
  triggerPrice: bigint
}

export type PackAddMarginParams = {
  gasToAddress?: Address
  assetId: number
  direction: Direction
  oracle: OraclePayload
}

export type PackRemoveMarginParams = {
  direction: Direction
  gasToAddress?: Address
  amount: bigint
  oracle: OraclePayload
}

export type WithdrawLiquidityParams = {
  amount: bigint
  userAddress: Address
}

export type PackCancelOrderParams = {
  orderType: OrderType
  orderIndex: number
  direction: Direction
  gasToAddress?: Address
}

export type PackJettonPayloadParams = {
  amount: bigint
  to: Address
  responseAddress?: Address
  customPayload?: Cell
  forwardTonAmount?: bigint
  forwardPayload: Cell
}

export type PackNativePayloadParams = {
  amount: bigint
  payload: Cell
}
