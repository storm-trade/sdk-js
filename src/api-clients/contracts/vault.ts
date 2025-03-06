import { TonClientAbstract } from '../utils/ton-client-abstract';
import { Address } from '@ton/ton';
import { addressToCell } from '../utils/address-to-cell';

export class VaultContract {
  constructor(private readonly tonClient: TonClientAbstract, private readonly address: Address) {
  }

  async getPositionManagerAddress(ammAddress: Address, traderAddress: Address): Promise<Address> {
    const stack = await this.tonClient.runGetMethod(
      this.address,
      'get_position_address',
      [
        {
          type: 'slice',
          cell: addressToCell(traderAddress),
        },
        {
          type: 'slice',
          cell: addressToCell(ammAddress),
        },
      ],
    );
    const positionManagerAddress = stack.readAddress();
    if (!positionManagerAddress) {
      throw new Error();
    }
    return positionManagerAddress;
  }
}
