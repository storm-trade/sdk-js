// AUTO-GENERATED subset of the PredictionVault contract's TypeScript wrapper (PredictionVault.gen.ts).
// Regenerate with scripts/sync-prediction-bindings.mjs.
import * as c from '@ton/core';
import { beginCell } from '@ton/core';

type StoreCallback<T> = (obj: T, b: c.Builder) => void;

type LoadCallback<T> = (s: c.Slice) => T;

export type CellRef<T> = {
  ref: T;
};

function makeCellFrom<T>(self: T, storeFn_T: StoreCallback<T>): c.Cell {
  let b = beginCell();
  storeFn_T(self, b);
  return b.endCell();
}

function loadAndCheckPrefix32(s: c.Slice, expected: number, structName: string): void {
  let prefix = s.loadUint(32);
  if (prefix !== expected) {
    throw new Error(
      `Incorrect prefix for '${structName}': expected 0x${expected.toString(16).padStart(8, '0')}, got 0x${prefix.toString(16).padStart(8, '0')}`,
    );
  }
}

function formatPrefix(prefixNum: number, prefixLen: number): string {
  return prefixLen % 4
    ? `0b${prefixNum.toString(2).padStart(prefixLen, '0')}`
    : `0x${prefixNum.toString(16).padStart(prefixLen / 4, '0')}`;
}

function loadAndCheckPrefix(
  s: c.Slice,
  expected: number,
  prefixLen: number,
  structName: string,
): void {
  let prefix = s.loadUint(prefixLen);
  if (prefix !== expected) {
    throw new Error(
      `Incorrect prefix for '${structName}': expected ${formatPrefix(expected, prefixLen)}, got ${formatPrefix(prefix, prefixLen)}`,
    );
  }
}

function lookupPrefix(s: c.Slice, expected: number, prefixLen: number): boolean {
  return s.remainingBits >= prefixLen && s.preloadUint(prefixLen) === expected;
}

function throwNonePrefixMatch(fieldPath: string): never {
  throw new Error(`Incorrect prefix for '${fieldPath}': none of variants matched`);
}

function storeCellRef<T>(cell: CellRef<T>, b: c.Builder, storeFn_T: StoreCallback<T>): void {
  let b_ref = c.beginCell();
  storeFn_T(cell.ref, b_ref);
  b.storeRef(b_ref.endCell());
}

function loadCellRef<T>(s: c.Slice, loadFn_T: LoadCallback<T>): CellRef<T> {
  let s_ref = s.loadRef().beginParse();
  return { ref: loadFn_T(s_ref) };
}

type coins = bigint;

type uint32 = bigint;

type uint64 = bigint;

export interface CreateOrderIntent {
  readonly $: 'CreateOrderIntent';
  order: CellRef<PredictionOrder>;
}

export const CreateOrderIntent = {
  PREFIX: 0b00,

  create(args: { order: CellRef<PredictionOrder> }): CreateOrderIntent {
    return {
      $: 'CreateOrderIntent',
      ...args,
    };
  },
  fromSlice(s: c.Slice): CreateOrderIntent {
    loadAndCheckPrefix(s, 0b00, 2, 'CreateOrderIntent');
    return {
      $: 'CreateOrderIntent',
      order: loadCellRef<PredictionOrder>(s, PredictionOrder.fromSlice),
    };
  },
  store(self: CreateOrderIntent, b: c.Builder): void {
    b.storeUint(0b00, 2);
    storeCellRef<PredictionOrder>(self.order, b, PredictionOrder.store);
  },
  toCell(self: CreateOrderIntent): c.Cell {
    return makeCellFrom<CreateOrderIntent>(self, CreateOrderIntent.store);
  },
};

export interface CancelOrderIntent {
  readonly $: 'CancelOrderIntent';
  orderId: uint32;
}

export const CancelOrderIntent = {
  PREFIX: 0b01,

  create(args: { orderId: uint32 }): CancelOrderIntent {
    return {
      $: 'CancelOrderIntent',
      ...args,
    };
  },
  fromSlice(s: c.Slice): CancelOrderIntent {
    loadAndCheckPrefix(s, 0b01, 2, 'CancelOrderIntent');
    return {
      $: 'CancelOrderIntent',
      orderId: s.loadUintBig(32),
    };
  },
  store(self: CancelOrderIntent, b: c.Builder): void {
    b.storeUint(0b01, 2);
    b.storeUint(self.orderId, 32);
  },
  toCell(self: CancelOrderIntent): c.Cell {
    return makeCellFrom<CancelOrderIntent>(self, CancelOrderIntent.store);
  },
};

export interface ExecuteOrderIntent {
  readonly $: 'ExecuteOrderIntent';
  traderAddress: c.Address;
  orderId: uint32;
  signedQuote: CellRef<SignedQuote>;
}

export const ExecuteOrderIntent = {
  PREFIX: 0b10,

  create(args: {
    traderAddress: c.Address;
    orderId: uint32;
    signedQuote: CellRef<SignedQuote>;
  }): ExecuteOrderIntent {
    return {
      $: 'ExecuteOrderIntent',
      ...args,
    };
  },
  fromSlice(s: c.Slice): ExecuteOrderIntent {
    loadAndCheckPrefix(s, 0b10, 2, 'ExecuteOrderIntent');
    return {
      $: 'ExecuteOrderIntent',
      traderAddress: s.loadAddress(),
      orderId: s.loadUintBig(32),
      signedQuote: loadCellRef<SignedQuote>(s, SignedQuote.fromSlice),
    };
  },
  store(self: ExecuteOrderIntent, b: c.Builder): void {
    b.storeUint(0b10, 2);
    b.storeAddress(self.traderAddress);
    b.storeUint(self.orderId, 32);
    storeCellRef<SignedQuote>(self.signedQuote, b, SignedQuote.store);
  },
  toCell(self: ExecuteOrderIntent): c.Cell {
    return makeCellFrom<ExecuteOrderIntent>(self, ExecuteOrderIntent.store);
  },
};

export interface RedeemPositionIntent {
  readonly $: 'RedeemPositionIntent';
}

export const RedeemPositionIntent = {
  PREFIX: 0b11,

  create(): RedeemPositionIntent {
    return {
      $: 'RedeemPositionIntent',
    };
  },
  fromSlice(s: c.Slice): RedeemPositionIntent {
    loadAndCheckPrefix(s, 0b11, 2, 'RedeemPositionIntent');
    return {
      $: 'RedeemPositionIntent',
    };
  },
  store(self: RedeemPositionIntent, b: c.Builder): void {
    b.storeUint(0b11, 2);
  },
  toCell(self: RedeemPositionIntent): c.Cell {
    return makeCellFrom<RedeemPositionIntent>(self, RedeemPositionIntent.store);
  },
};

export type PredictionIntentPayload =
  | CreateOrderIntent
  | CancelOrderIntent
  | ExecuteOrderIntent
  | RedeemPositionIntent;

export const PredictionIntentPayload = {
  fromSlice(s: c.Slice): PredictionIntentPayload {
    return lookupPrefix(s, 0b00, 2)
      ? CreateOrderIntent.fromSlice(s)
      : lookupPrefix(s, 0b01, 2)
        ? CancelOrderIntent.fromSlice(s)
        : lookupPrefix(s, 0b10, 2)
          ? ExecuteOrderIntent.fromSlice(s)
          : lookupPrefix(s, 0b11, 2)
            ? RedeemPositionIntent.fromSlice(s)
            : throwNonePrefixMatch('PredictionIntentPayload');
  },
  store(self: PredictionIntentPayload, b: c.Builder): void {
    switch (self.$) {
      case 'CreateOrderIntent':
        CreateOrderIntent.store(self, b);
        break;
      case 'CancelOrderIntent':
        CancelOrderIntent.store(self, b);
        break;
      case 'ExecuteOrderIntent':
        ExecuteOrderIntent.store(self, b);
        break;
      case 'RedeemPositionIntent':
        RedeemPositionIntent.store(self, b);
        break;
    }
  },
  toCell(self: PredictionIntentPayload): c.Cell {
    return makeCellFrom<PredictionIntentPayload>(self, PredictionIntentPayload.store);
  },
};

export interface PredictionIntent {
  readonly $: 'PredictionIntent';
  queryId: uint64;
  marketIndex: uint64;
  payload: CellRef<PredictionIntentPayload>;
}

export const PredictionIntent = {
  PREFIX: 0x62af8f6c,

  create(args: {
    queryId: uint64;
    marketIndex: uint64;
    payload: CellRef<PredictionIntentPayload>;
  }): PredictionIntent {
    return {
      $: 'PredictionIntent',
      ...args,
    };
  },
  fromSlice(s: c.Slice): PredictionIntent {
    loadAndCheckPrefix32(s, 0x62af8f6c, 'PredictionIntent');
    return {
      $: 'PredictionIntent',
      queryId: s.loadUintBig(64),
      marketIndex: s.loadUintBig(64),
      payload: loadCellRef<PredictionIntentPayload>(s, PredictionIntentPayload.fromSlice),
    };
  },
  store(self: PredictionIntent, b: c.Builder): void {
    b.storeUint(0x62af8f6c, 32);
    b.storeUint(self.queryId, 64);
    b.storeUint(self.marketIndex, 64);
    storeCellRef<PredictionIntentPayload>(self.payload, b, PredictionIntentPayload.store);
  },
  toCell(self: PredictionIntent): c.Cell {
    return makeCellFrom<PredictionIntent>(self, PredictionIntent.store);
  },
};

export interface Quote {
  readonly $: 'Quote';
  timestamp: uint64;
  yesBid: uint32;
  yesAsk: uint32;
  spread: uint32;
  kAsk: uint32;
  kBid: uint32;
  depthAsk: coins;
  depthBid: coins;
}

export const Quote = {
  PREFIX: 0xd186baf9,

  create(args: {
    timestamp: uint64;
    yesBid: uint32;
    yesAsk: uint32;
    spread: uint32;
    kAsk: uint32;
    kBid: uint32;
    depthAsk: coins;
    depthBid: coins;
  }): Quote {
    return {
      $: 'Quote',
      ...args,
    };
  },
  fromSlice(s: c.Slice): Quote {
    loadAndCheckPrefix32(s, 0xd186baf9, 'Quote');
    return {
      $: 'Quote',
      timestamp: s.loadUintBig(64),
      yesBid: s.loadUintBig(32),
      yesAsk: s.loadUintBig(32),
      spread: s.loadUintBig(32),
      kAsk: s.loadUintBig(32),
      kBid: s.loadUintBig(32),
      depthAsk: s.loadCoins(),
      depthBid: s.loadCoins(),
    };
  },
  store(self: Quote, b: c.Builder): void {
    b.storeUint(0xd186baf9, 32);
    b.storeUint(self.timestamp, 64);
    b.storeUint(self.yesBid, 32);
    b.storeUint(self.yesAsk, 32);
    b.storeUint(self.spread, 32);
    b.storeUint(self.kAsk, 32);
    b.storeUint(self.kBid, 32);
    b.storeCoins(self.depthAsk);
    b.storeCoins(self.depthBid);
  },
  toCell(self: Quote): c.Cell {
    return makeCellFrom<Quote>(self, Quote.store);
  },
};

export interface SignedQuote {
  readonly $: 'SignedQuote';
  update: CellRef<Quote>;
  signatures: c.Cell;
}

export const SignedQuote = {
  PREFIX: 0x6ce3d821,

  create(args: { update: CellRef<Quote>; signatures: c.Cell }): SignedQuote {
    return {
      $: 'SignedQuote',
      ...args,
    };
  },
  fromSlice(s: c.Slice): SignedQuote {
    loadAndCheckPrefix32(s, 0x6ce3d821, 'SignedQuote');
    return {
      $: 'SignedQuote',
      update: loadCellRef<Quote>(s, Quote.fromSlice),
      signatures: s.loadRef(),
    };
  },
  store(self: SignedQuote, b: c.Builder): void {
    b.storeUint(0x6ce3d821, 32);
    storeCellRef<Quote>(self.update, b, Quote.store);
    b.storeRef(self.signatures);
  },
  toCell(self: SignedQuote): c.Cell {
    return makeCellFrom<SignedQuote>(self, SignedQuote.store);
  },
};

export type EntryPrice = uint32;

export const EntryPrice = {
  fromSlice(s: c.Slice): EntryPrice {
    return s.loadUintBig(32);
  },
  store(self: EntryPrice, b: c.Builder): void {
    b.storeUint(self, 32);
  },
  toCell(self: EntryPrice): c.Cell {
    return makeCellFrom<EntryPrice>(self, EntryPrice.store);
  },
};

export interface MarketEntry {
  readonly $: 'MarketEntry';
}

export const MarketEntry = {
  PREFIX: 0b00,

  create(): MarketEntry {
    return {
      $: 'MarketEntry',
    };
  },
  fromSlice(s: c.Slice): MarketEntry {
    loadAndCheckPrefix(s, 0b00, 2, 'MarketEntry');
    return {
      $: 'MarketEntry',
    };
  },
  store(self: MarketEntry, b: c.Builder): void {
    b.storeUint(0b00, 2);
  },
  toCell(self: MarketEntry): c.Cell {
    return makeCellFrom<MarketEntry>(self, MarketEntry.store);
  },
};

export interface LimitEntry {
  readonly $: 'LimitEntry';
  price: EntryPrice;
}

export const LimitEntry = {
  PREFIX: 0b01,

  create(args: { price: EntryPrice }): LimitEntry {
    return {
      $: 'LimitEntry',
      ...args,
    };
  },
  fromSlice(s: c.Slice): LimitEntry {
    loadAndCheckPrefix(s, 0b01, 2, 'LimitEntry');
    return {
      $: 'LimitEntry',
      price: EntryPrice.fromSlice(s),
    };
  },
  store(self: LimitEntry, b: c.Builder): void {
    b.storeUint(0b01, 2);
    EntryPrice.store(self.price, b);
  },
  toCell(self: LimitEntry): c.Cell {
    return makeCellFrom<LimitEntry>(self, LimitEntry.store);
  },
};

export interface StopEntry {
  readonly $: 'StopEntry';
  price: EntryPrice;
}

export const StopEntry = {
  PREFIX: 0b10,

  create(args: { price: EntryPrice }): StopEntry {
    return {
      $: 'StopEntry',
      ...args,
    };
  },
  fromSlice(s: c.Slice): StopEntry {
    loadAndCheckPrefix(s, 0b10, 2, 'StopEntry');
    return {
      $: 'StopEntry',
      price: EntryPrice.fromSlice(s),
    };
  },
  store(self: StopEntry, b: c.Builder): void {
    b.storeUint(0b10, 2);
    EntryPrice.store(self.price, b);
  },
  toCell(self: StopEntry): c.Cell {
    return makeCellFrom<StopEntry>(self, StopEntry.store);
  },
};

export type OrderEntry = MarketEntry | LimitEntry | StopEntry;

export const OrderEntry = {
  fromSlice(s: c.Slice): OrderEntry {
    return lookupPrefix(s, 0b00, 2)
      ? MarketEntry.fromSlice(s)
      : lookupPrefix(s, 0b01, 2)
        ? LimitEntry.fromSlice(s)
        : lookupPrefix(s, 0b10, 2)
          ? StopEntry.fromSlice(s)
          : throwNonePrefixMatch('OrderEntry');
  },
  store(self: OrderEntry, b: c.Builder): void {
    switch (self.$) {
      case 'MarketEntry':
        MarketEntry.store(self, b);
        break;
      case 'LimitEntry':
        LimitEntry.store(self, b);
        break;
      case 'StopEntry':
        StopEntry.store(self, b);
        break;
    }
  },
  toCell(self: OrderEntry): c.Cell {
    return makeCellFrom<OrderEntry>(self, OrderEntry.store);
  },
};

export interface BuyTerms {
  readonly $: 'BuyTerms';
  escrow: coins;
  leverage: uint64;
}

export const BuyTerms = {
  PREFIX: 0b0,

  create(args: { escrow: coins; leverage: uint64 }): BuyTerms {
    return {
      $: 'BuyTerms',
      ...args,
    };
  },
  fromSlice(s: c.Slice): BuyTerms {
    loadAndCheckPrefix(s, 0b0, 1, 'BuyTerms');
    return {
      $: 'BuyTerms',
      escrow: s.loadCoins(),
      leverage: s.loadUintBig(64),
    };
  },
  store(self: BuyTerms, b: c.Builder): void {
    b.storeUint(0b0, 1);
    b.storeCoins(self.escrow);
    b.storeUint(self.leverage, 64);
  },
  toCell(self: BuyTerms): c.Cell {
    return makeCellFrom<BuyTerms>(self, BuyTerms.store);
  },
};

export interface SellTerms {
  readonly $: 'SellTerms';
  minProceeds: coins;
}

export const SellTerms = {
  PREFIX: 0b1,

  create(args: { minProceeds: coins }): SellTerms {
    return {
      $: 'SellTerms',
      ...args,
    };
  },
  fromSlice(s: c.Slice): SellTerms {
    loadAndCheckPrefix(s, 0b1, 1, 'SellTerms');
    return {
      $: 'SellTerms',
      minProceeds: s.loadCoins(),
    };
  },
  store(self: SellTerms, b: c.Builder): void {
    b.storeUint(0b1, 1);
    b.storeCoins(self.minProceeds);
  },
  toCell(self: SellTerms): c.Cell {
    return makeCellFrom<SellTerms>(self, SellTerms.store);
  },
};

export type OrderTerms = BuyTerms | SellTerms;

export const OrderTerms = {
  fromSlice(s: c.Slice): OrderTerms {
    return lookupPrefix(s, 0b0, 1)
      ? BuyTerms.fromSlice(s)
      : lookupPrefix(s, 0b1, 1)
        ? SellTerms.fromSlice(s)
        : throwNonePrefixMatch('OrderTerms');
  },
  store(self: OrderTerms, b: c.Builder): void {
    switch (self.$) {
      case 'BuyTerms':
        BuyTerms.store(self, b);
        break;
      case 'SellTerms':
        SellTerms.store(self, b);
        break;
    }
  },
  toCell(self: OrderTerms): c.Cell {
    return makeCellFrom<OrderTerms>(self, OrderTerms.store);
  },
};

export interface PredictionOrder {
  readonly $: 'PredictionOrder';
  outcome: PredictionOutcome;
  shares: coins;
  deadline: uint32;
  marketEpoch: uint32;
  terms: OrderTerms;
  entry: OrderEntry;
}

export const PredictionOrder = {
  create(args: {
    outcome: PredictionOutcome;
    shares: coins;
    deadline: uint32;
    marketEpoch: uint32;
    terms: OrderTerms;
    entry: OrderEntry;
  }): PredictionOrder {
    return {
      $: 'PredictionOrder',
      ...args,
    };
  },
  fromSlice(s: c.Slice): PredictionOrder {
    return {
      $: 'PredictionOrder',
      outcome: PredictionOutcome.fromSlice(s),
      shares: s.loadCoins(),
      deadline: s.loadUintBig(32),
      marketEpoch: s.loadUintBig(32),
      terms: OrderTerms.fromSlice(s),
      entry: OrderEntry.fromSlice(s),
    };
  },
  store(self: PredictionOrder, b: c.Builder): void {
    PredictionOutcome.store(self.outcome, b);
    b.storeCoins(self.shares);
    b.storeUint(self.deadline, 32);
    b.storeUint(self.marketEpoch, 32);
    OrderTerms.store(self.terms, b);
    OrderEntry.store(self.entry, b);
  },
  toCell(self: PredictionOrder): c.Cell {
    return makeCellFrom<PredictionOrder>(self, PredictionOrder.store);
  },
};

export type PredictionOutcome = bigint;

export const PredictionOutcome = {
  Yes: 0n,
  No: 1n,

  fromSlice(s: c.Slice): PredictionOutcome {
    return s.loadUintBig(1);
  },
  store(self: PredictionOutcome, b: c.Builder): void {
    b.storeUint(self, 1);
  },
  toCell(self: PredictionOutcome): c.Cell {
    return makeCellFrom<PredictionOutcome>(self, PredictionOutcome.store);
  },
};
