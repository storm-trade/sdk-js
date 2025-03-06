import {
  JettonMasterContract,
  PositionManagerContract,
  StormClient,
  TonClientAbstract,
  VaultContract,
} from '../api-clients';
import { TonClient, TonClient4, Address } from '@ton/ton';
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

const marketOpenDefaultExpiration = () => Math.floor(Date.now() / 1000) + 15 * 60;
const limitDefaultExpiration = () => Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60;

export class StormTradingSdk {
  private readonly tonClient: TonClientAbstract;
  private readonly traderAddress: Address;
  private readonly jettonWalletsAddressCache: Map<string, Address> = new Map();
  private readonly positionManagerAddressCache: Map<string, Address> = new Map();
  private readonly initializedPositionManagersCache: Set<string> = new Set();
  private readonly jettonMasters: Map<string, JettonMasterContract> = new Map();
  private readonly vaults: Map<string, VaultContract> = new Map();
  private readonly positionManagers: Map<string, PositionManagerContract> = new Map();

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

  async getPositionManagerAddressByAssets(baseAssetName: string, collateralAssetName: string): Promise<Address> {
    const positionAddressByAssetNameAndBaseAsset = this.positionManagerAddressCache.get(
      baseAssetName + ':' + collateralAssetName,
    );
    if (positionAddressByAssetNameAndBaseAsset) {
      return positionAddressByAssetNameAndBaseAsset;
    }
    const vamm = this.stormClient.config.requireAmmByAssetName(baseAssetName, collateralAssetName);
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const vaultContract = this.getVaultContract(vault.vaultAddress);
    const vammAddress = Address.parse(vamm.address);
    const positionManagerAddress = await vaultContract.getPositionManagerAddress(vammAddress, this.traderAddress);
    this.positionManagerAddressCache.set(
      baseAssetName + ':' + collateralAssetName,
      positionManagerAddress,
    );
    return positionManagerAddress;
  }

  async getPositionManagerData(positionManagerAddress: Address): Promise<PositionManagerData | null> {
    const positionManagerContract = this.getPositionManagerContract(positionManagerAddress.toRawString());
    return positionManagerContract.getData();
  }

  async createMarketOpenOrder(opts: MarketOpenOrderParams): Promise<TXParams> {
    const { baseAssetName, collateralAssetName } = opts;
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      baseAssetName,
      collateralAssetName,
    );
    const isPositionManagerInitialized =
      await this.checkIsPositionManagerInitialized(positionManagerAddress);
    const assetId = this.stormClient.config.requireAssetIndexByName(baseAssetName);

    const orderParams = {
      assetId,
      initPositionManager: !isPositionManagerInitialized,
      amount: opts.amount,
      direction: opts.direction,
      leverage: opts.leverage,
      expiration: opts.expiration ?? marketOpenDefaultExpiration(),
      limitPrice: 0n,
      minBaseAssetAmount: opts.minBaseAssetAmount ?? 0n,
      stopTriggerPrice: opts.stopTriggerPrice ?? 0n,
      takeTriggerPrice: opts.takeTriggerPrice ?? 0n,
    };

    const baseParams = {
      traderAddress: this.traderAddress,
      amount: opts.amount,
      positionManagerAddress,
      vaultAddress: Address.parse(vault.vaultAddress),
      orderParams,
    };

    if (this.isNativeVault(collateralAssetName)) {
      return createMarketOrderTx({
        ...baseParams,
        vaultType: 'native',
      });
    } else {
      const traderJettonWalletAddress = await this.getJettonWalletAddressByAssetName(
        collateralAssetName,
      );
      return createMarketOrderTx({
        ...baseParams,
        vaultType: 'jetton',
        traderJettonWalletAddress,
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

  async provideLiquidity(opts: ProvideLiquidityParams): Promise<TXParams> {
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
      const traderJettonWalletAddress = await this.getJettonWalletAddressByAssetName(
        assetName,
      );
      return createProvideLiquidityTx({
        vaultType: 'jetton',
        traderJettonWalletAddress,
        ...baseParams,
      });
    }
  }

  async withdrawLiquidity(opts: WithdrawLiquidityParams): Promise<TXParams> {
    const { assetName } = opts;
    const vault = this.stormClient.config.requireVaultConfigByAssetName(assetName);
    const lpJettonMasterContract = this.getJettonMasterContract(vault.lpJettonMaster);
    const lpWalletAddress = await lpJettonMasterContract.getJettonWalletAddress(this.traderAddress);
    return createWithdrawLiquidityTx({
      lpWalletAddress,
      amount: opts.amountOfSLP,
      userAddress: this.traderAddress,
    });
  }

  async addMargin(opts: AddMarginParams): Promise<TXParams> {
    const vault = this.stormClient.config.requireVaultConfigByAssetName(opts.collateralAssetName);
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const oraclePayload = opts.oraclePayload
      ? opts.oraclePayload
      : await this.getOraclePayloadByAssets(
        opts.baseAssetName,
        opts.collateralAssetName,
      );
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

  async removeMargin(opts: RemoveMarginParams): Promise<TXParams> {
    const assetId = this.stormClient.config.requireAssetIndexByName(opts.baseAssetName);
    const oraclePayload = opts.oraclePayload
      ? opts.oraclePayload
      : await this.getOraclePayloadByAssets(
        opts.baseAssetName,
        opts.collateralAssetName,
      );
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

  private async getOraclePayloadByAssets(baseAssetName: string, collateralAssetName: string): Promise<OraclePayload> {
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
    const vault = this.stormClient.config.requireVaultConfigByAssetName(collateralAssetName);
    const positionManagerAddress = await this.getPositionManagerAddressByAssets(
      baseAssetName,
      collateralAssetName,
    );
    const assetId = this.stormClient.config.requireAssetIndexByName(baseAssetName);
    const isPositionManagerInitialized =
      await this.checkIsPositionManagerInitialized(positionManagerAddress);

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
      const traderJettonWalletAddress = await this.getJettonWalletAddressByAssetName(
        collateralAssetName,
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
