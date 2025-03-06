export type Asset = {
  name: string;
  decimals: number;
  assetId: string;
};

export type Market = {
  address: string;
  quoteAsset: string;
  baseAsset: string;
  name: string;
  ticker: string;
  quoteAssetId: string;
  settlementToken: string;
  type: string;
  vaultAddress: string;
};

export type LiquiditySource = {
  asset: Asset;
  vaultAddress: string;
  quoteAssetId: string;
  lpJettonMaster: string;
};

export type StormConfig = {
  referralCollectionAddress: string;
  genesisCollectionAddress: string;
  assets: Asset[];
  openedMarkets: Market[];
  liquiditySources: LiquiditySource[];
  stormJettonMasterAddress: string;
};

export type AssetConfigInfo = {
  name: string;
  type: string;
  index: number;
};

export class ConfigClient {
  private cfg?: StormConfig;
  private assetIndexByName: Map<string, number> = new Map();
  private vaultByNames: Map<string, LiquiditySource> = new Map();
  private ammByBaseAsset: Map<string, Market> = new Map();
  private assetsConfig: AssetConfigInfo[] = [];
  private assetsInfo: Asset[] = [];

  constructor(private readonly CONFIG_URL: string) {
  }

  async fetchConfig() {
    const response = await fetch(this.CONFIG_URL);
    this.provideConfig(await response.json());
    return this;
  }

  async fetchAssetsConfig() {
    const response = await fetch(`${this.CONFIG_URL}/assets`);
    this.provideAssetsConfig(await response.json());
    return this;
  }

  provideConfig(stormConfig: StormConfig) {
    this.cfg = stormConfig;
    this.vaultByNames = new Map(stormConfig.liquiditySources.map(ls => [ls.asset.name, ls]));
    this.ammByBaseAsset = new Map(
      stormConfig.openedMarkets.map(market => [
        `${market.baseAsset}:${market.settlementToken}`,
        market,
      ]),
    );
    this.assetsInfo = stormConfig.assets;
    return this;
  }

  provideAssetsConfig(assetsConfig: AssetConfigInfo[]) {
    this.assetsConfig = assetsConfig;
    this.assetIndexByName = new Map(assetsConfig.map(ac => [ac.name, ac.index]));
  }

  getAssetIndexByName(assetName: string): number | undefined {
    return this.assetIndexByName.get(assetName);
  }

  getAmmByAssetName(baseAsset: string, collateralAsset: string): Market | undefined {
    return this.ammByBaseAsset.get(`${baseAsset}:${collateralAsset}`);
  }

  getVaultConfigByAssetName(assetName: string): LiquiditySource | undefined {
    return this.vaultByNames.get(assetName);
  }

  requireAssetIndexByName(assetName: string): number {
    const assetIndex = this.assetIndexByName.get(assetName);
    if (!assetIndex) {
      throw new Error(`Asset ${assetName} not found`);
    }
    return assetIndex;
  }

  requireAmmByAssetName(baseAsset: string, collateralAsset: string): Market {
    const amm = this.ammByBaseAsset.get(`${baseAsset}:${collateralAsset}`);
    if (!amm) {
      throw new Error();
    }
    return amm;
  }

  requireVaultConfigByAssetName(assetName: string): LiquiditySource {
    const vault = this.vaultByNames.get(assetName);
    if (!vault) {
      throw new Error();
    }
    return vault;
  }

  config() {
    return this.cfg;
  }
}
