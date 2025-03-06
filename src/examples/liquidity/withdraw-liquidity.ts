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

  const withdrawLiquidityParamsWithJettonCollateralNOT = await tradingSdk.withdrawLiquidity({
    assetName: 'NOT',
    amountOfSLP: 1_000_000n,
  });

  const withdrawLiquidityParamsWithJettonCollateralUSDT = await tradingSdk.withdrawLiquidity({
    assetName: 'USDT',
    amountOfSLP: 1_000_000_000n,
  });

  const withdrawLiquidityParamsWithNativeCollateral = await tradingSdk.withdrawLiquidity({
    assetName: 'TON',
    amountOfSLP: 1_0_000_000n,
  });

  await sdkManager.sendTransactionToBlockChain(withdrawLiquidityParamsWithJettonCollateralNOT);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToBlockChain(withdrawLiquidityParamsWithJettonCollateralUSDT);
  await new Promise(resolve => setTimeout(resolve, 10000));
  await sdkManager.sendTransactionToBlockChain(withdrawLiquidityParamsWithNativeCollateral);
}

main().catch(console.error);
