import { Address, beginCell, Builder, Cell } from '@ton/ton';
import { Intent, IntentSigner, OrderType, SignedMessage, UserOrder } from './types';

export const MAX_QUERY_ID = 8192 * 1023 - 1;

function storeQueryId(builder: Builder, id: number): Builder {
  if (!Number.isInteger(id) || id < 0 || id > MAX_QUERY_ID) {
    throw new RangeError('User query ID is outside the 13-bit shift / 10-bit counter range');
  }
  return builder.storeUint(Math.floor(id / 1023), 13).storeUint(id % 1023, 10);
}

// V3 orders are distinct from V2 vault transaction payloads.
export function packOrder(order: UserOrder): Cell {
  const b = beginCell().storeUint(order.type, 4);
  switch (order.type) {
    case OrderType.Market:
    case OrderType.Limit:
      return b
        .storeUint(order.expiration, 32)
        .storeUint(order.direction, 1)
        .storeCoins(order.amount)
        .storeUint(order.leverage, 64)
        .storeCoins(order.limitPrice)
        .storeCoins(order.type === OrderType.Market ? order.minBaseAssetAmount : order.stopPrice)
        .storeCoins(order.stopTriggerPrice)
        .storeCoins(order.takeTriggerPrice)
        .endCell();
    case OrderType.StopLoss:
    case OrderType.TakeProfit:
      return b
        .storeUint(order.expiration, 32)
        .storeUint(order.direction, 1)
        .storeCoins(order.amount)
        .storeCoins(order.triggerPrice)
        .endCell();
    case OrderType.AddMargin:
    case OrderType.RemoveMargin:
      return b.storeUint(order.direction, 1).storeCoins(order.amount).endCell();
    case OrderType.OrderRequest:
      return b
        .storeUint(order.selector, 1)
        .storeSlice(packOrder(order.order).beginParse())
        .endCell();
  }
}

export function packIntent(intent: Intent): Cell {
  if (intent.publicKey.length !== 32) throw new Error('Expected a 32-byte Ed25519 public key');
  const b = storeQueryId(beginCell(), intent.queryId).storeUint(intent.createdAt, 32);
  b.storeBit(intent.referenceQueryId !== undefined);
  if (intent.referenceQueryId !== undefined) storeQueryId(b, intent.referenceQueryId);
  return b
    .storeBuffer(intent.publicKey)
    .storeRef(
      beginCell()
        .storeAddress(intent.market)
        .storeAddress(intent.smartAccount)
        .storeRef(packOrder(intent.order))
        .endCell(),
    )
    .endCell();
}

/** Accepts a bare hex order hash or an API order ID with the `@offchain:` prefix. */
export function packCancel(smartAccount: Address, orderHash: string): Cell {
  const hash = orderHash.replace(/^@offchain:/, '');
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) throw new Error('Expected a 32-byte hex order hash');
  return beginCell().storeAddress(smartAccount).storeBuffer(Buffer.from(hash, 'hex')).endCell();
}

export async function signCell(cell: Cell, signer: IntentSigner): Promise<SignedMessage> {
  if (signer.publicKey.length !== 32) throw new Error('Expected a 32-byte Ed25519 public key');
  const signature = await signer.sign(cell.hash());
  if (signature.length !== 64) throw new Error('Expected a 64-byte Ed25519 signature');
  return {
    message: cell.toBoc().toString('base64'),
    public_key: signer.publicKey.toString('base64'),
    signature: signature.toString('base64'),
  };
}
