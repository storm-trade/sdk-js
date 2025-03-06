import { TonClient } from '@ton/ton';
import {
  MNEMONICS,
  ORACLE_URL,
  STORM_API_URL,
  TON_CENTER_TESTNET,
  TONCENTER_API_KEY,
  TRADER_ADDRESS,
} from '../utils/constants';
import { SdkManager } from '../utils/sdk-manager';
import { StormTradingSdk } from '../../sdk';
import { OracleClient, StormClient } from '../../api-clients';
import { Direction } from '../../base-packers';

async function main() {
  const tonClient = new TonClient({
    endpoint: TON_CENTER_TESTNET,
    apiKey: TONCENTER_API_KEY,
  });

  const tradingSdk = new StormTradingSdk(
    new StormClient(STORM_API_URL, new OracleClient(ORACLE_URL)),
    tonClient,
    TRADER_ADDRESS,
  );
  const sdkManager = await SdkManager.initialize(MNEMONICS, tonClient, STORM_API_URL);
  await tradingSdk.init();
  const stopMarketOrderParamsWithJettonCollateral = await tradingSdk.createStopMarketOrder({
    baseAssetName: 'XRP',
    stopPrice: 1_00_000_000_000n,
    collateralAssetName: 'NOT',
    direction: Direction.long,
    amount: 1_000_000_000n,
    leverage: 2000_000_000n,
  });

  const stopMarketOrderParamsWithNativeCollateral = await tradingSdk.createStopMarketOrder({
    baseAssetName: 'XRP',
    collateralAssetName: 'TON',
    stopPrice: 1_000_000n,
    direction: Direction.short,
    amount: 1000_000_000n,
    leverage: 3000_000_000n,
  });

  await sdkManager.sendTransactionToSequencer(stopMarketOrderParamsWithJettonCollateral);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToSequencer(stopMarketOrderParamsWithNativeCollateral);
}

main().catch(console.error);
