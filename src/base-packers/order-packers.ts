import { beginCell, Cell, toNano } from '@ton/ton';
import { packOraclePayload } from './oracle-packer';
import {
  OrderType,
  PackAddMarginParams,
  PackCancelOrderParams,
  PackJettonPayloadParams,
  PackLimitOrderParams,
  PackMarketOrderParams,
  PackNativePayloadParams,
  PackRemoveMarginParams,
  PackSLTPOrderParams,
  WithdrawLiquidityParams,
} from './order-packers.types';
import { AmmOpcodes, PositionManagerOpcodes, VaultOpcodes } from './opcodes';

export function packMarketOrder(opts: PackMarketOrderParams): Cell {
  let body = beginCell()
    .storeUint(VaultOpcodes.requestCreateOrder, 32)
    .storeUint(opts.assetId, 16)
    .storeUint(OrderType.market, 4)
    .storeAddress(opts.gasToAddress)
    .storeBit(opts.initPositionManager)
    .storeRef(
      beginCell()
        .storeUint(opts.leverage, 64)
        .storeUint(opts.expiration, 32)
        .storeUint(opts.direction, 1)
        .storeCoins(opts.limitPrice)
        .storeCoins(opts.minBaseAssetAmount)
        .storeCoins(opts.stopTriggerPrice)
        .storeCoins(opts.takeTriggerPrice)
        .endCell(),
    );

  if (opts.initPositionManager) {
    body = body.storeMaybeUint(opts.referralId, 64);
  }

  return body.endCell();
}

export function packLimitOrder(opts: PackLimitOrderParams): Cell {
  let body = beginCell()
    .storeUint(VaultOpcodes.requestCreateOrder, 32)
    .storeUint(opts.assetId, 16)
    .storeUint(OrderType.limit, 4)
    .storeAddress(opts.gasToAddress)
    .storeBit(opts.initPositionManager)
    .storeRef(
      beginCell()
        .storeUint(opts.leverage, 64)
        .storeUint(opts.expiration, 32)
        .storeUint(opts.direction, 1)
        .storeCoins(opts.limitPrice)
        .storeCoins(opts.stopPrice)
        .storeCoins(opts.stopTriggerPrice)
        .storeCoins(opts.takeTriggerPrice)
        .endCell(),
    );

  if (opts.initPositionManager) {
    body = body.storeMaybeUint(opts.referralId, 64);
  }

  return body.endCell();
}

export function packSLTPOrder(opts: PackSLTPOrderParams): Cell {
  return beginCell()
    .storeUint(PositionManagerOpcodes.createOrder, 32)
    .storeUint(opts.type, 4)
    .storeAddress(opts.gasToAddress)
    .storeRef(
      beginCell()
        .storeUint(opts.type, 4)
        .storeUint(opts.expiration, 32)
        .storeUint(opts.direction, 1)
        .storeCoins(opts.amount)
        .storeCoins(opts.triggerPrice)
        .endCell(),
    )
    .endCell();
}

export function packAddMargin(opts: PackAddMarginParams): Cell {
  return beginCell()
    .storeUint(AmmOpcodes.addMargin, 32)
    .storeUint(opts.assetId, 16)
    .storeUint(opts.direction, 1)
    .storeAddress(opts.gasToAddress)
    .storeRef(packOraclePayload(opts.oracle))
    .endCell();
}

export function packRemoveMargin(opts: PackRemoveMarginParams): Cell {
  return beginCell()
    .storeUint(PositionManagerOpcodes.providePosition, 32)
    .storeUint(opts.direction, 1)
    .storeAddress(opts.gasToAddress)
    .storeUint(AmmOpcodes.removeMargin, 32)
    .storeCoins(opts.amount)
    .storeRef(packOraclePayload(opts.oracle))
    .endCell();
}

export function packProvideLiquidity(): Cell {
  return beginCell().storeUint(VaultOpcodes.provideLiquidity, 32).endCell();
}

export function packWithdrawLiquidity(opts: WithdrawLiquidityParams): Cell {
  return beginCell()
    .storeUint(VaultOpcodes.withdrawLiquidity, 32)
    .storeUint(0, 64)
    .storeCoins(opts.amount)
    .storeAddress(opts.userAddress)
    .endCell();
}

export function packCancelOrder(opts: PackCancelOrderParams): Cell {
  return beginCell()
    .storeUint(PositionManagerOpcodes.cancelOrder, 32)
    .storeUint(opts.orderType, 4)
    .storeUint(opts.orderIndex, 3)
    .storeUint(opts.direction, 1)
    .storeAddress(opts.gasToAddress)
    .endCell();
}

export function packInJettonPayload(params: PackJettonPayloadParams): Cell {
  return beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(params.queryId ?? 0, 64) // op, queryId
    .storeCoins(params.amount)
    .storeAddress(params.to)
    .storeAddress(params.responseAddress)
    .storeMaybeRef(params.customPayload)
    .storeCoins(params.forwardTonAmount ?? toNano('0.001')) // notify message
    .storeMaybeRef(params.forwardPayload)
    .endCell();
}

export function packInNativePayload(opts: PackNativePayloadParams): Cell {
  // get initial op
  const payload = opts.payload.beginParse();
  const opCode = payload.loadUint(32);

  return beginCell().storeUint(opCode, 32).storeCoins(opts.amount).storeSlice(payload).endCell();
}
