import { Address, TonClient, TonClient4 } from '@ton/ton';
import { LiteClient } from 'ton-lite-client';
import {
  JettonMasterContract,
  PositionManagerContract,
  StormClient,
  TonClientAbstract,
  VaultContract,
} from '../api-clients';
import { PositionManagerData } from '../api-clients/contracts/position-manager/position-manager.types';
import { Cache } from '../api-clients/utils/cache';
import { OraclePayload, OrderType } from '../base-packers';
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
import {
  AddMarginParams,
  AddMarginWithOraclePayload,
  AssetsParams,
  CancelOrderParams,
  CollateralAssets,
  CreateAnyLimitOrderParams,
  CreateSLTPOrderParams,
  LimitOrderParams,
  MarketCloseOrderParams as ClosePositionOrderParams,
  MarketOpenOrderParams,
  ProvideLiquidityParams,
  RemoveMarginParams,
  RemoveMarginWithOraclePayload,
  StopLimitOrderParams,
  StopLossOrderParams,
  StopMarketOrderParams,
  TakeProfitOrderParams,
  WithdrawLiquidityParams,
} from './sdk.types';

const marketOpenDefaultExpiration = () => Math.floor(Date.now() / 1000) + 15 * 60;
const limitDefaultExpiration = () => Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60;
const toAddress = (address: Address | string) => address instanceof Address ? address : Address.parse(address);

type PositionManagerDataResponse = {
  jetton_wallet_address: string
  position_address: string
  position_manager_data: Record<string, unknown> | null
}


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
    this.traderAddress = toAddress(traderAddress);
    this.tonClient = new TonClientAbstract(tonClient);
  }

  async init() {
    await Promise.all([
      this.stormClient.config.fetchConfig(),
      this.stormClient.config.fetchAssetsConfig(),
    ]);
  }

  async getPositionManagerDataByTraderAndMarket(trader: string, market: string) {
    const result = await fetch(`https://api5.storm.tg/lite/api/v0/trader/${trader}/${market}/data`);
    const data: PositionManagerDataResponse = await result.json();

    const positionAddress = Address.parse(data.position_address);
    const jettonWalletAddress = data.jetton_wallet_address ? Address.parse(data.jetton_wallet_address) : null;
    const isInitialized = !data.position_manager_data;

    return {
      positionAddress,
      jettonWalletAddress,
      isInitialized
    }
  }

  async getPositionManagerAddressByAssets(opts: AssetsParams): Promise<Address> {
    const { baseAssetName, collateralAssetName } = opts;
    const positionAddressByAssetNameAndBaseAsset = this.positionManagerAddressCache.get([
      baseAssetName,
      collateralAssetName,
    ]);
    if (positionAddressByAssetNameAndBaseAsset) {
      return positionAddressByAssetNameAndBaseAsset;
    }
    const vamm = this.stormClient.config.requireAmmByAssetName(baseAssetName, collateralAssetName);
    const vammAddress = Address.parse(vamm.address);
    const { positionAddress } = await this.getPositionManagerDataByTraderAndMarket(this.traderAddress.toRawString(), vammAddress.toRawString());

    this.positionManagerAddressCache.set(
      baseAssetName + ':' + collateralAssetName,
      positionAddress,
    );
    return positionAddress;
  }

  async getPositionManagerData(positionManagerAddress: Address): Promise<PositionManagerData | null> {
    const positionManagerContract = this.getPositionManagerContract(
      positionManagerAddress.toRawString(),
    );
    return positionManagerContract.getData();
  }

  // Market open

  async prefetchCreateMarketOpenOrder(opts: AssetsParams): Promise<void> {
    const { collateralAssetName } = opts;
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(opts);
    await this.checkIsPositionManagerInitialized(positionManagerAddress);

    if (!this.isNativeVault(collateralAssetName)) {
      await this.getJettonWalletAddressByAssetName(collateralAssetName);
    }
  }

  syncCreateMarketOpenOrder(opts: MarketOpenOrderParams): TXParams {
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
      referralId: opts.referralId,
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

  async createMarketOpenOrder(opts: MarketOpenOrderParams): Promise<TXParams> {
    await this.prefetchCreateMarketOpenOrder(opts);
    return this.syncCreateMarketOpenOrder(opts);
  }

  // Market close

  prefetchCreateClosePositionOrder = this.prefetchSLTPOrderCaches;

  syncCreateClosePositionOrder(opts: ClosePositionOrderParams): TXParams {
    return this.syncCreateTakeProfitOrder({
      ...opts,
      amount: opts.size,
      triggerPrice: 0n,
    });
  }

  async createClosePositionOrder(opts: ClosePositionOrderParams): Promise<TXParams> {
    return this.createTakeProfitOrder({
      ...opts,
      amount: opts.size,
      triggerPrice: 0n,
    });
  }

  // Limit order

  prefetchCreateLimitOrder = this.prefetchCreateMarketOpenOrder;

  syncCreateLimitOrder(opts: LimitOrderParams): TXParams {
    return this.syncInternalCreateLimitOrder({ ...opts, stopPrice: 0n });
  }

  async createLimitOrder(opts: LimitOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder({ ...opts, stopPrice: 0n });
  }

  // Stop limit order

  prefetchCreateStopLimitOrder = this.prefetchCreateMarketOpenOrder;

  syncCreateStopLimitOrder(opts: StopLimitOrderParams): TXParams {
    return this.syncInternalCreateLimitOrder(opts);
  }

  async createStopLimitOrder(opts: StopLimitOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder(opts);
  }

  // Stop market order

  prefetchCreateStopMarketOrder = this.prefetchCreateMarketOpenOrder;

  syncCreateStopMarketOrder(opts: StopMarketOrderParams): TXParams {
    return this.syncInternalCreateLimitOrder({ ...opts, limitPrice: 0n });
  }

  async createStopMarketOrder(opts: StopMarketOrderParams): Promise<TXParams> {
    return this.internalCreateLimitOrder({ ...opts, limitPrice: 0n });
  }

  // Stop loss order

  prefetchCreteStopLossOrder = this.prefetchSLTPOrderCaches;

  syncCreateStopLossOrder(opts: StopLossOrderParams): TXParams {
    return this.syncCreateSLTPOrder({
      ...opts,
      type: OrderType.stopLoss,
    });
  }

  async createStopLossOrder(opts: StopLossOrderParams): Promise<TXParams> {
    return this.createSLTPOrder({
      ...opts,
      type: OrderType.stopLoss,
    });
  }

  // Take profit order

  prefetchCreteTakeProfitOrder = this.prefetchSLTPOrderCaches;

  syncCreateTakeProfitOrder(opts: TakeProfitOrderParams): TXParams {
    return this.syncCreateSLTPOrder({
      ...opts,
      type: OrderType.takeProfit,
    });
  }

  async createTakeProfitOrder(opts: TakeProfitOrderParams): Promise<TXParams> {
    return this.createSLTPOrder({
      ...opts,
      type: OrderType.takeProfit,
    });
  }

  // Add margin

  async prefetchAddMarginCaches(opts: AssetsParams): Promise<void> {
    if (!this.isNativeVault(opts.collateralAssetName)) {
      await this.getJettonWalletAddressByAssetName(opts.collateralAssetName);
    }
  }

  syncAddMargin(opts: AddMarginWithOraclePayload): TXParams {
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
    const oraclePayload = await this.getOraclePayloadByAssets(opts);
    return this.syncAddMargin({ ...opts, oraclePayload });
  }

  // Remove margin

  async prefetchRemoveMarginCaches(opts: AssetsParams): Promise<void> {
    await this.getPositionManagerAddressByAssets(opts);
  }

  syncRemoveMargin(opts: RemoveMarginWithOraclePayload): TXParams {
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

  async removeMargin(opts: RemoveMarginParams): Promise<TXParams> {
    await this.prefetchRemoveMarginCaches(opts);
    const oraclePayload = await this.getOraclePayloadByAssets(opts);
    return this.syncRemoveMargin({ ...opts, oraclePayload });
  }

  // Cancel order

  async prefetchCancelOrderCaches(opts: AssetsParams): Promise<void> {
    await this.getPositionManagerAddressByAssets(opts);
  }

  syncCreateCancelOrder(opts: CancelOrderParams): TXParams {
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

  async cancelOrder(opts: CancelOrderParams): Promise<TXParams> {
    await this.prefetchCancelOrderCaches(opts);
    return this.syncCreateCancelOrder(opts);
  }

  // Provide liquidity

  async prefetchProvideLiquidity(opts: ProvideLiquidityParams): Promise<void> {
    if (!this.isNativeVault(opts.assetName)) {
      await this.getJettonWalletAddressByAssetName(opts.assetName);
    }
  }

  syncProvideLiquidity(opts: ProvideLiquidityParams): TXParams {
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
        responseAddress: opts.responseAddress ? toAddress(opts.responseAddress) : undefined,
        ...baseParams,
      });
    }
  }

  async provideLiquidity(opts: ProvideLiquidityParams): Promise<TXParams> {
    await this.prefetchProvideLiquidity(opts);
    return this.syncProvideLiquidity(opts);
  }

  // Withdraw liquidity

  async prefetchWithdrawLiquidityCaches(assetName: CollateralAssets): Promise<void> {
    if (this.lpWalletsAddressCache.get(assetName)) {
      return;
    }
    const vault = this.stormClient.config.requireVaultConfigByAssetName(assetName);
    const lpJettonMasterContract = this.getJettonMasterContract(vault.lpJettonMaster);
    const lpWalletAddress = await lpJettonMasterContract.getJettonWalletAddress(this.traderAddress);
    this.lpWalletsAddressCache.set(assetName, lpWalletAddress);
  }

  syncWithdrawLiquidity(opts: WithdrawLiquidityParams): TXParams {
    const lpWalletAddress = this.lpWalletsAddressCache.getOrThrow(opts.assetName);
    return createWithdrawLiquidityTx({
      lpWalletAddress,
      amount: opts.amountOfSLP,
      userAddress: this.traderAddress,
      responseAddress: opts.responseAddress ? toAddress(opts.responseAddress) : undefined,
    });
  }

  async withdrawLiquidity(opts: WithdrawLiquidityParams): Promise<TXParams> {
    const { assetName } = opts;
    await this.prefetchWithdrawLiquidityCaches(assetName);
    return this.syncWithdrawLiquidity(opts);
  }

  //

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

  private async checkIsPositionManagerInitialized(positionManagerAddress: Address): Promise<boolean> {
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

  private async getOraclePayloadByAssets(opts: AssetsParams): Promise<OraclePayload> {
    const { baseAssetName, collateralAssetName } = opts;
    const oraclePriceResp = await this.stormClient.oracleClient.getPrice(baseAssetName);
    const oraclePayload = { ...oraclePriceResp.result_message };
    if (collateralAssetName === 'USDT') {
      return {
        ...oraclePayload,
        oraclePayloadKind: 'simple',
      } as const;
    }
    const { priceRef, signaturesRef } = oraclePayload;
    if (collateralAssetName === baseAssetName) {
      return {
        ...oraclePayload,
        settlementPriceRef: priceRef,
        settlementSignaturesRef: signaturesRef,
        oraclePayloadKind: 'withSettlement',
      } as const;
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
    } as const;
  }

  private async createSLTPOrder(opts: CreateSLTPOrderParams): Promise<TXParams> {
    await this.prefetchSLTPOrderCaches(opts);
    return this.syncCreateSLTPOrder(opts);
  }

  private syncCreateSLTPOrder(opts: CreateSLTPOrderParams): TXParams {
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

  private async prefetchSLTPOrderCaches(opts: AssetsParams): Promise<void> {
    await this.getPositionManagerAddressByAssets(opts);
  }

  private async internalCreateLimitOrder(opts: CreateAnyLimitOrderParams): Promise<TXParams> {
    await this.prefetchCreateMarketOpenOrder(opts);
    return this.syncInternalCreateLimitOrder(opts);
  }

  private syncInternalCreateLimitOrder(opts: CreateAnyLimitOrderParams): TXParams {
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
      referralId: opts.referralId,
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
