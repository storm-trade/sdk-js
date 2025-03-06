import { TonClientAbstract } from '../utils/ton-client-abstract';
import { Address, Cell, Dictionary } from '@ton/ton';
import {
  OrdersDictValue,
  parseOrdersDict,
  unpackPositionRecord,
  unpackPositionReferralData,
} from './position-manager/position-manager-packers';
import { PositionManagerData } from './position-manager/position-manager.types';

export class PositionManagerContract {
  constructor(private readonly tonClient: TonClientAbstract, private readonly address: Address) {
  }

  async getData(): Promise<PositionManagerData | null> {
    const isPositionManagerContractDeployed =
      await this.tonClient.isContractDeployed(this.address);
    if (!isPositionManagerContractDeployed) {
      return null;
    }
    const stack = await this.tonClient.runGetMethod(
      this.address,
      'get_position_manager_data',
    );
    const [traderAddress, vaultAddress, vammAddress] = [
      stack.readAddress(),
      stack.readAddress(),
      stack.readAddress(),
    ];

    let [longPositionRaw, shortPositionRaw, limitOrdersRaw, referralDataRaw] = [
      stack.readCellOpt(),
      stack.readCellOpt(),
      stack.readCellOpt(),
      stack.readCellOpt(),
    ];

    const [limitOrdersBitset] = [stack.readNumber()];

    if (longPositionRaw?.equals(Cell.EMPTY)) {
      longPositionRaw = null;
    }
    if (shortPositionRaw?.equals(Cell.EMPTY)) {
      shortPositionRaw = null;
    }
    if (limitOrdersRaw?.equals(Cell.EMPTY)) {
      limitOrdersRaw = null;
    }
    if (referralDataRaw?.equals(Cell.EMPTY)) {
      referralDataRaw = null;
    }

    return {
      traderAddress,
      vaultAddress,
      vammAddress,
      longPosition: unpackPositionRecord(longPositionRaw),
      shortPosition: unpackPositionRecord(shortPositionRaw),
      limitOrders: parseOrdersDict(
        Dictionary.loadDirect(Dictionary.Keys.Uint(3), OrdersDictValue, limitOrdersRaw),
      ),
      referralData: unpackPositionReferralData(referralDataRaw),
      limitOrdersBitset,
    };
  }
}
