import { Address, beginCell, Cell, Dictionary, TonClient } from '@ton/ton';

export async function getSmartAccountAddress(
  client: TonClient,
  factory: Address,
  owner: Address,
): Promise<Address> {
  const { stack } = await client.runMethod(factory, 'get_nft_address_by_index', [
    { type: 'int', value: BigInt('0x' + owner.hash.toString('hex')) },
  ]);
  return stack.readAddress();
}

/** Receiver is the owner wallet address, not the derived Smart Account. Native token units. */
export function depositPayload(params: {
  native: boolean;
  queryId: bigint;
  amount: bigint;
  owner: Address;
  init: boolean;
  publicKeys?: Buffer[];
}): Cell {
  if (params.publicKeys?.length && !params.init)
    throw new Error('Public key initialization requires init=true');
  const b = beginCell()
    .storeUint(params.native ? 0x29bb3721 : 0x76840119, 32)
    .storeUint(params.queryId, 64);
  if (params.native) b.storeCoins(params.amount);
  b.storeAddress(params.owner).storeBit(params.init).storeBit(!!params.publicKeys?.length);
  if (params.publicKeys?.length) {
    const dict = Dictionary.empty(Dictionary.Keys.Buffer(32), {
      serialize() {},
      parse() {
        return true;
      },
    });
    for (const key of params.publicKeys) {
      if (key.length !== 32) throw new Error('Expected a 32-byte Ed25519 public key');
      dict.set(key, true);
    }
    b.storeDict(dict);
  }
  return b.endCell();
}

export function withdrawalPayload(queryId: bigint, vault: Address, amount: bigint): Cell {
  return beginCell()
    .storeUint(0x6eec039d, 32)
    .storeUint(queryId, 64)
    .storeAddress(vault)
    .storeCoins(amount)
    .endCell();
}

export function keyPayload(
  action: 'add' | 'remove' | 'removeOthers',
  queryId: bigint,
  publicKey: Buffer,
): Cell {
  if (publicKey.length !== 32) throw new Error('Expected a 32-byte Ed25519 public key');
  const opcodes = { add: 0x220c4c19, remove: 0x76519f8b, removeOthers: 0x644794b8 };
  return beginCell()
    .storeUint(opcodes[action], 32)
    .storeUint(queryId, 64)
    .storeBuffer(publicKey)
    .endCell();
}
