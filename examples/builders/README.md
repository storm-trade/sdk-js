# Builders V3 example

Requires Node 22 and the SDK revision that introduces the `/v3` export.
From this checkout: `npm ci`, `npm run build`. The CLI imports public package exports.
For an independent application, install the packed SDK and `@ton/ton`, then copy this directory.

Read-only commands:

```sh
node examples/builders/cli.cjs status
node examples/builders/cli.cjs registry
node examples/builders/cli.cjs query-id "$SMART_ACCOUNT"
node examples/builders/cli.cjs balances "$SMART_ACCOUNT"
node examples/builders/cli.cjs positions "$SMART_ACCOUNT"
```

The default endpoint is stage. `STORM_V3_URL` overrides it. Verify service lag before trading.
Use a dedicated stage account. Keys are supplied by your process environment; never commit them.

`market-order.json` is an **offline serialization example**, not a valid live order.
Replace Smart Account and market addresses with discovered stage addresses, builder with your registered address,
`createdAt` with current Unix seconds minus a small clock-skew allowance, `expiration` with the intended expiry,
and `queryId` with an exclusively allocated user ID. All amount/price/leverage inputs are decimal integer strings.
Market orders use internal 9-decimal collateral amounts; deposits use token-native decimals.

Set `STORM_SIGNING_SEED` to the 32-byte Ed25519 seed for the registered signing key (hex).
Prepare and persist before sending:

```sh
node examples/builders/cli.cjs prepare my-order.json > prepared-order.json
node examples/builders/cli.cjs submit prepared-order.json
node examples/builders/cli.cjs intent "$INTENT_HASH"
node examples/builders/cli.cjs bundles "$SMART_ACCOUNT"
```

Reserve one ID for the parent plus one for each nonzero SL/TP trigger. Query ID lookup is not a reservation.
Coordinate all writers for the account. Do not create a new signed order on a submission timeout: reconcile the saved hash first.
`accepted` and intent `done` are not on-chain finality. Match the hash in account bundles, then require the matching
bundle's confirmed outcome and reconcile indexed transaction/account state. If records have expired, use indexed chain history.

Order variants use the same `prepare` command:

- Limit: `type:2`, positive `limitPrice`, `stopPrice:"0"`.
- Stop market: `type:2`, `limitPrice:"0"`, positive `stopPrice`.
- Stop limit: `type:2`, positive limit and stop prices.
- SL/TP: `type:0` / `type:1`, `expiration`, `direction`, base-size `amount`, `triggerPrice`.
- Close: `type:1`, `triggerPrice:"0"`, base-size `amount`, `expiration:0`.
- Margin: `type:4` / `type:5`, `direction`, internal collateral `amount`.
- Attached SL/TP: nonzero `stopTriggerPrice` / `takeTriggerPrice` on the opening order; child intents are prepared automatically.

Cancel a resting order: create a JSON file with `smartAccount` and `hash`, then run `cli.cjs cancel file.json`.
Cancellation is signed independently; reconcile its response/hash and the target order status.

Account setup uses wallet-signed TON transactions, separate from raw intent signing:

- `cli.cjs address file.json`: input `{rpc,factory,owner}`, optional `TONCENTER_API_KEY`; returns the derived Smart Account.
- `cli.cjs account file.json`: returns a TON Connect transaction request. Send it with your connected owner wallet's
  `tonConnect.sendTransaction(request)` and reconcile the resulting transaction, balance and key registration before trading.
- Deposit input: `{action:"deposit",native:true,queryId:"1",amount:"1000000000",owner,vault,init:true,publicKey,gas}`.
  `publicKey` is base64; `gas` is nanotons. Fetch current minimum fees from the factory `get_min_fees` and include forwarding costs.
- Jetton deposit: `native:false`, amount in token-native units, `jettonWallet` = owner's jetton wallet,
  `forwardGas` = nanotons forwarded to vault, `gas` = total nanotons attached to jetton-wallet transfer.
- Withdraw: `{action:"withdraw",queryId:"2",smartAccount,vault,amount,gas}`.
- Keys: `{action:"add"|"remove"|"removeOthers",queryId:"3",smartAccount,publicKey,gas}`.

The owner pays transaction gas. The `builder` address identifies the integration and does not replace the owner or signing key.
