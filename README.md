# @storm-trade/trading-sdk

A powerful TypeScript-based SDK for financial trading operations, specifically designed for [Storm Trade](https://app.storm.tg).
This SDK provides a comprehensive set of tools for managing trading positions, orders, and liquidity operations.

## Features

- 📈 Market & Limit Orders
- 🛡️ Stop Loss & Take Profit Orders
- 💰 Liquidity Management
- 💼 Position Management
- 🔄 Margin Operations

## Installation

```bash
npm install @storm-trade/trading-sdk @ton/ton
```

## SDK Initialization

```typescript
import { TonClient } from '@ton/ton';
import { TradingSdk } from '@storm-trade/trading-sdk/sdk';
import { StormClient, OracleClient } from '@storm-trade/trading-sdk/api-clients';

// Stage Environment URLs
const ORACLE_URL = 'https://oracle.stage.stormtrade.dev';
const STORM_API_URL = 'https://api.stage.stormtrade.dev/api';
const TON_CENTER = 'https://testnet.toncenter.com/api/v2/jsonRPC';

// For Mainnet use
// const ORACLE_URL = 'https://oracle.storm.tg';
// const STORM_API_URL = 'https://api5.storm.tg/api';
// const TON_CENTER = 'https://toncenter.com/api/v2/jsonRPC';

// Initialize TonClient
const tonClient = new TonClient({
  endpoint: TON_CENTER,
  apiKey: YOUR_TONCENTER_API_KEY, // Get your API key from https://toncenter.com/
});

// Initialize the SDK
const tradingSdk = new StormTradingSdk(
  new StormClient(STORM_API_URL, new OracleClient(ORACLE_URL)),
  tonClient,
  TRADER_ADDRESS, // Your TON wallet address (as string or Address object)
);

// Initialize the SDK (required before using it)
await tradingSdk.init();
```

## Understanding Value Formats

All amount values in the SDK use the smallest unit of the respective asset:

| Asset       | Decimals | Example                                 |
|-------------|----------|----------------------------------------|
| TON         | 9        | 1 TON = 1_000_000_000n (1e9 nanotons)  |
| USDT        | 6        | 1 USDT = 1_000_000n (1e6 units)        |
| NOT         | 9        | 1 NOT = 1_000_000_000n (1e9 units)     |
| Leverage    | 9        | 2x = 2_000_000_000n                    |
| Price       | 9        | 100$ = 100_000_000_000n             |

## Usage Examples

### Creating Market Orders

```typescript
// Market order using native TON as collateral
const marketOrderParams = await tradingSdk.createMarketOpenOrder({
  baseAssetName: 'XRP',                // The asset you want to trade
  collateralAssetName: 'TON',          // Using TON as collateral
  direction: Direction.long,           // Opening a long position
  amount: 1_000_000_000n,              // 1 TON (amount of collateral to use)
  leverage: 2_000_000_000n,            // 2x leverage
  // Optional parameters
  minBaseAssetAmount: 900_000_000n,    // Minimum base asset to receive (slippage protection)
  stopTriggerPrice: 80_000_000_000n,   // Auto-create stop loss at execution
  takeTriggerPrice: 120_000_000_000n,  // Auto-create take profit at execution
  expiration: Math.floor(Date.now() / 1000) + 15 * 60, // Custom expiration in Unix timestamp in seconds
});
```

#### Market Orders

```typescript
// Market order using a Jetton (NOT) as collateral
const marketOrderWithJetton = await tradingSdk.createMarketOpenOrder({
  baseAssetName: 'XRP', // The trading pair's base asset
  collateralAssetName: 'NOT', // Using NOT jetton as collateral
  direction: Direction.long, // Opening a long position
  amount: 1_00_000_000n, // 0.1 NOT (amount of collateral to use)
  leverage: 2000_000_000n, // 2x leverage
  minBaseAssetAmount: 90_000_000n, // Minimum amount of XRP to receive (slippage protection)
});

// Market order using native TON as collateral
const marketOrderWithTON = await tradingSdk.createMarketOpenOrder({
  baseAssetName: 'XRP', // The trading pair's base asset
  collateralAssetName: 'TON', // Using native TON as collateral
  direction: Direction.short, // Opening a short position (betting price will go down)
  amount: 100_000_000n, // 0.1 TON (amount of collateral to use)
  leverage: 3000_000_000n, // 3x leverage
  minBaseAssetAmount: 90_000_000n, // Minimum amount of XRP to receive (slippage protection)
});
```

Market orders execute immediately at the current market price. The examples show:

1. Using different collateral types (Jetton vs Native TON)
2. Different trading directions (long vs short)
3. Different leverage amounts (2x vs 3x)
4. Slippage protection with minBaseAssetAmount

### Creating Limit Orders

```typescript
const limitOrderParams = await tradingSdk.createLimitOrder({
  baseAssetName: 'XRP', // The trading pair's base asset
  limitPrice: 1_00_000_000_000n, // Price in nanotons (1e9 TON), here it's 100 TON
  collateralAssetName: 'TON', // Using TON as collateral
  direction: Direction.long, // Opening a long position
  amount: 1_000_000_000n, // 1 TON (amount of collateral to use)
  leverage: 2000_000_000n, // Leverage of 2x (specified in 1e9 format)
});
```

This example creates a limit order with the following characteristics:

- Trading XRP with TON as collateral
- Setting a limit price of 100 TON per XRP
- Opening a long position (betting that XRP price will go up)
- Using 1 TON as collateral (specified as 1e9 units)
- Using 2x leverage to amplify potential gains (and risks)

#### Stop Market and Stop Limit Orders

```typescript
// Stop market order
const stopMarketOrder = await tradingSdk.createStopMarketOrder({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,
  amount: 1_000_000_000n, // 1 TON (amount of collateral to use)
  leverage: 2_000_000_000n, // 2x leverage
  stopPrice: 105_000_000_000n, // Triggers when price reaches 105 TON per XRP
  minBaseAssetAmount: 900_000_000n, // Minimum amount of XRP to receive (slippage protection)
});

// Stop limit order
const stopLimitOrder = await tradingSdk.createStopLimitOrder({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,
  amount: 1_000_000_000n, // 1 TON (amount of collateral to use)
  leverage: 2_000_000_000n, // 2x leverage
  stopPrice: 105_000_000_000n, // Triggers when price reaches 105 TON per XRP
  limitPrice: 106_000_000_000n, // Limit price for execution after trigger
});
```

### Liquidity Management

```typescript
// Providing liquidity with NOT jetton
await tradingSdk.provideLiquidity({
  assetName: 'NOT', // The asset to provide liquidity for
  amount: 1_00_000_000n, // 0.1 NOT (amount of collateral to use)
});

// Providing liquidity with USDT
await tradingSdk.provideLiquidity({
  assetName: 'USDT', // USDT as liquidity asset
  amount: 1_000_000n, // 1 USDT (USDT uses 6 decimal places)
});

// Providing liquidity with native TON
await tradingSdk.provideLiquidity({
  assetName: 'TON', // Native TON as liquidity asset
  amount: 1_00_000_000n, // 0.1 TON
});
```

Liquidity provision examples demonstrate:

1. Support for different asset types (Jettons and native TON)
2. Different decimal precision handling:
    - TON and most assets (9 decimals):
        - 1 TON = 1_000_000_000n (1e9 nanotons)
        - 0.5 TON = 500_000_000n (0.5 \* 1e9 nanotons)
    - USDT (6 decimals):
        - 1 USDT = 1_000_000n (1e6 units)
        - 0.5 USDT = 500_000n (0.5 \* 1e6 units)
3. The provided liquidity can be used by traders for leveraged trading

### Position Management

```typescript
// Adding margin to an existing position
await tradingSdk.addMargin({
  baseAssetName: 'BTC', // The trading pair's base asset
  collateralAssetName: 'TON', // Collateral type to add
  amount: 500_000_000n, // Adding 0.5 TON as additional margin
  direction: Direction.long, // For the long position
});

// Removing margin from a position
await tradingSdk.removeMargin({
  baseAssetName: 'BTC', // The trading pair's base asset
  collateralAssetName: 'TON', // Collateral type to remove
  amount: 200_000_000n, // Removing 0.2 TON of margin
  direction: Direction.long, // From the long position
});
```

### Stop Loss and Take Profit Orders

```typescript
// Setting a Stop Loss order
const stopLossOrder = await tradingSdk.createStopLossOrder({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,
  amount: 1_000_000_000n,              // 1 TON (amount of collateral to use)
  triggerPrice: 90_000_000_000n,       // Stop loss triggers at 90 TON per XRP
});

// Setting a Take Profit order
const takeProfitOrder = await tradingSdk.createTakeProfitOrder({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,
  amount: 1_000_000_000n,              // 1 TON (amount of collateral to use)
  triggerPrice: 110_000_000_000n,      // Take profit triggers at 110 TON per XRP
});
```

### Closing a Position

```typescript
// Close position (partially or fully)
const closePositionParams = await tradingSdk.createClosePositionOrder({
  baseAssetName: 'XRP',                // The asset in the position
  collateralAssetName: 'TON',          // Collateral asset of the position
  direction: Direction.long,           // Direction of the position to close
  size: 1_000_000_000n,                // Amount of base asset to close (1 XRP)
});
```

### Canceling an Order

```typescript
// Cancel a pending order
const cancelOrderParams = await tradingSdk.cancelOrder({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,
  orderType: OrderType.limit,          // Order type to cancel
  orderIndex: 0,                       // Order index in the position (can be retrieved from tradingSdk.getPositionManagerData)
});
```

### Managing Position Margin

```typescript
// Add margin to position
const addMarginParams = await tradingSdk.addMargin({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,           // Direction of the position
  amount: 500_000_000n,                // Adding 0.5 TON as additional margin
  // Optional parameter
  oraclePayload: oracleData,           // Custom oracle data (if available)
});

// Remove margin from a position
const removeMarginParams = await tradingSdk.removeMargin({
  baseAssetName: 'XRP',
  collateralAssetName: 'TON',
  direction: Direction.long,           // Direction of the position
  amount: 200_000_000n,                // Removing 0.2 TON of margin
  // Optional parameter  
  oraclePayload: oracleData,           // Custom oracle data (if available)
});
```

### Liquidity Management

```typescript
// Providing liquidity with native TON
const provideLiquidityParams = await tradingSdk.provideLiquidity({
  assetName: 'TON',                    // Asset to provide as liquidity
  amount: 1_000_000_000n,              // 1 TON
});

// Withdraw liquidity
const withdrawLiquidityParams = await tradingSdk.withdrawLiquidity({
  assetName: 'TON',                    // Asset to withdraw
  amountOfSLP: 500_000_000n,           // 0.5 SLP tokens (Storm Liquidity Provider tokens)
});
```

## Integration with TON Connect

For frontend applications, you can integrate with TON Connect to allow users to connect their TON wallets:

```typescript
import { TonConnectUI } from '@tonconnect/ui';
import { StormTradingSdk } from '@storm-trade/trading-sdk';
import { StormClient, OracleClient } from '@storm-trade/trading-sdk';

// Initialize TonConnect UI
const tonConnectUI = new TonConnectUI({
  manifestUrl: 'https://your-app.com/tonconnect-manifest.json',
});

// Initialize Storm Trading SDK with TON Connect
const tradingSdk = new StormTradingSdk(
  new StormClient(STORM_API_URL, new OracleClient(ORACLE_URL)),
  tonConnectUI.connector, // Use TonConnect as the client
  tonConnectUI.wallet?.account.address || '', // User's wallet address from TON Connect
);

// Initialize the SDK
await tradingSdk.init();

// Format transaction parameters for TON Connect
const formatTxParamsForTonConnect = (txParams) => {
  return {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    messages: [
      {
        address: txParams.to.toString(),
        amount: txParams.value.toString(),
        payload: txParams.body.toBoc().toString('base64')
      }
    ]
  };
};

// Usage example
const txParams = await tradingSdk.provideLiquidity({
  assetName: 'TON',
  amount: 1_000_000_000n, // 1 TON
});

// Convert params for TON Connect
const transaction = formatTxParamsForTonConnect(txParams);

// Send transaction through TON Connect
const result = await tonConnectUI.sendTransaction(transaction);
```
