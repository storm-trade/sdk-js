import { Cell } from '@ton/ton';
import {
  packAddMargin,
  packCancelOrder,
  packInJettonPayload,
  packInNativePayload,
  packLimitOrder,
  PackLimitOrderParams,
  packMarketOrder,
  PackMarketOrderParams,
  packProvideLiquidity,
  packRemoveMargin,
  packSLTPOrder,
  packWithdrawLiquidity,
} from '../base-packers';
import { Fees } from './fees';
import {
  AddMarginParams,
  CancelOrderParams,
  JettonAddMarginParams,
  JettonLimitMarketOrderParams,
  JettonProvideLiquidityParams,
  LimitMarketOrderParams,
  NativeAddMarginParams,
  NativeLimitMarketOrderParams,
  NativeProvideLiquidityParams,
  ProvideLiquidityParams,
  RemoveMarginParams,
  SLTPOrderParams,
  TXParams,
  WithdrawLiquidityParams,
} from './order-packers.types';

function packJettonCreateOrder(opts: JettonLimitMarketOrderParams<unknown>, forwardPayload: Cell): TXParams {
  const body = packInJettonPayload({
    amount: opts.amount,
    to: opts.vaultAddress,
    queryId: opts.queryId,
    responseAddress: opts.traderAddress,
    forwardTonAmount: Fees.createOrder.forwardValue,
    forwardPayload,
  });

  return {
    to: opts.traderJettonWalletAddress,
    body, value: Fees.createOrder.msgValue,
  };
}

function packNativeCreateOrder(opts: NativeLimitMarketOrderParams<unknown>, forwardPayload: Cell): TXParams {
  const body = packInNativePayload({
    payload: forwardPayload,
    amount: opts.amount,
  });

  return {
    to: opts.vaultAddress,
    body,
    value: Fees.createOrder.msgValue + opts.amount,
  };
}

function packJettonAddMargin(opts: JettonAddMarginParams): TXParams {
  const body = packInJettonPayload({
    amount: opts.amount,
    to: opts.vaultAddress,
    queryId: opts.queryId,
    responseAddress: opts.traderAddress,
    forwardTonAmount: Fees.addMargin.forwardValue,
    forwardPayload: packAddMargin(opts.orderParams),
  });

  return {
    to: opts.traderJettonWalletAddress,
    body,
    value: Fees.addMargin.msgValue,
  };
}

function packNativeAddMargin(opts: NativeAddMarginParams): TXParams {
  const body = packInNativePayload({
    amount: opts.amount,
    payload: packAddMargin(opts.orderParams),
  });
  return {
    to: opts.vaultAddress,
    body,
    value: Fees.addMargin.msgValue + opts.amount,
  };
}

function packJettonMarketOrder(opts: JettonLimitMarketOrderParams<PackMarketOrderParams>): TXParams {
  return packJettonCreateOrder(opts, packMarketOrder(opts.orderParams));
}

function packNativeMarketOrder(opts: NativeLimitMarketOrderParams<PackMarketOrderParams>): TXParams {
  return packNativeCreateOrder(opts, packMarketOrder(opts.orderParams));
}

function packJettonLimitOrder(opts: JettonLimitMarketOrderParams<PackLimitOrderParams>): TXParams {
  return packJettonCreateOrder(opts, packLimitOrder(opts.orderParams));
}

function packNativeLimitOrder(opts: NativeLimitMarketOrderParams<PackLimitOrderParams>): TXParams {
  return packNativeCreateOrder(opts, packLimitOrder(opts.orderParams));
}

function packJettonProvideLiquidity(opts: JettonProvideLiquidityParams): TXParams {
  const body = packInJettonPayload({
    amount: opts.amount,
    to: opts.vaultAddress,
    queryId: opts.queryId,
    responseAddress: opts.responseAddress ?? opts.traderAddress,
    forwardPayload: packProvideLiquidity(),
    forwardTonAmount: Fees.provideLiquidity.forwardValue,
  });

  return {
    to: opts.traderJettonWalletAddress,
    body,
    value: Fees.provideLiquidity.msgValue,
  };
}

function packNativeProvideLiquidity(opts: NativeProvideLiquidityParams): TXParams {
  const body = packInNativePayload({ payload: packProvideLiquidity(), amount: opts.amount });

  return {
    to: opts.vaultAddress,
    body,
    value: Fees.provideLiquidity.msgValue + opts.amount,
  };
}

export function createCancelOrderTx(opts: CancelOrderParams): TXParams {
  const body = packCancelOrder(opts.orderParams);
  return {
    to: opts.positionManagerAddress,
    body,
    value: Fees.cancelOrder.msgValue,
  };
}

export function createMarketOrderTx(opts: LimitMarketOrderParams<PackMarketOrderParams>): TXParams {
  return opts.vaultType === 'jetton'
    ? packJettonMarketOrder(opts)
    : packNativeMarketOrder(opts);
}

export function createLimitOrderTx(opts: LimitMarketOrderParams<PackLimitOrderParams>): TXParams {
  return opts.vaultType === 'jetton'
    ? packJettonLimitOrder(opts)
    : packNativeLimitOrder(opts);
}

export function createSLTPOrderTx(opts: SLTPOrderParams): TXParams {
  const body = packSLTPOrder(opts.orderParams);
  return {
    to: opts.positionManagerAddress,
    body,
    value: Fees.createOrder.msgValue,
  };
}

export function createAddMarginTx(opts: AddMarginParams): TXParams {
  return opts.vaultType === 'jetton'
    ? packJettonAddMargin(opts)
    : packNativeAddMargin(opts);
}

export function createRemoveMarginTx(opts: RemoveMarginParams): TXParams {
  const body = packRemoveMargin(opts.orderParams);
  return {
    to: opts.positionManagerAddress,
    body,
    value: Fees.removeMargin.msgValue,
  };
}

export function createProvideLiquidityTx(opts: ProvideLiquidityParams): TXParams {
  return opts.vaultType === 'jetton'
    ? packJettonProvideLiquidity(opts)
    : packNativeProvideLiquidity(opts);
}

export function createWithdrawLiquidityTx(opts: WithdrawLiquidityParams): TXParams {
  const body = packWithdrawLiquidity({
    amount: opts.amount,
    userAddress: opts.responseAddress ?? opts.userAddress,
  });
  return {
    to: opts.lpWalletAddress,
    body,
    value: Fees.withdrawLiquidity.msgValue,
  };
}
