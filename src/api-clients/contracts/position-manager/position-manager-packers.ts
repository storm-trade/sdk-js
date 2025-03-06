import { Address, Cell, Dictionary, DictionaryValue, Slice } from '@ton/ton';
import {
  LimitOrder,
  OrderData,
  PositionData,
  PositionRecord,
  PositionReferralData,
  SLTPOrder,
} from './position-manager.types';
import { OrderType } from '../../../base-packers';

const nanoDecimals = 9;

function numFromNano(value: bigint): number {
  return Number(fromDecimals(value, nanoDecimals));
}

function fromDecimals(src: bigint | number | string, decimals: number) {
  let v = BigInt(src);
  let neg = false;
  if (v < 0) {
    neg = true;
    v = -v;
  }

  // Convert fraction
  const frac = v % 10n ** BigInt(decimals);
  let facStr = frac.toString();
  while (facStr.length < decimals) {
    facStr = '0' + facStr;
  }
  facStr = facStr.match(/^([0-9]*[1-9]|0)(0*)/)![1];

  // Convert whole
  const whole = v / 10n ** BigInt(decimals);
  const wholeStr = whole.toString();

  // Value
  let value = `${wholeStr}${facStr === '0' ? '' : `.${facStr}`}`;
  if (neg) {
    value = '-' + value;
  }

  return value;
}

function loadAddressWithNull(cs: Slice): Address | null {
  let addr: Address | null = null;
  if (cs.preloadUint(2)) {
    addr = cs.loadAddress();
  } else {
    cs.skip(2);
  }

  return addr;
}

export function unpackPositionData(cs: Slice): PositionData {
  return {
    size: BigInt(cs.loadInt(128)),
    direction: cs.loadUint(1),
    margin: BigInt(cs.loadCoins()),
    openNotional: BigInt(cs.loadCoins()),
    lastUpdatedCumulativePremium: BigInt(cs.loadInt(64)),
    fee: BigInt(cs.loadUint(32)),
    discount: BigInt(cs.loadUint(32)),
    rebate: BigInt(cs.loadUint(32)),
    lastUpdatedTimestamp: BigInt(cs.loadUint(32)),
  };
}

export function unpackSLTPOrder(cs: Slice): SLTPOrder {
  return {
    orderType: cs.loadUint(4) as OrderType.stopLoss | OrderType.takeProfit,
    expiration: cs.loadUint(32),
    direction: cs.loadUint(1),
    amount: cs.loadCoins(),
    triggerPrice: cs.loadCoins(),
  };
}

export function unpackLimitOrder(cs: Slice): LimitOrder {
  const orderType = cs.loadUint(4) as OrderType.limit | OrderType.market;
  if (orderType === OrderType.limit) {
    return {
      orderType,
      expiration: cs.loadUint(32),
      direction: cs.loadUint(1),
      amount: cs.loadCoins(),
      leverage: cs.loadUintBig(64),
      limitPrice: cs.loadCoins(),
      stopPrice: cs.loadCoins(),
      stopTriggerPrice: cs.loadCoins(),
      takeTriggerPrice: cs.loadCoins(),
    };
  } else {
    return {
      orderType,
      expiration: cs.loadUint(32),
      direction: cs.loadUint(1),
      amount: cs.loadCoins(),
      leverage: cs.loadUintBig(64),
      limitPrice: cs.loadCoins(),
      minBaseAssetAmount: cs.loadCoins(),
      stopTriggerPrice: cs.loadCoins(),
      takeTriggerPrice: cs.loadCoins(),
    };
  }
}

export function unpackOrderData(cs: Slice): OrderData {
  const orderType = cs.preloadUint(4);
  if (orderType === OrderType.market || orderType === OrderType.limit) {
    return unpackLimitOrder(cs);
  }
  if (orderType === OrderType.stopLoss || orderType === OrderType.takeProfit) {
    return unpackSLTPOrder(cs);
  }

  throw new Error(`Unknown order type: ${orderType}`);
}

export const OrdersDictValue: DictionaryValue<OrderData> = {
  serialize: () => {
    throw new Error('Orders dict is readonly');
  },
  parse: src => {
    return unpackOrderData(src.loadRef().beginParse());
  },
};

export function unpackPositionReferralData(ref: Cell | null | undefined): PositionReferralData | null | undefined {
  if (!ref) return null;
  const cs = ref.beginParse();

  const referralAddress = loadAddressWithNull(cs);

  return {
    referralAddress,
    discount: numFromNano(cs.loadUintBig(32)),
    rebate: numFromNano(cs.loadUintBig(32)),
  };
}

export function unpackPositionRecord(recordRef: Cell | null | undefined): PositionRecord | null | undefined {
  if (!recordRef) return null;
  const cs = recordRef.beginParse();

  const isLocked = cs.loadBit();
  const redirectAddress = loadAddressWithNull(cs);

  return {
    isLocked,
    redirectAddress,
    positionOrdersBitset: cs.loadUint(8),
    positionOrders: parseOrdersDict(cs.loadDict(Dictionary.Keys.Uint(3), OrdersDictValue)),
    positionData: unpackPositionData(cs.loadRef().beginParse()),
  };
}

export function parseOrdersDict(dict: Dictionary<number, OrderData>): Map<number, OrderData> {
  const orders = new Map<number, OrderData>();
  const keys = dict.keys();

  for (const key of keys) {
    const pos = dict.get(key)!;
    orders.set(key, pos);
  }
  return orders;
}
