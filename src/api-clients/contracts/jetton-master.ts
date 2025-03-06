import { TonClientAbstract } from '../utils/ton-client-abstract';
import { Address } from '@ton/ton';
import { addressToCell } from '../utils/address-to-cell';

export class JettonMasterContract {
  constructor(private readonly tonClient: TonClientAbstract, private readonly address: Address) {
  }

  async getJettonWalletAddress(traderAddress: Address): Promise<Address> {
    const jettonWalletAddressResponseStack = await this.tonClient.runGetMethod(
      this.address,
      'get_wallet_address',
      [{ type: 'slice', cell: addressToCell(traderAddress) }],
    );
    const jettonWalletAddress = jettonWalletAddressResponseStack.readAddress();
    if (!jettonWalletAddress) {
      throw new Error('Jetton wallet address not found');
    }
    return jettonWalletAddress;
  }
}
