import {
  JettonMasterContract,
  PositionManagerContract,
  StormClient,
  TonClientAbstract,
  VaultContract,
} from '../api-clients';
import { Address, TonClient, TonClient4 } from '@ton/ton';
import { LiteClient } from 'ton-lite-client';
import {
  createAddMarginTx,
  createCancelOrderTx,
  createLimitOrderTx,
  createMarketOrderTx,
  createProvideLiquidityTx,
  createRemoveMarginTx,
  createSLTPOrderTx,
  createWithdrawLiquidityTx,
  TXParams,
} from '../common-packers';
import { OraclePayload, OrderType } from '../base-packers';
import {
  AddMarginParams,
  CancelOrderParams,
  CreateAnyLimitOrderParams,
  CreateSLTPOrderParams,
  LimitOrderParams,
  MarketCloseOrderParams as ClosePositionOrderParams,
  MarketOpenOrderParams,
  ProvideLiquidityParams,
  RemoveMarginParams,
  StopLimitOrderParams,
  StopLossOrderParams,
  StopMarketOrderParams,
  TakeProfitOrderParams,
  WithdrawLiquidityParams,
} from './sdk.types';
import { PositionManagerData } from '../api-clients/contracts/position-manager/position-manager.types';
import { CustomCache } from '../api-clients/utils/cache';

const marketOpenDefaultExpiration = () => Math.floor(Date.now() / 1000) + 15 * 60;
const limitDefaultExpiration = () => Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60;

export class StormTradingSdk {
  private readonly tonClient: TonClientAbstract;
  private readonly traderAddress: Address;
  private readonly jettonWalletsAddressCache: CustomCache<Address> = new CustomCache();
  private readonly positionManagerAddressCache: CustomCache<Address> = new CustomCache();
  private readonly initializedPositionManagersCache: Set<string> = new Set();
  private readonly jettonMasters: CustomCache<JettonMasterContract> = new CustomCache();
  private readonly vaults: CustomCache<VaultContract> = new CustomCache();
  private readonly positionManagers: CustomCache<PositionManagerContract> = new CustomCache();
  private lpWalletsAddressCache: CustomCache<Address> = new CustomCache();

  constructor(
    private readonly stormClient: StormClient,
    tonClient: TonClient | TonClient4 | LiteClient,
    traderAddress: Address | string,
  ) {
    this.traderAddress =
      traderAddress instanceof Address ? traderAddress : Address.parse(traderAddress);
    this.tonClient = new TonClientAbstract(tonClient);
  }

  async init() {
    await Promise.all([
      this.stormClient.config.fetchConfig(),
      this.stormClient.config.fetchAssetsConfig(),
    ]);
  }

  async getPositionManagerAddressByAssets(
    baseAssetName: string,
    collateralAssetName: string,
  ): Promise<Address> {
    const positionAddressByAssetNameAndBaseAsset = this.positionManagerAddressCache.get(
      baseAssetName, collateralAssetName,
    );
    if (positionAddressByAssetNameAndBaseAsset) {
      return positionAddressByAssetNameAndBaseAsset;
    }
    const vamm = this.stormClient.config.requireAmmByAssetName(baseAssetName, collateralAssetName);
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const vaultContract = this.getVaultContract(vault.vaultAddress);
    const vammAddress = Address.parse(vamm.address);
    const positionManagerAddress = await vaultContract.getPositionManagerAddress(
      vammAddress,
      this.traderAddress,
    );
    this.positionManagerAddressCache.set(
      baseAssetName + ':' + collateralAssetName,
      positionManagerAddress,
    );
    return positionManagerAddress;
  }

  async getPositionManagerData(
    positionManagerAddress: Address,
  ): Promise<PositionManagerData | null> {
    const positionManagerContract = this.getPositionManagerContract(
      positionManagerAddress.toRawString(),
    );
    return positionManagerContract.getData();
  }

  async createMarketOpenOrder(opts: MarketOpenOrderParams): Promise<TXParams> {
    await this.prefetchOrderCaches(opts);
    return this.syncCreateMarketOpenOrderParams(opts);
  }

  async provideLiquidity(opts: ProvideLiquidityParams): Promise<TXParams> {
    await this.prefetchProvideLiquidityCaches(opts.assetName);
    return this.syncProvideLiquidityParams(opts);
  }

  syncProvideLiquidityParams(opts: ProvideLiquidityParams) {
    const { assetName } = opts;
    const traderJettonWalletAddress = this.jettonWalletsAddressCache.get(opts.assetName);
    if (!traderJettonWalletAddress) {
      throw new Error(`Jetton wallet for ${opts.assetName} not found`);
    }
    const vault = this.stormClient.config.requireVaultConfigByAssetName(assetName);
    const baseParams = {
      traderAddress: this.traderAddress,
      amount: opts.amount,
      vaultAddress: Address.parse(vault.vaultAddress),
    };

    if (this.isNativeVault(assetName)) {
      return createProvideLiquidityTx({ vaultType: 'native', ...baseParams });
    } else {
      return createProvideLiquidityTx({
        vaultType: 'jetton',
        traderJettonWalletAddress,
        ...baseParams,
      });
    }
  }

  private async prefetchProvideLiquidityCaches(assetName: 'TON' | 'USDT' | 'NOT') {
    await this.getJettonWalletAddressByAssetName(assetName);
  }

  async addMargin(opts: AddMarginParams): Promise<TXParams> {
    const vault = this.stormClient.config.requireVaultConfigByAssetName(opts.collateralAssetName);
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const oraclePayload = opts.oraclePayload
      ? opts.oraclePayload
      : await this.getOraclePayloadByAssets(opts.baseAssetName, opts.collateralAssetName);
    const orderParams = {
      amount: opts.amount,
      direction: opts.direction,
      assetId,
      oracle: oraclePayload,
    };
    const baseParams = {
      traderAddress: this.traderAddress,
      amount: opts.amount,
      vaultAddress: Address.parse(vault.vaultAddress),
      orderParams,
    };

    if (this.isNativeVault(opts.collateralAssetName)) {
      return createAddMarginTx({ vaultType: 'native', ...baseParams });
    } else {
      const traderJettonWalletAddress = await this.getJettonWalletAddressByAssetName(
        opts.collateralAssetName,
      );
      return createAddMarginTx({
        vaultType: 'jetton',
        traderJettonWalletAddress,
        ...baseParams,
      });
    }
  }

  async createClosePositionOrder(opts: ClosePositionOrderParams): Promise<TXParams> {
    return this.createTakeProfitOrder({
      ...opts,
      amount: opts.size,
      triggerPrice: 0n,
    });
  }

  async createStopLossOrder(opts: StopLossOrderParams): Promise<TXParams> {
    return this.createSLTPOrder({
      ...opts,
      type: OrderType.stopLoss,
    });
  }

  async createTakeProfitOrder(opts: TakeProfitOrderParams): Promise<TXParams> {
    return this.createSLTPOrder({
      ...opts,
      type: OrderType.takeProfit,
    });
  }

  async createLimitOrder(opts: LimitOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder({ ...opts, stopPrice: 0n });
  }

  async createStopLimitOrder(opts: StopLimitOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder(opts);
  }

  async createStopMarketOrder(opts: StopMarketOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder({ ...opts, limitPrice: 0n });
  }

  async cancelOrder(opts: CancelOrderParams): Promise<TXParams> {
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      opts.baseAssetName,
      opts.collateralAssetName,
    );
    return createCancelOrderTx({
      positionManagerAddress,
      orderParams: {
        orderType: opts.orderType,
        orderIndex: opts.orderIndex,
        direction: opts.direction,
      },
    });
  }

  async removeMargin(opts: RemoveMarginParams): Promise<TXParams> {
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const oraclePayload = opts.oraclePayload
      ? opts.oraclePayload
      : await this.getOraclePayloadByAssets(opts.baseAssetName, opts.collateralAssetName);
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      opts.baseAssetName,
      opts.collateralAssetName,
    );
    const orderParams = {
      assetId,
      amount: opts.amount,
      direction: opts.direction,
      oracle: oraclePayload,
    };
    const baseParams = {
      traderAddress: this.traderAddress,
      orderParams,
      amount: opts.amount,
      positionManagerAddress,
    };

    return createRemoveMarginTx({ ...baseParams });
  }

  async withdrawLiquidity(opts: WithdrawLiquidityParams): Promise<TXParams> {
    const { assetName } = opts;
    await this.prefetchWithdrawLiquidityCaches(assetName);
    return this.syncWithdrawLiquidity(opts);
  }

  private syncWithdrawLiquidity(opts: WithdrawLiquidityParams) {
    const lpWalletAddress = this.lpWalletsAddressCache.get(opts.assetName);
    if (!lpWalletAddress) {
      throw new Error(`LP wallet for ${opts.assetName} not found`);
    }
    return createWithdrawLiquidityTx({
      lpWalletAddress,
      amount: opts.amountOfSLP,
      userAddress: this.traderAddress,
    });
  }

  private async prefetchWithdrawLiquidityCaches(assetName: 'TON' | 'USDT' | 'NOT') {
    if (this.lpWalletsAddressCache.get(assetName)) {
      return;
    }
    const vault = this.stormClient.config.requireVaultConfigByAssetName(assetName);
    const lpJettonMasterContract = this.getJettonMasterContract(vault.lpJettonMaster);
    const lpWalletAddress = await lpJettonMasterContract.getJettonWalletAddress(this.traderAddress);
    this.lpWalletsAddressCache.set(assetName, lpWalletAddress);
  }

  private syncCreateMarketOpenOrderParams(opts: MarketOpenOrderParams) {
    const traderJettonWalletAddress = this.jettonWalletsAddressCache.getOrThrow(opts.collateralAssetName);
    const positionManagerAddress = this.positionManagerAddressCache.getOrThrow(
      opts.baseAssetName, opts.collateralAssetName,
    );
    const vault = this.stormClient.config.requireVaultConfigByAssetName(opts.collateralAssetName);
    const vaultAddress = Address.parse(vault.vaultAddress);
    const baseParams = {
      traderAddress: this.traderAddress,
      vaultAddress,
      amount: opts.amount,
    };
    const orderParams = {
      ...opts,
      limitPrice: 0n,
      assetId: this.stormClient.config.requireAssetIndexByName(opts.baseAssetName),
      initPositionManager: !this.initializedPositionManagersCache.has(
        positionManagerAddress.toRawString(),
      ),
      expiration: marketOpenDefaultExpiration(),
      minBaseAssetAmount: opts.minBaseAssetAmount ?? 0n,
      stopTriggerPrice: opts.stopTriggerPrice ?? 0n,
      takeTriggerPrice: opts.takeTriggerPrice ?? 0n,
    };
    if (this.isNativeVault(opts.collateralAssetName)) {
      return createMarketOrderTx({
        orderParams,
        ...baseParams,
        vaultType: 'native',
      });
    } else {
      return createMarketOrderTx({
        orderParams,
        ...baseParams,
        vaultType: 'jetton',
        traderJettonWalletAddress,
      });
    }
  }

  private async prefetchOrderCaches(opts: {
    baseAssetName: string;
    collateralAssetName: string;
  }) {
    const { baseAssetName, collateralAssetName } = opts;
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      baseAssetName,
      collateralAssetName,
    );
    await this.checkIsPositionManagerInitialized(positionManagerAddress);

    if (!this.isNativeVault(collateralAssetName))
      await this.getJettonWalletAddressByAssetName(collateralAssetName);
  }

  private async getJettonWalletAddressByAssetName(collateralAssetName: string): Promise<Address> {
    let jettonWalletAddress = this.jettonWalletsAddressCache.get(collateralAssetName);
    if (jettonWalletAddress) {
      return jettonWalletAddress;
    }
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const jettonMasterContract = this.getJettonMasterContract(vault.quoteAssetId);
    jettonWalletAddress = await jettonMasterContract.getJettonWalletAddress(this.traderAddress);
    this.jettonWalletsAddressCache.set(collateralAssetName, jettonWalletAddress);
    return jettonWalletAddress;
  }

  private isNativeVault(collateralAssetName: string): boolean {
    return collateralAssetName === 'TON';
  }

  private async checkIsPositionManagerInitialized(
    positionManagerAddress: Address,
  ): Promise<boolean> {
    if (this.initializedPositionManagersCache.has(positionManagerAddress.toRawString())) {
      return true;
    }
    try {
      const positionManagerData = await this.getPositionManagerData(positionManagerAddress);
      if (!(positionManagerData === null || positionManagerData.referralData === null)) {
        this.initializedPositionManagersCache.add(positionManagerAddress.toRawString());
        return true;
      } else {
        return false;
      }
    } catch (_) {
      return false;
    }
  }

  private async getOraclePayloadByAssets(
    baseAssetName: string,
    collateralAssetName: string,
  ): Promise<OraclePayload> {
    const oraclePriceResp = await this.stormClient.oracleClient.getPrice(baseAssetName);
    const oraclePayload = { ...oraclePriceResp.result_message };
    if (collateralAssetName === 'USDT') {
      return { ...oraclePayload, oraclePayloadKind: 'simple' };
    }
    const { priceRef, signaturesRef } = oraclePayload;
    if (collateralAssetName === baseAssetName) {
      return {
        ...oraclePayload,
        settlementPriceRef: priceRef,
        settlementSignaturesRef: signaturesRef,
        oraclePayloadKind: 'withSettlement',
      };
    }
    const oraclePayloadRespForSettlement =
      await this.stormClient.oracleClient.getPrice(collateralAssetName);
    const { priceRef: settlementPriceRef, signaturesRef: settlementSignaturesRef } =
      oraclePayloadRespForSettlement.result_message;
    return {
      ...oraclePayload,
      settlementPriceRef,
      settlementSignaturesRef,
      oraclePayloadKind: 'withSettlement',
    };
  }

  private async createSLTPOrder(opts: CreateSLTPOrderParams): Promise<TXParams> {
    const { baseAssetName, collateralAssetName } = opts;
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      baseAssetName,
      collateralAssetName,
    );
    return createSLTPOrderTx({
      positionManagerAddress,
      orderParams: {
        amount: opts.amount,
        direction: opts.direction,
        type: opts.type,
        triggerPrice: opts.triggerPrice,
        expiration: 0,
      },
    });
  }

  private async internalCreateLimitOrder(opts: CreateAnyLimitOrderParams): Promise<TXParams> {
    const { baseAssetName, collateralAssetName } = opts;
    await this.prefetchOrderCaches(opts);
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const assetId = this.stormClient.config.requireAssetIndexByName(baseAssetName);
    // TODO: Get those values
    const isPositionManagerInitialized =
    const positionManagerAddress =

    const orderParams = {
      assetId,
      initPositionManager: !isPositionManagerInitialized,
      amount: opts.amount,
      leverage: opts.leverage,
      stopPrice: opts.stopPrice,
      direction: opts.direction,
      limitPrice: opts.limitPrice,
      stopTriggerPrice: opts.stopTriggerPrice ?? 0n,
      takeTriggerPrice: opts.takeTriggerPrice ?? 0n,
      expiration: opts.expiration ?? limitDefaultExpiration(),
    };

    const baseParams = {
      traderAddress: this.traderAddress,
      amount: opts.amount,
      orderParams,
      positionManagerAddress,
      vaultAddress: Address.parse(vault.vaultAddress),
    };

    if (this.isNativeVault(collateralAssetName)) {
      return createLimitOrderTx({
        ...baseParams,
        vaultType: 'native',
      });
    } else {
      const traderJettonWalletAddress =
      return createLimitOrderTx({
        ...baseParams,
        vaultType: 'jetton',
        traderJettonWalletAddress,
      });
    }
  }

  private getVaultContract(address: string): VaultContract {
    let contract = this.vaults.get(address);
    if (contract) {
      return contract;
    }
    contract = new VaultContract(this.tonClient, Address.parse(address));
    this.vaults.set(address, contract);
    return contract;
  }

  private getJettonMasterContract(address: string): JettonMasterContract {
    let contract = this.jettonMasters.get(address);
    if (contract) {
      return contract;
    }
    contract = new JettonMasterContract(this.tonClient, Address.parse(address));
    this.jettonMasters.set(address, contract);
    return contract;
  }

  private getPositionManagerContract(address: string): PositionManagerContract {
    let contract = this.positionManagers.get(address);
    if (contract) {
      return contract;
    }
    contract = new PositionManagerContract(this.tonClient, Address.parse(address));
    this.positionManagers.set(address, contract);
    return contract;
  }
}
