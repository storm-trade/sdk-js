const fs = require('node:fs');
const crypto = require('node:crypto');
const { Address, TonClient } = require('@ton/ton');
const {
  V3Client,
  V3_URLS,
  prepareOrder,
  prepareCancel,
  depositPayload,
  withdrawalPayload,
  keyPayload,
  getSmartAccountAddress,
} = require('@storm-trade/trading-sdk/v3');
const { packInJettonPayload } = require('@storm-trade/trading-sdk/base-packers');

async function main() {
  const [command, argument] = process.argv.slice(2);
  const api = new V3Client(process.env.STORM_V3_URL || V3_URLS.stage);
  const signal = AbortSignal.timeout(30000);
  const print = value => console.log(JSON.stringify(value, null, 2));
  if (command === 'status') return print(await api.getStatus(signal));
  if (command === 'registry') return print(await api.getBuilders(signal));
  if (command === 'intent') return print(await api.getIntentStatus(argument, signal));
  if (command === 'balances') return print(await api.getBalances(argument, signal));
  if (command === 'positions') return print(await api.getPositions(argument, signal));
  if (command === 'query-id') return print(await api.getQueryID(argument, signal));
  if (command === 'bundles')
    return print(
      await api.request(`/smartaccount/${encodeURIComponent(argument)}/bundles`, undefined, signal),
    );
  if (command === 'submit') {
    const prepared = JSON.parse(fs.readFileSync(argument, 'utf8'));
    // The input file already contains the hash for reconciliation if this request times out.
    return print(await api.placeOrder(prepared.request, signal));
  }
  if (!argument)
    throw new Error(
      'Usage: cli.cjs status|registry|intent HASH|balances SA|positions SA|query-id SA|bundles SA|prepare FILE|submit FILE|account FILE|address FILE|cancel FILE',
    );
  const p = JSON.parse(fs.readFileSync(argument, 'utf8'));
  if (command === 'address') {
    const client = new TonClient({ endpoint: p.rpc, apiKey: process.env.TONCENTER_API_KEY });
    return print({
      smartAccount: (
        await getSmartAccountAddress(client, Address.parse(p.factory), Address.parse(p.owner))
      ).toRawString(),
    });
  }
  if (command === 'account') {
    let payload, to, value;
    const queryId = BigInt(p.queryId);
    if (p.action === 'deposit') {
      payload = depositPayload({
        native: p.native,
        queryId,
        amount: BigInt(p.amount),
        owner: Address.parse(p.owner),
        init: p.init,
        publicKeys: p.publicKey ? [Buffer.from(p.publicKey, 'base64')] : [],
      });
      to = p.vault;
      value = BigInt(p.gas) + (p.native ? BigInt(p.amount) : 0n);
      if (!p.native) {
        payload = packInJettonPayload({
          queryId,
          amount: BigInt(p.amount),
          to: Address.parse(p.vault),
          responseAddress: Address.parse(p.owner),
          forwardTonAmount: BigInt(p.forwardGas),
          forwardPayload: payload,
        });
        to = p.jettonWallet;
      }
    } else if (p.action === 'withdraw') {
      payload = withdrawalPayload(queryId, Address.parse(p.vault), BigInt(p.amount));
      to = p.smartAccount;
      value = BigInt(p.gas);
    } else {
      payload = keyPayload(p.action, queryId, Buffer.from(p.publicKey, 'base64'));
      to = p.smartAccount;
      value = BigInt(p.gas);
    }
    return print({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [
        { address: to, amount: value.toString(), payload: payload.toBoc().toString('base64') },
      ],
    });
  }
  const secret = process.env.STORM_SIGNING_SEED;
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret))
    throw new Error('STORM_SIGNING_SEED must be a 32-byte Ed25519 seed in hex');
  const key = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(secret, 'hex'),
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const signer = {
    publicKey: crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32),
    sign: async hash => crypto.sign(null, hash, key),
  };
  if (command === 'cancel') {
    const prepared = await prepareCancel(Address.parse(p.smartAccount), p.hash, signer);
    print({ hash: prepared.hash });
    return print(await api.cancelOrder(prepared.request, signal));
  }
  if (command !== 'prepare') throw new Error('Unknown command');
  const order = { ...p.order };
  for (const field of [
    'amount',
    'leverage',
    'limitPrice',
    'stopPrice',
    'minBaseAssetAmount',
    'stopTriggerPrice',
    'takeTriggerPrice',
    'triggerPrice',
  ]) {
    if (order[field] !== undefined) order[field] = BigInt(order[field]);
  }
  const prepared = await prepareOrder({
    smartAccount: Address.parse(p.smartAccount),
    market: Address.parse(p.market),
    signer,
    order,
    queryId: p.queryId,
    createdAt: p.createdAt,
    builder: p.builder,
    gasless: p.gasless,
  });
  print({
    hash: prepared.hash,
    orderRequestHashes: prepared.orderRequestHashes,
    request: prepared.request,
  });
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
