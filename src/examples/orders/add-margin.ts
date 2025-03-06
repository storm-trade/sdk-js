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
import { OracleClient, StormClient } from '../../api-clients';
import { Direction } from '../../base-packers';
import { StormTradingSdk } from '../../sdk';

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
  await tradingSdk.init();
  const sdkManager = await SdkManager.initialize(MNEMONICS, tonClient, STORM_API_URL);

  const addMarginParamsWithJettonCollateral = await tradingSdk.addMargin({
    baseAssetName: 'XRP',
    collateralAssetName: 'NOT',
    direction: Direction.long,
    amount: 1_00_000_000n,
  });

  const addMarginParamsWithNativeCollateral = await tradingSdk.addMargin({
    baseAssetName: 'XRP',
    collateralAssetName: 'TON',
    direction: Direction.short,
    amount: 100_000_000n,
  });

  await sdkManager.sendTransactionToBlockChain(addMarginParamsWithJettonCollateral);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToBlockChain(addMarginParamsWithNativeCollateral);
}

main().catch(console.error);
