import { TonClient } from '@ton/ton';
import { StormTradingSdk } from '../../sdk';
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

  const provideLiquidityParamsWithJettonCollateralNOT = await tradingSdk.provideLiquidity({
    assetName: 'NOT',
    amount: 1_00_000_000n,
  });

  const provideLiquidityParamsWithJettonCollateralUSDT = await tradingSdk.provideLiquidity({
    assetName: 'USDT',
    amount: 1_000_000n,
  });

  const provideLiquidityParamsWithNativeCollateral = await tradingSdk.provideLiquidity({
    assetName: 'TON',
    amount: 1_00_000_000n,
  });

  await sdkManager.sendTransactionToBlockChain(provideLiquidityParamsWithJettonCollateralNOT);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToBlockChain(provideLiquidityParamsWithJettonCollateralUSDT);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToBlockChain(provideLiquidityParamsWithNativeCollateral);
}

main().catch(console.error);
