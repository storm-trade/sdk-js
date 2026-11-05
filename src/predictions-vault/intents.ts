import type { Cell } from '@ton/core';
import {
  BuyTerms,
  CancelOrderIntent,
  CreateOrderIntent,
  LimitEntry,
  MarketEntry,
  PredictionIntent,
  PredictionOrder,
  PredictionOutcome as Outcome,
  RedeemPositionIntent,
  SellTerms,
  StopEntry,
  type PredictionIntentPayload,
} from './bindings';

export const PREDICTION_LEVERAGE = 1_000_000_000n;

export type PredictionOrderKind = 'market' | 'limit' | 'stop';
export type PredictionOrderAction = 'buy' | 'sell';
export type PredictionOutcome = 'yes' | 'no';

export interface PredictionMarketRef {
  marketIndex: bigint;
  marketEpoch: number;
}

export interface PredictionOrderRequest {
  queryId: bigint;
  market: PredictionMarketRef;
  kind: PredictionOrderKind;
  action: PredictionOrderAction;
  outcome: PredictionOutcome;
  shares: bigint;
  collateralLimit: bigint;
  triggerProbability?: bigint;
  deadline: number;
}

export interface CancelPredictionOrderRequest {
  queryId: bigint;
  marketIndex: bigint;
  orderId: number;
  traderAddress: string;
}

export interface RedeemPredictionPositionRequest {
  queryId: bigint;
  market: PredictionMarketRef;
}

const assertUint = (value: bigint, bits: number, name: string) => {
  if (value < 0n || value >= 1n << BigInt(bits)) {
    throw new Error(`${name} must fit uint${bits}`);
  }
};

const assertUintNumber = (value: number, bits: number, name: string) => {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** bits) {
    throw new Error(`${name} must fit uint${bits}`);
  }
};

const assertMarket = (market: PredictionMarketRef) => {
  assertUint(market.marketIndex, 64, 'marketIndex');
  assertUintNumber(market.marketEpoch, 32, 'marketEpoch');
};

const buildPredictionOrder = (order: PredictionOrderRequest): PredictionOrder => {
  assertMarket(order.market);
  assertUintNumber(order.deadline, 32, 'deadline');
  if (order.shares <= 0n) throw new Error('shares must be positive');
  if (order.collateralLimit <= 0n) throw new Error('collateralLimit must be positive');

  const triggerProbability = order.triggerProbability ?? 0n;
  if (order.kind === 'market' && triggerProbability !== 0n) {
    throw new Error('market order triggerProbability must be zero');
  }
  if (
    order.kind !== 'market' &&
    (triggerProbability <= 0n || triggerProbability >= 1_000_000_000n)
  ) {
    throw new Error('conditional order triggerProbability must be between 1 and 999999999');
  }
  return PredictionOrder.create({
    outcome: order.outcome === 'yes' ? Outcome.Yes : Outcome.No,
    shares: order.shares,
    deadline: BigInt(order.deadline),
    marketEpoch: BigInt(order.market.marketEpoch),
    terms:
      order.action === 'buy'
        ? BuyTerms.create({ escrow: order.collateralLimit, leverage: PREDICTION_LEVERAGE })
        : SellTerms.create({ minProceeds: order.collateralLimit }),
    entry:
      order.kind === 'market'
        ? MarketEntry.create()
        : order.kind === 'limit'
          ? LimitEntry.create({ price: triggerProbability })
          : StopEntry.create({ price: triggerProbability }),
  });
};

const buildPredictionIntent = (
  queryId: bigint,
  marketIndex: bigint,
  payload: PredictionIntentPayload,
): Cell => {
  assertUint(queryId, 64, 'queryId');
  assertUint(marketIndex, 64, 'marketIndex');
  return PredictionIntent.toCell(
    PredictionIntent.create({ queryId, marketIndex, payload: { ref: payload } }),
  );
};

export const buildCreatePredictionOrderIntent = (order: PredictionOrderRequest): Cell =>
  buildPredictionIntent(
    order.queryId,
    order.market.marketIndex,
    CreateOrderIntent.create({ order: { ref: buildPredictionOrder(order) } }),
  );

export const buildCancelPredictionOrderIntent = (request: CancelPredictionOrderRequest): Cell => {
  assertUintNumber(request.orderId, 32, 'orderId');
  return buildPredictionIntent(
    request.queryId,
    request.marketIndex,
    CancelOrderIntent.create({ orderId: BigInt(request.orderId) }),
  );
};

export const buildRedeemPredictionPositionIntent = (
  request: RedeemPredictionPositionRequest,
): Cell => {
  assertMarket(request.market);
  return buildPredictionIntent(
    request.queryId,
    request.market.marketIndex,
    RedeemPositionIntent.create(),
  );
};
