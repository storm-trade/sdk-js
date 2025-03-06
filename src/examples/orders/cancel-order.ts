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
import { Direction, OrderType } from '../../base-packers';

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
  const cancelOrderParamsWithJettonCollateral = await tradingSdk.cancelOrder({
    baseAssetName: 'XRP',
    collateralAssetName: 'NOT',
    direction: Direction.long,
    orderIndex: 0,
    orderType: OrderType.stopLoss,
  });
  const cancelOrderParamsWithNativeCollateral = await tradingSdk.cancelOrder({
    baseAssetName: 'XRP',
    collateralAssetName: 'TON',
    direction: Direction.short,
    orderIndex: 1,
    orderType: OrderType.takeProfit,
  });
  await sdkManager.sendTransactionToSequencer(cancelOrderParamsWithJettonCollateral);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToSequencer(cancelOrderParamsWithNativeCollateral);
}

main().catch(console.error);
