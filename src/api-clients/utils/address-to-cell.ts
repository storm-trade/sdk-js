import { Address, beginCell, Cell } from '@ton/ton';

export function addressToCell(addr: Address): Cell {
  return beginCell().storeAddress(addr).endCell();
}
