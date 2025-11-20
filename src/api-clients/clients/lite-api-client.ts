import { createFetchInstance } from '@hastom/fetch';
import { Address } from '@ton/ton';

export type PositionManagerDataResponse = {
  jetton_wallet_address: string
  position_address: string
  position_manager_data: Record<string, unknown> | null
}

export type JettonAddressResponse = {
  address: string
}

export class LiteApiClient {
  private client: ReturnType<typeof createFetchInstance>;

  constructor(baseURL: string) {
    this.client = createFetchInstance({ baseURL });
  }

  async getPositionManagerDataByTraderAndMarket(trader: string, market: string) {
    const result = await this.client.get(`trader/${trader}/${market}/data`);
    const data: PositionManagerDataResponse = await result.json();

    const positionAddress = Address.parse(data.position_address);
    const jettonWalletAddress = data.jetton_wallet_address ? Address.parse(data.jetton_wallet_address) : null;
    const isInitialized = !!data.position_manager_data;

    return {
      positionAddress,
      jettonWalletAddress,
      isInitialized
    }
  }

  async getJettonWalletAddress(walletAddress: string, jettonMasterAddress: string) {
    const result = await this.client.get(`address/${walletAddress}/jetton/${jettonMasterAddress}/address`);
    const data: JettonAddressResponse = await result.json();

    return Address.parse(data.address)
  }
}
