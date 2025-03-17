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
  CollateralAssets,
  AddMarginWithOraclePayload,
  RemoveMarginWithOraclePayload,
} from './sdk.types';
import { PositionManagerData } from '../api-clients/contracts/position-manager/position-manager.types';
import { Cache } from '../api-clients/utils/cache';

const marketOpenDefaultExpiration = () => Math.floor(Date.now() / 1000) + 15 * 60;
const limitDefaultExpiration = () => Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60;

export class StormTradingSdk {
  private readonly tonClient: TonClientAbstract;
  private readonly traderAddress: Address;
  private readonly jettonWalletsAddressCache: Cache<Address> = new Cache();
  private readonly positionManagerAddressCache: Cache<Address> = new Cache();
  private readonly initializedPositionManagersCache: Cache<boolean> = new Cache();
  private readonly jettonMasters: Cache<JettonMasterContract> = new Cache();
  private readonly vaults: Cache<VaultContract> = new Cache();
  private readonly positionManagers: Cache<PositionManagerContract> = new Cache();
  private lpWalletsAddressCache: Cache<Address> = new Cache();

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
    const positionAddressByAssetNameAndBaseAsset = this.positionManagerAddressCache.get([
      baseAssetName,
      collateralAssetName,
    ]);
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
    await this.prefetchCreateMarketOpenOrderCaches(opts);
    return this.syncCreateMarketOpenOrderParams(opts);
  }

  async provideLiquidity(opts: ProvideLiquidityParams): Promise<TXParams> {
    await this.prefetchProvideLiquidityCaches(opts);
    return this.syncProvideLiquidityParams(opts);
  }

  syncProvideLiquidityParams(opts: ProvideLiquidityParams) {
    const { assetName } = opts;
    const vault = this.stormClient.config.requireVaultConfigByAssetName(assetName);
    const baseParams = {
      traderAddress: this.traderAddress,
      amount: opts.amount,
      vaultAddress: Address.parse(vault.vaultAddress),
    };

    if (this.isNativeVault(assetName)) {
      return createProvideLiquidityTx({ vaultType: 'native', ...baseParams });
    } else {
      const traderJettonWalletAddress = this.jettonWalletsAddressCache.getOrThrow(opts.assetName);
      return createProvideLiquidityTx({
        vaultType: 'jetton',
        traderJettonWalletAddress,
        ...baseParams,
      });
    }
  }

  async prefetchProvideLiquidityCaches(opts: { assetName: CollateralAssets }) {
    if (!this.isNativeVault(opts.assetName)) {
      await this.getJettonWalletAddressByAssetName(opts.assetName);
    }
  }

  async prefetchRemoveMarginCaches(opts: {
    baseAssetName: string;
    collateralAssetName: CollateralAssets;
  }) {
    await this.getPositionManagerAddressByAssets(opts.baseAssetName, opts.collateralAssetName);
  }

  async prefetchAddMarginCaches(opts: {
    baseAssetName: string;
    collateralAssetName: CollateralAssets;
  }) {
    if (!this.isNativeVault(opts.collateralAssetName)) {
      await this.getJettonWalletAddressByAssetName(opts.collateralAssetName);
    }
  }

  syncAddMargin(opts: AddMarginWithOraclePayload) {
    const { collateralAssetName } = opts;
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const orderParams = {
      amount: opts.amount,
      direction: opts.direction,
      assetId,
      oracle: opts.oraclePayload,
    };
    const baseParams = {
      traderAddress: this.traderAddress,
      amount: opts.amount,
      vaultAddress: Address.parse(vault.vaultAddress),
      orderParams,
    };

    if (this.isNativeVault(collateralAssetName)) {
      return createAddMarginTx({ vaultType: 'native', ...baseParams });
    } else {
      const traderJettonWalletAddress =
        this.jettonWalletsAddressCache.getOrThrow(collateralAssetName);
      return createAddMarginTx({
        vaultType: 'jetton',
        traderJettonWalletAddress,
        ...baseParams,
      });
    }
  }

  async addMargin(opts: AddMarginParams): Promise<TXParams> {
    await this.prefetchAddMarginCaches(opts);
    const oraclePayload = await this.getOraclePayloadByAssets(opts.baseAssetName, opts.collateralAssetName);
    return this.syncAddMargin({ ...opts, oraclePayload });
  }

  async createClosePositionOrder(opts: ClosePositionOrderParams): Promise<TXParams> {
    return this.createTakeProfitOrder({
      ...opts,
      amount: opts.size,
      triggerPrice: 0n,
    });
  }

  syncCreateClosePositionOrder(opts: ClosePositionOrderParams) {
    return this.syncCreateTakeProfitOrder({
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

  syncCreateStopLossOrder(opts: StopLossOrderParams) {
    return this.syncCreateSLTPOrder({
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

  syncCreateTakeProfitOrder(opts: TakeProfitOrderParams) {
    return this.syncCreateSLTPOrder({
      ...opts,
      type: OrderType.takeProfit,
    });
  }

  async createLimitOrder(opts: LimitOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder({ ...opts, stopPrice: 0n });
  }

  syncCreateLimitOrder(opts: LimitOrderParams) {
    return this.syncInternalCreateLimitOrder({ ...opts, stopPrice: 0n });
  }

  async createStopLimitOrder(opts: StopLimitOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder(opts);
  }

  syncCreateStopLimitOrder(opts: StopLimitOrderParams) {
    return this.syncInternalCreateLimitOrder(opts);
  }

  async createStopMarketOrder(opts: StopMarketOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder({ ...opts, limitPrice: 0n });
  }

  syncCreateStopMarketOrder(opts: StopMarketOrderParams) {
    return this.syncInternalCreateLimitOrder({ ...opts, limitPrice: 0n });
  }

  async cancelOrder(opts: CancelOrderParams): Promise<TXParams> {
    await this.prefetchCancelOrderCaches(opts);
    return this.syncCreateCancelOrder(opts);
  }

  syncCreateCancelOrder(opts: CancelOrderParams) {
    const positionManagerAddress = this.positionManagerAddressCache.getOrThrow([
      opts.baseAssetName,
      opts.collateralAssetName,
    ]);
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
    await this.prefetchRemoveMarginCaches(opts);
    const oraclePayload = await this.getOraclePayloadByAssets(opts.baseAssetName, opts.collateralAssetName);
    return this.syncRemoveMargin({ ...opts, oraclePayload });
  }

  syncRemoveMargin(opts: RemoveMarginWithOraclePayload) {
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const positionManagerAddress = this.positionManagerAddressCache.getOrThrow([
      opts.baseAssetName,
      opts.collateralAssetName,
    ]);
    const orderParams = {
      assetId,
      amount: opts.amount,
      direction: opts.direction,
      oracle: opts.oraclePayload,
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

  syncWithdrawLiquidity(opts: WithdrawLiquidityParams) {
    const lpWalletAddress = this.lpWalletsAddressCache.getOrThrow(opts.assetName);
    return createWithdrawLiquidityTx({
      lpWalletAddress,
      amount: opts.amountOfSLP,
      userAddress: this.traderAddress,
    });
  }

  async prefetchWithdrawLiquidityCaches(assetName: CollateralAssets) {
    if (this.lpWalletsAddressCache.get(assetName)) {
      return;
    }
    const vault = this.stormClient.config.requireVaultConfigByAssetName(assetName);
    const lpJettonMasterContract = this.getJettonMasterContract(vault.lpJettonMaster);
    const lpWalletAddress = await lpJettonMasterContract.getJettonWalletAddress(this.traderAddress);
    this.lpWalletsAddressCache.set(assetName, lpWalletAddress);
  }

  syncCreateMarketOpenOrderParams(opts: MarketOpenOrderParams) {
    const positionManagerAddress = this.positionManagerAddressCache.getOrThrow([
      opts.baseAssetName,
      opts.collateralAssetName,
    ]);
    const vault = this.stormClient.config.requireVaultConfigByAssetName(opts.collateralAssetName);
    const vaultAddress = Address.parse(vault.vaultAddress);
    const baseParams = {
      traderAddress: this.traderAddress,
      vaultAddress,
      amount: opts.amount,
    };
    const initPositionManager = !this.initializedPositionManagersCache.get(
      positionManagerAddress.toRawString(),
    );
    const orderParams = {
      ...opts,
      limitPrice: 0n,
      assetId: this.stormClient.config.requireAssetIndexByName(opts.baseAssetName),
      initPositionManager,
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
      const traderJettonWalletAddress = this.jettonWalletsAddressCache.getOrThrow(
        opts.collateralAssetName,
      );
      return createMarketOrderTx({
        orderParams,
        ...baseParams,
        vaultType: 'jetton',
        traderJettonWalletAddress,
      });
    }
  }

  async prefetchCreateMarketOpenOrderCaches(opts: {
    baseAssetName: string;
    collateralAssetName: string;
  }) {
    const { baseAssetName, collateralAssetName } = opts;
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      baseAssetName,
      collateralAssetName,
    );
    await this.checkIsPositionManagerInitialized(positionManagerAddress);

    if (!this.isNativeVault(collateralAssetName)) {
      await this.getJettonWalletAddressByAssetName(collateralAssetName);
    }
  }

  prefetchInternalLimitOrderCaches = this.prefetchCreateMarketOpenOrderCaches;

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
    if (this.initializedPositionManagersCache.get(positionManagerAddress.toRawString())) {
      return true;
    }
    try {
      const positionManagerData = await this.getPositionManagerData(positionManagerAddress);
      if (!(positionManagerData === null || positionManagerData.referralData === null)) {
        this.initializedPositionManagersCache.set(positionManagerAddress.toRawString(), true);
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
      const oraclePayloadResp = {
        ...oraclePayload,
        oraclePayloadKind: 'simple',
      } as const;
      return oraclePayloadResp;
    }
    const { priceRef, signaturesRef } = oraclePayload;
    if (collateralAssetName === baseAssetName) {
      const oraclePayloadResp = {
        ...oraclePayload,
        settlementPriceRef: priceRef,
        settlementSignaturesRef: signaturesRef,
        oraclePayloadKind: 'withSettlement',
      } as const;
      return oraclePayloadResp;
    }
    const oraclePayloadRespForSettlement =
      await this.stormClient.oracleClient.getPrice(collateralAssetName);
    const { priceRef: settlementPriceRef, signaturesRef: settlementSignaturesRef } =
      oraclePayloadRespForSettlement.result_message;
    const oraclePayloadResp = {
      ...oraclePayload,
      settlementPriceRef,
      settlementSignaturesRef,
      oraclePayloadKind: 'withSettlement',
    } as const;
    return oraclePayloadResp;
  }

  private async createSLTPOrder(opts: CreateSLTPOrderParams): Promise<TXParams> {
    await this.prefetchSLTPOrderCaches(opts);
    return this.syncCreateSLTPOrder(opts);
  }

  private syncCreateSLTPOrder(opts: CreateSLTPOrderParams) {
    const positionManagerAddress = this.positionManagerAddressCache.getOrThrow([
      opts.baseAssetName,
      opts.collateralAssetName,
    ]);
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

  async prefetchSLTPOrderCaches(opts: { baseAssetName: string; collateralAssetName: string }) {
    await this.getPositionManagerAddressByAssets(opts.baseAssetName, opts.collateralAssetName);
  }

  async prefetchCancelOrderCaches(opts: { baseAssetName: string; collateralAssetName: string }) {
    await this.getPositionManagerAddressByAssets(opts.baseAssetName, opts.collateralAssetName);
  }

  private async internalCreateLimitOrder(opts: CreateAnyLimitOrderParams): Promise<TXParams> {
    await this.prefetchInternalLimitOrderCaches(opts);
    return this.syncInternalCreateLimitOrder(opts);
  }

  private syncInternalCreateLimitOrder(opts: CreateAnyLimitOrderParams) {
    const vault = this.stormClient.config.requireVaultConfigByAssetName(opts.collateralAssetName);
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const positionManagerAddress = this.positionManagerAddressCache.getOrThrow([
      opts.baseAssetName,
      opts.collateralAssetName,
    ]);
    const initPositionManager = !this.initializedPositionManagersCache.get(
      positionManagerAddress.toRawString(),
    );

    const orderParams = {
      assetId,
      initPositionManager,
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

    if (this.isNativeVault(opts.collateralAssetName)) {
      return createLimitOrderTx({
        ...baseParams,
        vaultType: 'native',
      });
    } else {
      const traderJettonWalletAddress = this.jettonWalletsAddressCache.getOrThrow(
        opts.collateralAssetName,
      );
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
