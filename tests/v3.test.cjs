const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Address, Cell } = require('@ton/ton');
const {
  packIntent,
  packOrder,
  packCancel,
  prepareOrder,
  parseV3Json,
  V3Client,
  V3ApiError,
  MAX_QUERY_ID,
  depositPayload,
} = require('../dist/v3');
const vectors = require('./fixtures/v3-intents.json');
const key = crypto.createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32)]),
  format: 'der',
  type: 'pkcs8',
});
const signer = {
  publicKey: Buffer.from(vectors[0].publicKey, 'base64'),
  sign: async hash => crypto.sign(null, hash, key),
};
const sa = Address.parseRaw('0:' + '00'.repeat(32));
const market = Address.parseRaw('0:' + '00'.repeat(31) + '01');
const open = {
  type: 3,
  expiration: 1800000000,
  direction: 1,
  amount: 123456789123n,
  leverage: 3000000000n,
  limitPrice: 65000000000000n,
  stopPrice: 0n,
  stopTriggerPrice: 0n,
  takeTriggerPrice: 0n,
};
const base = {
  queryId: 1022,
  createdAt: 1780000000,
  publicKey: signer.publicKey,
  market,
  smartAccount: sa,
};

for (const v of vectors)
  test(`Go/JS intent vector type=${v.type}`, async () => {
    let order;
    if ([2, 3].includes(v.type)) order = { ...open, type: v.type };
    else if ([0, 1].includes(v.type))
      order = {
        type: v.type,
        expiration: 1800000000,
        direction: 1,
        amount: open.amount,
        triggerPrice: open.limitPrice,
      };
    else if ([4, 5].includes(v.type)) order = { type: v.type, direction: 1, amount: open.amount };
    else order = { type: 8, selector: 0, order: open };
    const cell = packIntent({
      ...base,
      queryId: v.queryId,
      referenceQueryId: v.referenceQueryId ? 0 : undefined,
      order,
    });
    assert.equal(cell.hash().toString('hex'), v.hash);
    assert.equal((await signer.sign(cell.hash())).toString('base64'), v.signature);
    assert.equal(Cell.fromBase64(v.boc).hash().toString('hex'), v.hash);
  });

test('query IDs cross counter boundary and reject overflow', () => {
  for (const id of [0, 1022, 1023, MAX_QUERY_ID]) {
    const s = packIntent({ ...base, queryId: id, order: open }).beginParse();
    assert.equal(s.loadUint(13), Math.floor(id / 1023));
    assert.equal(s.loadUint(10), id % 1023);
  }
  for (const id of [-1, 0.5, MAX_QUERY_ID + 1])
    assert.throws(() => packIntent({ ...base, queryId: id, order: open }), RangeError);
});

test('builder stays outside the signature; attached SL/TP reference the parent', async () => {
  const a = await prepareOrder({ ...base, signer, order: open });
  const b = await prepareOrder({ ...base, signer, order: open, builder: sa.toRawString() });
  assert.equal(a.hash, b.hash);
  assert.equal(a.request.signature, b.request.signature);
  assert.equal(b.request.builder, sa.toRawString());
  const attached = await prepareOrder({
    ...base,
    queryId: 0,
    signer,
    order: { ...open, stopTriggerPrice: 1n, takeTriggerPrice: 2n },
  });
  assert.equal(attached.request.order_requests.length, 2);
  attached.request.order_requests.forEach((r, i) => {
    const s = Cell.fromBase64(r.message).beginParse();
    s.loadUint(13);
    assert.equal(s.loadUint(10), i + 1);
    s.loadUint(32);
    assert.equal(s.loadBit(), true);
    assert.equal(s.loadUint(13), 0);
    assert.equal(s.loadUint(10), 0);
  });
});

test('large JSON quantities and embedded strings survive without precision loss', () => {
  const x = parseV3Json(
    '{"amount":18446744073709551615,"negative":-9007199254740993,"small":123,"text":"escaped \\" 18446744073709551615"}',
  );
  assert.equal(x.amount, '18446744073709551615');
  assert.equal(x.negative, '-9007199254740993');
  assert.equal(x.small, 123);
  assert.equal(x.text, 'escaped " 18446744073709551615');
});

test('submission exposes admission; errors preserve body and do not retry', async () => {
  let calls = 0;
  const client = new V3Client('https://example.test/v3/', async (url, options) => {
    calls++;
    assert.equal(url, 'https://example.test/v3/order/place');
    assert.equal(options.method, 'POST');
    return new Response('{"ok":true,"accepted":true,"intent_hash":"abc"}');
  });
  assert.deepEqual(await client.placeOrder({ sa: 'x' }), {
    ok: true,
    accepted: true,
    intent_hash: 'abc',
  });
  assert.equal(calls, 1);
  const failing = new V3Client('https://example.test', async () => {
    calls++;
    return new Response('{"error":"stale price"}', { status: 503 });
  });
  await assert.rejects(
    failing.placeOrder({ sa: 'x' }),
    err => err instanceof V3ApiError && err.status === 503 && err.body.error === 'stale price',
  );
  assert.equal(calls, 2);
  const disconnected = new V3Client('https://example.test', async () => {
    calls++;
    throw new TypeError('connection lost');
  });
  await assert.rejects(disconnected.placeOrder({ sa: 'x' }), /connection lost/);
  assert.equal(calls, 3);
});

test('cancel validates hash and deposit key init requires deployment', () => {
  assert.throws(() => packCancel(sa, 'abc'), /32-byte hex/);
  const s = packCancel(sa, 'ab'.repeat(32)).beginParse();
  assert(s.loadAddress().equals(sa));
  assert.equal(s.loadBuffer(32).toString('hex'), 'ab'.repeat(32));
  assert.throws(
    () =>
      depositPayload({
        native: true,
        queryId: 0n,
        amount: 1n,
        owner: sa,
        init: false,
        publicKeys: [signer.publicKey],
      }),
    /init=true/,
  );
});

test('close is a take-profit order with zero trigger, stop-market is limit with zero limit', () => {
  assert.equal(
    packOrder({ type: 1, expiration: 0, direction: 0, amount: 1n, triggerPrice: 0n })
      .beginParse()
      .loadUint(4),
    1,
  );
  assert.equal(
    packOrder({ ...open, type: 2, limitPrice: 0n, stopPrice: 1n })
      .beginParse()
      .loadUint(4),
    2,
  );
});

test('account payload hashes match independent Go TL-B serialization', () => {
  const expected = require('./fixtures/v3-account.json');
  const { withdrawalPayload, keyPayload } = require('../dist/v3');
  for (const native of [true, false])
    assert.equal(
      depositPayload({
        native,
        queryId: 1n,
        amount: 1000000000n,
        owner: sa,
        init: true,
        publicKeys: [signer.publicKey],
      })
        .hash()
        .toString('hex'),
      expected[native ? 'depositNative' : 'depositJetton'],
    );
  assert.equal(withdrawalPayload(1n, sa, 1000000000n).hash().toString('hex'), expected.withdraw);
  for (const action of ['add', 'remove', 'removeOthers'])
    assert.equal(keyPayload(action, 1n, signer.publicKey).hash().toString('hex'), expected[action]);
});

test('prepared cancellation retains its own hash before submission', async () => {
  const { prepareCancel } = require('../dist/v3');
  const result = await prepareCancel(sa, 'ab'.repeat(32), signer);
  assert.equal(result.hash, packCancel(sa, 'ab'.repeat(32)).hash().toString('hex'));
  assert.equal(
    result.request.signature,
    (await signer.sign(packCancel(sa, 'ab'.repeat(32)).hash())).toString('base64'),
  );
  assert.equal(result.request.sa, sa.toRawString());
});
